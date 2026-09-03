/**
 * Apprentissage du conseiller : il ne reste jamais figé.
 *
 * Le conseiller observe l'effet de ses propres messages (lus, jugés utiles ou
 * inutiles), en tire des poids par thème, ajuste sa cadence et son insistance,
 * puis se met en réseau avec les autres intelligences locales de
 * l'application (lecture des tickets, lecture des SMS, budget automatique)
 * pour parler de ce qui compte vraiment. Tout est calculé et stocké sur
 * l'appareil : aucune donnée ne sort.
 */

import { fiabiliteOcr, lireMemoireOcr } from "@/lib/ocr-apprentissage";
import { statsSms, tauxJustesse, tauxReconnaissance } from "@/lib/sms-transactions";
import { chargerPreferencesBudget } from "@/lib/budget-auto";

const CLE_PROFIL = "super-app:apprentissage-conseiller";

/** Thèmes suivis par le conseiller. */
export type ThemeConseiller =
  | "operations"
  | "objectifs"
  | "budget"
  | "epargne"
  | "alerte"
  | "point"
  | "collaboration"
  | "general";

export type StatTheme = {
  envoyes: number;
  utiles: number;
  inutiles: number;
};

export type ProfilConseiller = {
  themes: Record<string, StatTheme>;
  /** Nombre total de retours reçus : mesure de maturité du conseiller. */
  retours: number;
  /** Jour du dernier bilan de collaboration entre intelligences. */
  dernierBilanIa: string;
};

export const PROFIL_VIDE: ProfilConseiller = { themes: {}, retours: 0, dernierBilanIa: "" };

function assainir(brut: unknown): ProfilConseiller {
  if (!brut || typeof brut !== "object") return PROFIL_VIDE;
  const o = brut as Partial<ProfilConseiller>;
  const themes: Record<string, StatTheme> = {};
  if (o.themes && typeof o.themes === "object") {
    for (const [cle, valeur] of Object.entries(o.themes)) {
      const v = valeur as Partial<StatTheme>;
      themes[cle] = {
        envoyes: Number(v?.envoyes) || 0,
        utiles: Number(v?.utiles) || 0,
        inutiles: Number(v?.inutiles) || 0,
      };
    }
  }
  return {
    themes,
    retours: Number(o.retours) || 0,
    dernierBilanIa: typeof o.dernierBilanIa === "string" ? o.dernierBilanIa : "",
  };
}

export function lireProfilConseiller(): ProfilConseiller {
  if (typeof window === "undefined") return PROFIL_VIDE;
  try {
    const brut = window.localStorage.getItem(CLE_PROFIL);
    return brut ? assainir(JSON.parse(brut)) : PROFIL_VIDE;
  } catch {
    return PROFIL_VIDE;
  }
}

export function ecrireProfilConseiller(profil: ProfilConseiller): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_PROFIL, JSON.stringify(profil));
  } catch {
    /* stockage plein : l'apprentissage reprendra plus tard */
  }
}

/** Déduit le thème d'une publication à partir de son identifiant. */
export function themeDeIdentifiant(id: string): ThemeConseiller {
  if (id.startsWith("operations")) return "operations";
  if (id.startsWith("objectif")) return "objectifs";
  if (id.startsWith("point")) return "point";
  if (id.startsWith("collaboration")) return "collaboration";
  if (id.startsWith("constat")) return "alerte";
  return "general";
}

/** Déduit le thème d'un message affiché dans la discussion. */
export function themeDeTexte(texte: string): ThemeConseiller {
  const t = texte.toLowerCase();
  if (t.includes("objectif")) return "objectifs";
  if (t.includes("budget")) return "budget";
  if (t.includes("épargne") || t.includes("epargne")) return "epargne";
  if (t.includes("opération") || t.includes("operation") || t.includes("transaction"))
    return "operations";
  if (t.includes("point du jour")) return "point";
  if (t.includes("apprentissage") || t.includes("intelligence")) return "collaboration";
  if (t.includes("alerte") || t.includes("attention") || t.includes("dépassement"))
    return "alerte";
  return "general";
}

function stat(profil: ProfilConseiller, theme: string): StatTheme {
  return profil.themes[theme] ?? { envoyes: 0, utiles: 0, inutiles: 0 };
}

/** Enregistre les thèmes envoyés lors d'un passage de veille. */
export function noterEnvois(themes: string[], profil = lireProfilConseiller()): ProfilConseiller {
  const suivant: ProfilConseiller = { ...profil, themes: { ...profil.themes } };
  for (const theme of themes) {
    const s = stat(suivant, theme);
    suivant.themes[theme] = { ...s, envoyes: s.envoyes + 1 };
  }
  ecrireProfilConseiller(suivant);
  return suivant;
}

/** Un « utile » ou « inutile » de l'utilisateur fait progresser le conseiller. */
export function noterAvisConseiller(
  texte: string,
  avis: "utile" | "inutile",
  profil = lireProfilConseiller(),
): ProfilConseiller {
  const theme = themeDeTexte(texte);
  const s = stat(profil, theme);
  const suivant: ProfilConseiller = {
    themes: {
      ...profil.themes,
      [theme]: {
        envoyes: Math.max(s.envoyes, 1),
        utiles: s.utiles + (avis === "utile" ? 1 : 0),
        inutiles: s.inutiles + (avis === "inutile" ? 1 : 0),
      },
    },
    retours: profil.retours + 1,
    dernierBilanIa: profil.dernierBilanIa,
  };
  ecrireProfilConseiller(suivant);
  return suivant;
}

