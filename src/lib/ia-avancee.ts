/**
 * Intelligences d'apprentissage avancées, calculées uniquement sur l'appareil.
 *
 * Quatre capacités complètent le réseau existant (cerveau, coach, budget
 * automatique, mémoire des habitudes) :
 *  1. Détection des rythmes de dépense et des opérations inhabituelles.
 *  2. Prévision de fin de mois, enveloppe par enveloppe.
 *  3. Suggestion automatique de l'enveloppe au moment de la saisie.
 *  4. Résumé hebdomadaire avec une seule action conseillée.
 */
import type { Enveloppe, Transaction } from "./store";
import { dotationDe } from "./enveloppe-etat";

const JOUR = 86400000;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
}

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 0 ? (tri[milieu - 1] + tri[milieu]) / 2 : tri[milieu];
}

/* ------------------------------------------------------------------ */
/* 1. Rythmes et opérations inhabituelles                               */
/* ------------------------------------------------------------------ */

export type Rythme = {
  libelle: string;
  jour: string;
  occurrences: number;
  montantMoyen: number;
  phrase: string;
};

/** Repère les dépenses qui reviennent le même jour de la semaine. */
export function rythmesDepenses(transactions: Transaction[], minimum = 3): Rythme[] {
  const groupes = new Map<string, { montants: number[]; libelle: string; jour: number }>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const cle = normaliser(t.libelle).split(" ").slice(0, 2).join(" ");
    if (!cle) continue;
    const jour = new Date(t.date).getDay();
    const id = `${cle}|${jour}`;
    const g = groupes.get(id) ?? { montants: [], libelle: t.libelle, jour };
    g.montants.push(t.montant);
    groupes.set(id, g);
  }
  return [...groupes.values()]
    .filter((g) => g.montants.length >= minimum)
    .map((g) => {
      const moyen = Math.round(g.montants.reduce((s, m) => s + m, 0) / g.montants.length);
      return {
        libelle: g.libelle,
        jour: JOURS[g.jour],
        occurrences: g.montants.length,
        montantMoyen: moyen,
        phrase: `Presque chaque ${JOURS[g.jour]}, vous dépensez environ ${moyen} F pour « ${g.libelle} ».`,
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 6);
}

export type OperationInhabituelle = {
  id: string;
  libelle: string;
  montant: number;
  date: string;
  habituel: number;
  ecartPourcent: number;
  phrase: string;
};

/**
 * Compare chaque dépense récente à l'habitude pour le même libellé.
 * Sert d'alerte anti-erreur de saisie et anti-prélèvement anormal.
 */
export function operationsInhabituelles(
  transactions: Transaction[],
  jours = 30,
): OperationInhabituelle[] {
  const limite = new Date(Date.now() - jours * JOUR).toISOString().slice(0, 10);
  const historique = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const cle = normaliser(t.libelle);
    if (!cle) continue;
    historique.set(cle, [...(historique.get(cle) ?? []), t.montant]);
  }
  const resultats: OperationInhabituelle[] = [];
  for (const t of transactions) {
    if (t.type !== "depense" || t.date.slice(0, 10) < limite) continue;
    const cle = normaliser(t.libelle);
    const montants = historique.get(cle) ?? [];
    if (montants.length < 4) continue;
    const habituel = Math.round(mediane(montants));
    if (habituel <= 0) continue;
    const ecart = ((t.montant - habituel) / habituel) * 100;
    if (ecart < 60) continue;
    resultats.push({
      id: t.id,
      libelle: t.libelle,
      montant: t.montant,
      date: t.date,
      habituel,
      ecartPourcent: Math.round(ecart),
      phrase: `« ${t.libelle} » vous coûte d'habitude environ ${habituel} F. Cette fois : ${t.montant} F.`,
    });
  }
  return resultats.sort((a, b) => b.ecartPourcent - a.ecartPourcent).slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* 2. Prévision de fin de mois par enveloppe                            */
/* ------------------------------------------------------------------ */

export type PrevisionEnveloppe = {
  id: string;
  nom: string;
  dotation: number;
  depense: number;
  projete: number;
  depassement: number;
  jourEpuisement: number | null;
  niveau: "ok" | "juste" | "depassement";
  phrase: string;
};

/** Projette la consommation de chaque enveloppe jusqu'à la fin du mois. */
export function previsionFinDeMois(args: {
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
  maintenant?: Date;
}): PrevisionEnveloppe[] {
  const maintenant = args.maintenant ?? new Date();
  const jourActuel = maintenant.getDate();
  const joursMois = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth() + 1,
    0,
  ).getDate();

  return args.enveloppes
    .map((e) => {
      const dotation = dotationDe(e);
      const depense = args.depensesParEnveloppe[e.id] ?? 0;
      const parJour = depense / Math.max(1, jourActuel);
      const projete = Math.round(parJour * joursMois);
      const depassement = Math.max(0, projete - dotation);
      const jourEpuisement =
        parJour > 0 && dotation > 0 ? Math.ceil(dotation / parJour) : null;
      const niveau: PrevisionEnveloppe["niveau"] =
        depassement > 0 ? "depassement" : projete > dotation * 0.9 ? "juste" : "ok";
      const phrase =
        niveau === "depassement"
          ? `À ce rythme, « ${e.nom} » dépassera de ${depassement} F avant la fin du mois.`
          : niveau === "juste"
            ? `« ${e.nom} » tiendra tout juste jusqu'à la fin du mois.`
            : `« ${e.nom} » va bien : il devrait rester de l'argent à la fin du mois.`;
      return {
        id: e.id,
        nom: e.nom,
        dotation,
        depense,
        projete,
        depassement,
        jourEpuisement: jourEpuisement && jourEpuisement <= joursMois ? jourEpuisement : null,
        niveau,
        phrase,
      };
    })
    .sort((a, b) => b.depassement - a.depassement);
}

