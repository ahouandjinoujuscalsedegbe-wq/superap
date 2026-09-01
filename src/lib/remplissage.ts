/**
 * Renouvellement automatique du contenu des enveloppes.
 *
 * Règles voulues par l'utilisateur :
 * - chaque enveloppe peut avoir une période de renouvellement ;
 * - le contenu de la première période est saisi par l'utilisateur ;
 * - aux périodes suivantes, le montant se renouvelle seul, ajusté à
 *   l'habitude de dépense réellement observée sur l'enveloppe ;
 * - certaines enveloppes se remplissent avec un pourcentage de chaque revenu ;
 * - le montant versé est toujours débité du compte qui alimente l'enveloppe.
 *
 * Tout est calculé sur l'appareil, sans aucun réseau.
 */

import { avancerDate } from "./periodes";
import type { Enveloppe, Periode, Remplissage, Transaction } from "./store";

/** Nombre maximal de périodes rattrapées d'un coup (application restée fermée). */
const RATTRAPAGE_MAX = 24;
/** L'ajustement automatique ne fait jamais varier le montant de plus de 30 %. */
const VARIATION_MAX = 0.3;

export type RemplissageDu = {
  enveloppe: Enveloppe;
  compte: string;
  montant: number;
  /** Date (AAAA-MM-JJ) de la période renouvelée. */
  date: string;
};

function jour(iso: string): string {
  return iso.slice(0, 10);
}

/** Recule d'une période : avancerDate n'accepte que des pas positifs. */
function reculer(dateIso: string, periode: Periode): string {
  const d = new Date(`${jour(dateIso)}T12:00:00`);
  switch (periode) {
    case "jour":
      d.setDate(d.getDate() - 1);
      break;
    case "semaine":
      d.setDate(d.getDate() - 7);
      break;
    case "mois":
      d.setMonth(d.getMonth() - 1);
      break;
    case "trimestre":
      d.setMonth(d.getMonth() - 3);
      break;
    case "semestre":
      d.setMonth(d.getMonth() - 6);
      break;
    case "annee":
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/** Dépenses de l'enveloppe entre deux dates (bornes incluses côté début). */
function depensesEntre(
  enveloppe: Enveloppe,
  transactions: Transaction[],
  debut: string,
  fin: string,
): number {
  return transactions
    .filter(
      (t) =>
        t.type === "depense" &&
        t.categorie === enveloppe.nom &&
        jour(t.date) >= debut &&
        jour(t.date) < fin,
    )
    .reduce((s, t) => s + t.montant, 0);
}

/**
 * Montant à verser pour la prochaine période.
 *
 * Base : le montant précisé par l'utilisateur. Si l'ajustement automatique est
 * actif, ce montant glisse vers la dépense moyenne réellement constatée sur les
 * périodes précédentes, sans jamais s'en écarter de plus de 30 % d'un coup.
 */
export function montantPeriodeSuivante(
  enveloppe: Enveloppe,
  transactions: Transaction[],
  finPeriode: string,
): number {
  const base = enveloppe.montantPeriode ?? enveloppe.dotation ?? enveloppe.plafond;
  if (!(base > 0)) return 0;
  if (!enveloppe.ajustementAuto || !enveloppe.periodeRenouvellement) return Math.round(base);

  // Habitude de dépense : moyenne des 3 dernières périodes réellement vécues.
  const periode = enveloppe.periodeRenouvellement;
  let fin = finPeriode;
  const observees: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const debut = reculer(fin, periode);
    const depense = depensesEntre(enveloppe, transactions, debut, fin);
    if (depense > 0) observees.push(depense);
    fin = debut;
  }
  if (observees.length === 0) return Math.round(base);

  const moyenne = observees.reduce((s, x) => s + x, 0) / observees.length;
  const plancher = base * (1 - VARIATION_MAX);
  const plafond = base * (1 + VARIATION_MAX);
  return Math.round(Math.min(plafond, Math.max(plancher, moyenne)));
}

/** Montant versé à l'enveloppe quand un revenu arrive (mode pourcentage). */
export function montantSurRevenu(enveloppe: Enveloppe, revenu: number): number {
  if (enveloppe.modeRemplissage !== "pourcentage") return 0;
  const part = enveloppe.pourcentageRevenu ?? 0;
  if (!(part > 0) || !(revenu > 0)) return 0;
  return Math.round((revenu * part) / 100);
}

/**
 * Renouvellements arrivés à échéance et pas encore appliqués.
 * Une enveloppe sans période, sans compte source ou en mode pourcentage
 * n'est jamais renouvelée par le temps.
 */
export function remplissagesDus(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  maintenant = new Date(),
): RemplissageDu[] {
  const aujourdHui = maintenant.toISOString().slice(0, 10);
  const dus: RemplissageDu[] = [];

  for (const e of enveloppes) {
    const periode = e.periodeRenouvellement;
    if (!periode || !e.compteSource) continue;
    if ((e.modeRemplissage ?? "fixe") !== "fixe") continue;
    // Règle : le renouvellement automatique n'a lieu qu'à partir de la date
    // précisée par l'utilisateur dans les paramètres de l'enveloppe.
    const depart = e.dateRenouvellement ? jour(e.dateRenouvellement) : null;
    if (!depart) continue;

    // On repart de la date choisie, ou de la période suivant le dernier
    // remplissage déjà appliqué s'il est postérieur.
    let date = depart;
    if (e.dernierRemplissage && jour(e.dernierRemplissage) >= depart) {
      date = jour(avancerDate(e.dernierRemplissage, periode));
    }
    let tours = 0;
    while (date <= aujourdHui && tours < RATTRAPAGE_MAX) {
      const montant = montantPeriodeSuivante(e, transactions, date);
      if (montant > 0) dus.push({ enveloppe: e, compte: e.compteSource, montant, date });
      date = jour(avancerDate(`${date}T12:00:00`, periode));
      tours += 1;
    }
  }
  return dus;
}

/** Prochaine date de renouvellement d'une enveloppe, si elle en a une. */
export function prochainRenouvellement(e: Enveloppe): string | null {
  const periode = e.periodeRenouvellement;
  if (!periode || !e.dateRenouvellement) return null;
  const depart = jour(e.dateRenouvellement);
  if (!e.dernierRemplissage || jour(e.dernierRemplissage) < depart) return depart;
  return jour(avancerDate(e.dernierRemplissage, periode));
}

/** Total déjà versé dans une enveloppe depuis sa création. */
export function totalVerse(enveloppeId: string, remplissages: Remplissage[]): number {
  return remplissages.filter((r) => r.enveloppeId === enveloppeId).reduce((s, r) => s + r.montant, 0);
}

export const LABELS_PERIODE: Record<Periode, string> = {
  jour: "chaque jour",
  semaine: "chaque semaine",
  mois: "chaque mois",
  trimestre: "chaque trimestre",
  semestre: "chaque semestre",
  annee: "chaque année",
};
