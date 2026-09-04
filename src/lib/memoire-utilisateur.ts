/**
 * Mémoire des habitudes de l'utilisateur, partagée par toutes les
 * intelligences locales de l'application.
 *
 * Chaque intelligence (conseiller, budget automatique,
 * lecture des tickets, saisie intelligente…) écrit ici ce qu'elle observe et
 * lit ici ce que les autres ont déjà appris. Résultat : elles progressent
 * ensemble au lieu d'apprendre chacune dans son coin.
 *
 * Tout est stocké sur l'appareil, sans aucun envoi réseau. Le journal ne
 * conserve ni nom de personne ni numéro : uniquement le type d'action, une
 * étiquette courte, un montant arrondi et l'horodatage.
 */

const CLE_JOURNAL = "super-app:memoire-habitudes";
const TAILLE_MAX = 400;

/** Types d'actions observées par les intelligences. */
export type TypeAction =
  | "depense"
  | "revenu"
  | "transfert"
  | "enveloppe"
  | "objectif"
  | "budget"
  | "question"
  | "conseil-utile"
  | "conseil-inutile"
  | "ecran"
  | "correction-ticket";

export type ActionMemorisee = {
  type: TypeAction;
  /** Étiquette courte : nom d'enveloppe, écran visité, sujet de question… */
  cible: string;
  /** Montant arrondi lorsque l'action en comporte un. */
  montant: number;
  /** Horodatage ISO. */
  date: string;
};

export type JournalHabitudes = {
  actions: ActionMemorisee[];
  /** Nombre total d'actions observées depuis l'installation. */
  total: number;
};

export const JOURNAL_VIDE: JournalHabitudes = { actions: [], total: 0 };

function assainirAction(brut: unknown): ActionMemorisee | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Partial<ActionMemorisee>;
  if (typeof o.type !== "string" || typeof o.date !== "string") return null;
  return {
    type: o.type as TypeAction,
    cible: typeof o.cible === "string" ? o.cible.slice(0, 60) : "",
    montant: Number.isFinite(Number(o.montant)) ? Number(o.montant) : 0,
    date: o.date,
  };
}

export function lireJournalHabitudes(): JournalHabitudes {
  if (typeof window === "undefined") return JOURNAL_VIDE;
  try {
    const brut = window.localStorage.getItem(CLE_JOURNAL);
    if (!brut) return JOURNAL_VIDE;
    const o = JSON.parse(brut) as Partial<JournalHabitudes>;
    const actions = Array.isArray(o.actions)
      ? o.actions.map(assainirAction).filter((a): a is ActionMemorisee => a !== null)
      : [];
    return { actions: actions.slice(-TAILLE_MAX), total: Number(o.total) || actions.length };
  } catch {
    return JOURNAL_VIDE;
  }
}

function ecrireJournal(journal: JournalHabitudes): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CLE_JOURNAL,
      JSON.stringify({ actions: journal.actions.slice(-TAILLE_MAX), total: journal.total }),
    );
  } catch {
    /* stockage plein : la mémoire reprendra plus tard */
  }
}

/** Événement émis à chaque nouvelle action, pour rafraîchir les écrans. */
export const EVENEMENT_HABITUDE = "super-app:habitude";

/**
 * Mémorise une action de l'utilisateur. Appelée par toutes les intelligences :
 * c'est le point d'entrée unique de l'apprentissage partagé.
 */
export function noterAction(
  type: TypeAction,
  cible = "",
  montant = 0,
  maintenant = new Date(),
): JournalHabitudes {
  const journal = lireJournalHabitudes();
  const action: ActionMemorisee = {
    type,
    cible: cible.slice(0, 60),
    montant: Math.round(montant),
    date: maintenant.toISOString(),
  };
  // Une même action répétée dans la minute ne compte qu'une fois : la
  // navigation React monte parfois deux fois le même écran.
  const derniere = journal.actions[journal.actions.length - 1];
  if (
    derniere &&
    derniere.type === type &&
    derniere.cible === action.cible &&
    Math.abs(new Date(derniere.date).getTime() - maintenant.getTime()) < 60_000
  ) {
    return journal;
  }
  const suivant: JournalHabitudes = {
    actions: [...journal.actions, action].slice(-TAILLE_MAX),
    total: journal.total + 1,
  };
  ecrireJournal(suivant);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENEMENT_HABITUDE, { detail: action }));
  }
  return suivant;
}

/** Efface la mémoire des habitudes (réglages → données). */
export function oublierHabitudes(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLE_JOURNAL);
  } catch {
    /* rien à faire */
  }
}

export type Habitudes = {
  /** Nombre d'actions observées (journal courant). */
  observees: number;
  /** Total historique, même après rotation du journal. */
  total: number;
  /** Tranches horaires les plus actives, ex. « 12 h ». */
  heuresActives: string[];
  /** Jour de la semaine où l'utilisateur dépense le plus. */
  jourFort: string;
  /** Enveloppes ou postes les plus souvent utilisés. */
  ciblesFrequentes: string[];
  /** Écrans les plus visités. */
  ecransFrequents: string[];
  /** Sujets que l'utilisateur ramène le plus souvent au conseiller. */
  sujetsFrequents: string[];
  /** Montant médian d'une dépense saisie à la main. */
  montantMedian: number;
  /** Nombre moyen d'actions par jour actif. */
  rythmeJour: number;
  /** Part de conseils jugés utiles, en pourcentage (−1 si aucun avis). */
  satisfaction: number;
  /** Maturité de la mémoire, de 0 à 100 %. */
  maturite: number;
};