/**
 * Poids appris d'un thème : 0,4 (le conseiller se tait presque) à 1,6 (il
 * insiste). Sans retour, le poids reste neutre à 1.
 */
export function poidsTheme(profil: ProfilConseiller, theme: string): number {
  const s = stat(profil, theme);
  const total = s.utiles + s.inutiles;
  if (total === 0) return 1;
  const score = (s.utiles - s.inutiles) / total;
  return Math.max(0.4, Math.min(1.6, 1 + score * 0.6));
}

/** Cadence apprise : nombre maximal de messages par passage (2 à 6). */
export function cadenceApprise(profil: ProfilConseiller): number {
  const totaux = Object.values(profil.themes).reduce(
    (acc, s) => ({ utiles: acc.utiles + s.utiles, inutiles: acc.inutiles + s.inutiles }),
    { utiles: 0, inutiles: 0 },
  );
  const total = totaux.utiles + totaux.inutiles;
  if (total < 3) return 4;
  const score = (totaux.utiles - totaux.inutiles) / total;
  return Math.max(2, Math.min(6, Math.round(4 + score * 2)));
}

export type CollaborationIa = {
  /** Justesse de la lecture des tickets, en pourcentage (0 si inconnue). */
  ocr: number;
  ticketsAppris: number;
  /** Reconnaissance et justesse de la lecture des SMS, en pourcentage. */
  smsReconnaissance: number;
  smsJustesse: number;
  /** Nombre d'enveloppes dont le budget automatique a appris vos corrections. */
  budgetCorrige: number;
  /** Maturité globale du réseau d'intelligences, en pourcentage. */
  maturite: number;
};

/** Lit l'état des autres intelligences locales pour travailler avec elles. */
export function lireCollaborationIa(): CollaborationIa {
  let ocr = 0;
  let ticketsAppris = 0;
  let smsReconnaissance = 0;
  let smsJustesse = 0;
  let budgetCorrige = 0;
  try {
    const memoire = lireMemoireOcr();
    const f = fiabiliteOcr(memoire);
    ocr = f.tauxSansCorrection;
    ticketsAppris = f.lectures;
  } catch {
    /* module indisponible : la collaboration continue sans lui */
  }
  try {
    const s = statsSms();
    smsReconnaissance = Math.round(tauxReconnaissance(s) * 100);
    smsJustesse = Math.round(tauxJustesse(s) * 100);
  } catch {
    /* idem */
  }
  try {
    budgetCorrige = Object.keys(chargerPreferencesBudget()).length;
  } catch {
    /* idem */
  }
  const mesures = [ocr, smsJustesse, smsReconnaissance].filter((v) => v > 0);
  const maturite =
    mesures.length > 0 ? Math.round(mesures.reduce((s, v) => s + v, 0) / mesures.length) : 0;
  return { ocr, ticketsAppris, smsReconnaissance, smsJustesse, budgetCorrige, maturite };
}

export type BilanCollaboration = {
  id: string;
  titre: string;
  texte: string;
  details: string[];
};

/**
 * Bilan quotidien du travail commun entre le conseiller et les autres
 * intelligences. Renvoie `null` si le bilan du jour a déjà été fait.
 */
export function bilanCollaboration(
  profil = lireProfilConseiller(),
  collab = lireCollaborationIa(),
  maintenant = new Date(),
): { bilan: BilanCollaboration | null; profil: ProfilConseiller } {
  const jour = maintenant.toISOString().slice(0, 10);
  if (profil.dernierBilanIa === jour) return { bilan: null, profil };
  if (collab.maturite === 0 && collab.budgetCorrige === 0 && profil.retours === 0) {
    return { bilan: null, profil };
  }
  const details = [
    collab.ocr > 0
      ? `Lecture des tickets : ${collab.ocr} % de justesse sur ${collab.ticketsAppris} ticket(s) appris.`
      : "Lecture des tickets : pas encore d'apprentissage.",
    collab.smsReconnaissance > 0
      ? `Lecture des SMS : ${collab.smsReconnaissance} % reconnus, ${collab.smsJustesse} % justes.`
      : "Lecture des SMS : pas encore de message analysé.",
    collab.budgetCorrige > 0
      ? `Budget automatique : ${collab.budgetCorrige} enveloppe(s) ajustée(s) d'après vos corrections.`
      : "Budget automatique : aucune correction mémorisée pour l'instant.",
    `Vos retours reçus : ${profil.retours} (ils règlent mon ton et ma fréquence).`,
  ];
  const conseils: string[] = [];
  if (collab.ocr > 0 && collab.ocr < 80) conseils.push("corrigez un ticket mal lu");
  if (collab.smsJustesse > 0 && collab.smsJustesse < 85)
    conseils.push("confirmez un message de transaction");
  if (collab.budgetCorrige === 0) conseils.push("ajustez une proposition de budget");
  const texte =
    `Je progresse avec les autres intelligences de l'application : maturité commune ${collab.maturite} %.` +
    (conseils.length > 0 ? ` Pour m'améliorer encore : ${conseils.join(", ")}.` : "");
  return {
    bilan: { id: `collaboration-${jour}`, titre: "Ce que j'ai appris", texte, details },
    profil: { ...profil, dernierBilanIa: jour },
  };
}
