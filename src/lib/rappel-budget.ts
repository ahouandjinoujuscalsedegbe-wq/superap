/**
 * Rappel du budget mensuel.
 *
 * Après le renouvellement automatique des enveloppes (le 1er de chaque mois),
 * l'application rappelle à l'utilisateur de vérifier son budget :
 * - une alarme sonne toutes les 6 heures pendant les deux premiers jours du
 *   mois (soit 8 rappels : 0 h, 6 h, 12 h, 18 h de chaque jour) ;
 * - chaque sonnerie dure jusqu'à 5 minutes si personne n'y touche ;
 * - si le budget n'a pas été modifié à la fin du 2e jour, la proposition de
 *   l'intelligence locale est appliquée d'office et les rappels s'arrêtent
 *   jusqu'au mois suivant.
 *
 * Tout est stocké et calculé sur l'appareil.
 */

const CLE = "SA_RAPPEL_BUDGET_V1";

/** Heures de sonnerie, chaque jour concerné. */
export const HEURES_RAPPEL = [0, 6, 12, 18] as const;
/** Nombre de jours (à partir du 1er) où l'alarme rappelle l'utilisateur. */
export const JOURS_RAPPEL = 2;
/** Durée maximale d'une sonnerie non touchée (5 minutes). */
export const DUREE_SONNERIE_MS = 5 * 60_000;

export type StatutBudgetMois = "attente" | "modifie" | "auto";

export type EtatRappelBudget = {
  /** Mois concerné, au format AAAA-MM. */
  mois: string;
  statut: StatutBudgetMois;
  /** Créneaux déjà sonnés, sous la forme « jour-heure ». */
  sonnes: string[];
};

export function moisDe(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function etatVierge(mois: string): EtatRappelBudget {
  return { mois, statut: "attente", sonnes: [] };
}

export function lireEtatRappel(maintenant = new Date()): EtatRappelBudget {
  const mois = moisDe(maintenant);
  if (typeof localStorage === "undefined") return etatVierge(mois);
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return etatVierge(mois);
    const objet = JSON.parse(brut) as Partial<EtatRappelBudget>;
    if (objet.mois !== mois) return etatVierge(mois);
    return {
      mois,
      statut: objet.statut === "modifie" || objet.statut === "auto" ? objet.statut : "attente",
      sonnes: Array.isArray(objet.sonnes) ? objet.sonnes.filter((s) => typeof s === "string") : [],
    };
  } catch {
    return etatVierge(mois);
  }
}

export function ecrireEtatRappel(etat: EtatRappelBudget): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    /* stockage saturé : le rappel reprendra au prochain démarrage */
  }
}

/** L'utilisateur a lui-même revu son budget : plus aucun rappel ce mois-ci. */
export function marquerBudgetModifie(maintenant = new Date()): void {
  const etat = lireEtatRappel(maintenant);
  ecrireEtatRappel({ ...etat, statut: "modifie" });
}

/** La proposition automatique a été retenue faute de modification. */
export function marquerBudgetAutomatique(maintenant = new Date()): void {
  const etat = lireEtatRappel(maintenant);
  ecrireEtatRappel({ ...etat, statut: "auto" });
}

/** Identifiant du créneau de rappel en cours, ou null hors créneau. */
export function creneauCourant(maintenant = new Date()): string | null {
  const jour = maintenant.getDate();
  if (jour > JOURS_RAPPEL) return null;
  const heure = maintenant.getHours();
  const debut = [...HEURES_RAPPEL].reverse().find((h) => heure >= h);
  if (debut === undefined) return null;
  return `${jour}-${debut}`;
}

/** true quand la période des deux premiers jours est terminée. */
export function periodeRappelTerminee(maintenant = new Date()): boolean {
  return maintenant.getDate() > JOURS_RAPPEL;
}

/** Doit-on déclencher une sonnerie maintenant ? */
export function sonnerieADeclencher(maintenant = new Date()): string | null {
  const etat = lireEtatRappel(maintenant);
  if (etat.statut !== "attente") return null;
  const creneau = creneauCourant(maintenant);
  if (!creneau || etat.sonnes.includes(creneau)) return null;
  return creneau;
}