/* ------------------------------------------------------------------ */
/* 3. Suggestion d'enveloppe à la saisie                                */
/* ------------------------------------------------------------------ */

export type SuggestionEnveloppe = {
  enveloppe: string;
  confiance: number;
  raison: string;
};

/**
 * Devine l'enveloppe d'une dépense d'après les libellés déjà saisis.
 * Plus l'utilisateur saisit, plus la suggestion devient juste.
 */
export function suggererEnveloppe(
  libelle: string,
  transactions: Transaction[],
): SuggestionEnveloppe | null {
  const mots = normaliser(libelle).split(" ").filter((m) => m.length >= 3);
  if (mots.length === 0) return null;

  const scores = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "depense" || !t.categorie) continue;
    const cible = normaliser(t.libelle);
    let score = 0;
    for (const m of mots) if (cible.includes(m)) score += 1;
    if (score === 0) continue;
    scores.set(t.categorie, (scores.get(t.categorie) ?? 0) + score);
    total += score;
  }
  if (total === 0) return null;

  const [meilleur] = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const confiance = Math.round((meilleur[1] / total) * 100);
  if (confiance < 50) return null;
  return {
    enveloppe: meilleur[0],
    confiance,
    raison: `D'après vos saisies passées contenant « ${mots[0]} ».`,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Résumé hebdomadaire                                               */
/* ------------------------------------------------------------------ */

export type ResumeHebdo = {
  depensesSemaine: number;
  depensesSemainePrecedente: number;
  variation: number;
  meilleurPoint: string;
  pointDeVigilance: string;
  actionConseillee: string;
};

export function resumeHebdomadaire(args: {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
  maintenant?: Date;
}): ResumeHebdo {
  const maintenant = args.maintenant ?? new Date();
  const debutSemaine = new Date(maintenant.getTime() - 7 * JOUR).toISOString().slice(0, 10);
  const debutPrecedente = new Date(maintenant.getTime() - 14 * JOUR).toISOString().slice(0, 10);

  const depenses = args.transactions.filter((t) => t.type === "depense");
  const semaine = depenses
    .filter((t) => t.date.slice(0, 10) >= debutSemaine)
    .reduce((s, t) => s + t.montant, 0);
  const precedente = depenses
    .filter((t) => t.date.slice(0, 10) >= debutPrecedente && t.date.slice(0, 10) < debutSemaine)
    .reduce((s, t) => s + t.montant, 0);
  const variation = precedente > 0 ? Math.round(((semaine - precedente) / precedente) * 100) : 0;

  const previsions = previsionFinDeMois({
    enveloppes: args.enveloppes,
    depensesParEnveloppe: args.depensesParEnveloppe,
    maintenant,
  });
  const risque = previsions.find((p) => p.niveau === "depassement");
  const saine = [...previsions].reverse().find((p) => p.niveau === "ok" && p.depense > 0);

  const meilleurPoint =
    variation < 0
      ? `Vous avez dépensé ${Math.abs(variation)} % de moins que la semaine passée. Bravo.`
      : saine
        ? `L'enveloppe « ${saine.nom} » est bien maîtrisée cette semaine.`
        : "Vos saisies sont régulières : l'application apprend mieux vos habitudes.";

  const pointDeVigilance = risque
    ? `« ${risque.nom} » risque de dépasser de ${risque.depassement} F d'ici la fin du mois.`
    : variation > 25
      ? `Vos dépenses ont augmenté de ${variation} % par rapport à la semaine passée.`
      : "Aucun dérapage repéré cette semaine.";

  const actionConseillee = risque
    ? `Réduisez « ${risque.nom} » d'environ ${Math.ceil(risque.depassement / 4)} F par semaine, ou augmentez son enveloppe.`
    : variation > 25
      ? "Regardez vos trois plus grosses dépenses de la semaine et voyez laquelle peut attendre."
      : "Continuez ainsi : mettez de côté ce qui reste dans vos enveloppes en fin de mois.";

  return {
    depensesSemaine: semaine,
    depensesSemainePrecedente: precedente,
    variation,
    meilleurPoint,
    pointDeVigilance,
    actionConseillee,
  };
}