export const HABITUDES_VIDES: Habitudes = {
  observees: 0,
  total: 0,
  heuresActives: [],
  jourFort: "",
  ciblesFrequentes: [],
  ecransFrequents: [],
  sujetsFrequents: [],
  montantMedian: 0,
  rythmeJour: 0,
  satisfaction: -1,
  maturite: 0,
};

const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

function premiers(compte: Map<string, number>, combien: number): string[] {
  return [...compte.entries()]
    .filter(([cle]) => cle.length > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, combien)
    .map(([cle]) => cle);
}

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const tries = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tries.length / 2);
  const a = tries[milieu] ?? 0;
  const b = tries[milieu - 1] ?? a;
  return tries.length % 2 === 1 ? a : Math.round((a + b) / 2);
}

/** Transforme le journal brut en habitudes lisibles par les intelligences. */
export function calculerHabitudes(journal: JournalHabitudes = lireJournalHabitudes()): Habitudes {
  const actions = journal.actions;
  if (actions.length === 0) return { ...HABITUDES_VIDES, total: journal.total };

  const heures = new Map<string, number>();
  const jours = new Map<string, number>();
  const cibles = new Map<string, number>();
  const ecrans = new Map<string, number>();
  const sujets = new Map<string, number>();
  const joursActifs = new Set<string>();
  const montants: number[] = [];
  let utiles = 0;
  let inutiles = 0;

  for (const a of actions) {
    const d = new Date(a.date);
    if (Number.isNaN(d.getTime())) continue;
    joursActifs.add(a.date.slice(0, 10));
    heures.set(`${d.getHours()} h`, (heures.get(`${d.getHours()} h`) ?? 0) + 1);
    if (a.type === "depense") {
      const jour = JOURS_FR[d.getDay()] ?? "";
      jours.set(jour, (jours.get(jour) ?? 0) + 1);
      if (a.montant > 0) montants.push(a.montant);
    }
    if (a.type === "depense" || a.type === "revenu" || a.type === "enveloppe") {
      cibles.set(a.cible, (cibles.get(a.cible) ?? 0) + 1);
    }
    if (a.type === "ecran") ecrans.set(a.cible, (ecrans.get(a.cible) ?? 0) + 1);
    if (a.type === "question") sujets.set(a.cible, (sujets.get(a.cible) ?? 0) + 1);
    if (a.type === "conseil-utile") utiles += 1;
    if (a.type === "conseil-inutile") inutiles += 1;
  }

  const avis = utiles + inutiles;
  return {
    observees: actions.length,
    total: journal.total,
    heuresActives: premiers(heures, 2),
    jourFort: premiers(jours, 1)[0] ?? "",
    ciblesFrequentes: premiers(cibles, 3),
    ecransFrequents: premiers(ecrans, 3),
    sujetsFrequents: premiers(sujets, 3),
    montantMedian: mediane(montants),
    rythmeJour:
      joursActifs.size === 0 ? 0 : Math.round((actions.length / joursActifs.size) * 10) / 10,
    satisfaction: avis === 0 ? -1 : Math.round((utiles / avis) * 100),
    maturite: Math.min(100, Math.round((journal.total / 120) * 100)),
  };
}

/** Met les habitudes en phrases simples, réutilisables par tous les écrans. */
export function phrasesHabitudes(h: Habitudes): string[] {
  const phrases: string[] = [];
  if (h.observees === 0) {
    return [
      "Je commence tout juste à observer vos habitudes : utilisez l'application normalement.",
    ];
  }
  if (h.heuresActives.length > 0) {
    phrases.push(`Vous utilisez surtout l'application vers ${h.heuresActives.join(" et ")}.`);
  }
  if (h.jourFort) phrases.push(`Votre jour de dépense le plus fréquent est le ${h.jourFort}.`);
  if (h.montantMedian > 0) {
    phrases.push(
      `Votre dépense habituelle tourne autour de ${h.montantMedian.toLocaleString("fr-FR")} FCFA.`,
    );
  }
  if (h.ciblesFrequentes.length > 0) {
    phrases.push(`Vos postes les plus mouvementés : ${h.ciblesFrequentes.join(", ")}.`);
  }
  if (h.sujetsFrequents.length > 0) {
    phrases.push(`Vous me questionnez souvent sur : ${h.sujetsFrequents.join(", ")}.`);
  }
  if (h.satisfaction >= 0) {
    phrases.push(`${h.satisfaction} % de mes conseils vous ont été utiles jusqu'ici.`);
  }
  phrases.push(
    `Mémoire des habitudes : ${h.maturite} % de maturité (${h.total} actions apprises).`,
  );
  return phrases;
}

/** Mot-clé principal d'une question, mémorisé comme sujet. */
export function sujetDeQuestion(question: string): string {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const table: [RegExp, string][] = [
    [/objectif|epargn|economis/, "épargne"],
    [/dette|creance|dois|prete/, "dettes"],
    [/enveloppe|poche/, "enveloppes"],
    [/budget|planifi|prevu/, "budget"],
    [/compte|solde|banque|momo|wave/, "comptes"],
    [/depense|achat|sorti/, "dépenses"],
    [/revenu|salaire|entree/, "revenus"],
    [/prevision|futur|prochain mois|projection/, "prévisions"],
    [/conseil|aide|que faire/, "conseils"],
  ];
  for (const [motif, sujet] of table) if (motif.test(q)) return sujet;
  return "divers";
}