/** Mémorise qu'un créneau a sonné (une seule sonnerie par créneau). */
export function marquerCreneauSonne(creneau: string, maintenant = new Date()): void {
  const etat = lireEtatRappel(maintenant);
  if (etat.sonnes.includes(creneau)) return;
  ecrireEtatRappel({ ...etat, sonnes: [...etat.sonnes, creneau] });
}

/* ------------------------------------------------------------------ *
 * Rappel de fin de période budgétaire
 * ------------------------------------------------------------------ *
 * Quand l'utilisateur applique un budget pour une période donnée
 * (date de départ → date de fin), l'application le prévient AVANT le
 * terme pour qu'il renouvelle son budget : 7 jours, 3 jours, 1 jour
 * avant, puis le jour même. Chaque rappel ne sonne qu'une seule fois.
 */

const CLE_PERIODE = "SA_PERIODE_BUDGET_V1";

/** Jours restants déclenchant un rappel avant la fin du budget. */
export const PREAVIS_FIN_BUDGET = [7, 3, 1, 0] as const;

export type PeriodeBudget = {
  /** Date de départ AAAA-MM-JJ. */
  debut: string;
  /** Date de fin AAAA-MM-JJ. */
  fin: string;
  /** Préavis déjà sonnés (en jours restants). */
  sonnes: number[];
  /** L'utilisateur a renouvelé son budget : plus aucun rappel. */
  renouvele?: boolean;
};

function jourISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function lirePeriodeBudget(): PeriodeBudget | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const brut = localStorage.getItem(CLE_PERIODE);
    if (!brut) return null;
    const objet = JSON.parse(brut) as Partial<PeriodeBudget>;
    if (typeof objet.debut !== "string" || typeof objet.fin !== "string") return null;
    return {
      debut: objet.debut,
      fin: objet.fin,
      sonnes: Array.isArray(objet.sonnes) ? objet.sonnes.filter((n) => typeof n === "number") : [],
      renouvele: objet.renouvele === true,
    };
  } catch {
    return null;
  }
}

function ecrirePeriodeBudget(periode: PeriodeBudget): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLE_PERIODE, JSON.stringify(periode));
  } catch {
    /* stockage saturé : le rappel reprendra plus tard */
  }
}

/** Mémorise la période d'application du budget qui vient d'être appliqué. */
export function enregistrerPeriodeBudget(debut: string, fin: string): void {
  ecrirePeriodeBudget({ debut, fin, sonnes: [], renouvele: false });
}

/** Nombre de jours restants avant la fin du budget (négatif si dépassé). */
export function joursAvantFinBudget(periode: PeriodeBudget, maintenant = new Date()): number {
  const fin = new Date(`${periode.fin}T12:00:00`).getTime();
  const jour = new Date(`${jourISO(maintenant)}T12:00:00`).getTime();
  return Math.round((fin - jour) / 86_400_000);
}

/** Préavis à sonner maintenant, ou null s'il n'y a rien à rappeler. */
export function preavisFinADeclencher(maintenant = new Date()): number | null {
  const periode = lirePeriodeBudget();
  if (!periode || periode.renouvele) return null;
  const restants = joursAvantFinBudget(periode, maintenant);
  if (restants < 0) return null;
  const preavis = PREAVIS_FIN_BUDGET.find((p) => restants <= p);
  if (preavis === undefined || periode.sonnes.includes(preavis)) return null;
  return preavis;
}

/** Mémorise qu'un préavis a déjà sonné. */
export function marquerPreavisFinSonne(preavis: number): void {
  const periode = lirePeriodeBudget();
  if (!periode || periode.sonnes.includes(preavis)) return;
  ecrirePeriodeBudget({ ...periode, sonnes: [...periode.sonnes, preavis] });
}

/** L'utilisateur a renouvelé son budget : les rappels de fin s'arrêtent. */
export function marquerBudgetRenouvele(): void {
  const periode = lirePeriodeBudget();
  if (!periode) return;
  ecrirePeriodeBudget({ ...periode, renouvele: true });
}
