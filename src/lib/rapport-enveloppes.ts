/**
 * Rapport d'utilisation quotidienne des enveloppes.
 *
 * Avant chaque renouvellement (le 1er du mois), l'application dresse, pour
 * chaque enveloppe, le relevé jour par jour du mois écoulé : montant versé,
 * dépenses de chaque journée, cumul et reste. Le rapport est ensuite classé
 * (archivé) sur l'appareil pour être consulté à tout moment.
 *
 * Tout est calculé et stocké localement, sans aucun réseau.
 */

import type { Enveloppe, Remplissage, Transaction } from "./store";

const CLE_ARCHIVES = "SA_RAPPORT_ENVELOPPES_V1";

export type JourEnveloppe = {
  /** Date du jour (AAAA-MM-JJ). */
  date: string;
  /** Numéro du jour dans le mois. */
  jour: number;
  /** Dépenses de la journée sur cette enveloppe. */
  depense: number;
  /** Nombre d'opérations de la journée. */
  operations: number;
  /** Cumul des dépenses depuis le 1er du mois. */
  cumul: number;
  /** Reste théorique après cette journée (versé − cumul). */
  reste: number;
};

export type RapportEnveloppe = {
  enveloppeId: string;
  nom: string;
  emoji: string;
  /** Total versé à l'enveloppe pendant le mois. */
  verse: number;
  /** Total dépensé pendant le mois. */
  depense: number;
  /** Nombre de jours où l'enveloppe a servi. */
  joursActifs: number;
  /** Dépense moyenne par jour du mois. */
  moyenneJour: number;
  /** Journée la plus dépensière (date), null si aucune dépense. */
  jourFort: string | null;
  /** Reste en fin de mois (versé − dépensé). */
  reste: number;
  jours: JourEnveloppe[];
};

export type RapportMoisEnveloppes = {
  /** Mois au format AAAA-MM. */
  mois: string;
  /** Date (ISO) à laquelle le rapport a été établi. */
  etabliLe: string;
  totalVerse: number;
  totalDepense: number;
  enveloppes: RapportEnveloppe[];
};

/** Nombre de jours du mois AAAA-MM. */
export function joursDuMois(mois: string): number {
  const [a, m] = mois.split("-").map(Number);
  return new Date(a ?? 1970, m ?? 1, 0).getDate();
}

export function moisCourant(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Mois précédant le mois donné (AAAA-MM). */
export function moisPrecedent(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date((a ?? 1970), (m ?? 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function libelleMois(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(a ?? 1970, (m ?? 1) - 1, 1);
  const texte = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Construit le rapport quotidien complet d'un mois donné. */
export function construireRapportMois(
  mois: string,
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  remplissages: Remplissage[],
): RapportMoisEnveloppes {
  const nbJours = joursDuMois(mois);
  const rapports: RapportEnveloppe[] = [];

  for (const e of enveloppes) {
    const verse = remplissages
      .filter((r) => r.enveloppeId === e.id && r.date.slice(0, 7) === mois)
      .reduce((s, r) => s + r.montant, 0);

    const depenses = transactions.filter(
      (t) => t.type === "depense" && t.categorie === e.nom && t.date.slice(0, 7) === mois,
    );

    let cumul = 0;
    let joursActifs = 0;
    let jourFort: string | null = null;
    let maxJour = 0;
    const jours: JourEnveloppe[] = [];

    for (let j = 1; j <= nbJours; j += 1) {
      const date = `${mois}-${String(j).padStart(2, "0")}`;
      const duJour = depenses.filter((t) => t.date.slice(0, 10) === date);
      const montant = duJour.reduce((s, t) => s + t.montant, 0);
      cumul += montant;
      if (montant > 0) joursActifs += 1;
      if (montant > maxJour) {
        maxJour = montant;
        jourFort = date;
      }
      jours.push({
        date,
        jour: j,
        depense: montant,
        operations: duJour.length,
        cumul,
        reste: verse - cumul,
      });
    }

    const depense = cumul;
    if (verse === 0 && depense === 0) continue;

    rapports.push({
      enveloppeId: e.id,
      nom: e.nom,
      emoji: e.emoji,
      verse,
      depense,
      joursActifs,
      moyenneJour: Math.round(depense / nbJours),
      jourFort,
      reste: verse - depense,
      jours,
    });
  }

  rapports.sort((a, b) => b.depense - a.depense);

  return {
    mois,
    etabliLe: new Date().toISOString(),
    totalVerse: rapports.reduce((s, r) => s + r.verse, 0),
    totalDepense: rapports.reduce((s, r) => s + r.depense, 0),
    enveloppes: rapports,
  };
}

/* ------------------------------------------------------------------ *
 * Classement (archivage) local des rapports
 * ------------------------------------------------------------------ */

export function lireArchives(): Record<string, RapportMoisEnveloppes> {
  if (typeof localStorage === "undefined") return {};
  try {
    const brut = localStorage.getItem(CLE_ARCHIVES);
    return brut ? (JSON.parse(brut) as Record<string, RapportMoisEnveloppes>) : {};
  } catch {
    return {};
  }
}

function ecrireArchives(archives: Record<string, RapportMoisEnveloppes>): void {
  if (typeof localStorage === "undefined") return;
  try {
    // On conserve les 24 derniers mois pour ne pas saturer l'appareil.
    const mois = Object.keys(archives).sort().slice(-24);
    const propre: Record<string, RapportMoisEnveloppes> = {};
    for (const m of mois) {
      const r = archives[m];
      if (r) propre[m] = r;
    }
    localStorage.setItem(CLE_ARCHIVES, JSON.stringify(propre));
  } catch {
    /* stockage saturé : le classement reprendra plus tard */
  }
}

/**
 * Classe le rapport d'un mois. Appelée juste avant chaque renouvellement :
 * le mois qui s'achève est figé une fois pour toutes.
 */
export function classerRapport(rapport: RapportMoisEnveloppes): void {
  const archives = lireArchives();
  archives[rapport.mois] = rapport;
  ecrireArchives(archives);
}

/**
 * Établit et classe, si ce n'est pas déjà fait, le rapport du mois précédent.
 * Appelée avant le renouvellement automatique des enveloppes.
 */
export function classerRapportAvantRenouvellement(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  remplissages: Remplissage[],
  maintenant = new Date(),
): RapportMoisEnveloppes | null {
  const mois = moisPrecedent(moisCourant(maintenant));
  const archives = lireArchives();
  if (archives[mois]) return archives[mois];
  const rapport = construireRapportMois(mois, enveloppes, transactions, remplissages);
  if (rapport.enveloppes.length === 0) return null;
  classerRapport(rapport);
  return rapport;
}

/** Liste des mois disponibles : archives classées + mois en cours. */
export function moisDisponibles(transactions: Transaction[], remplissages: Remplissage[]): string[] {
  const mois = new Set<string>(Object.keys(lireArchives()));
  for (const t of transactions) mois.add(t.date.slice(0, 7));
  for (const r of remplissages) mois.add(r.date.slice(0, 7));
  mois.add(moisCourant());
  return [...mois].sort((a, b) => b.localeCompare(a));
}
