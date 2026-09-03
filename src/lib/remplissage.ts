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

import { coefficientSaisonEnveloppe } from "./saison";
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
 * périodes précédentes, sans jamais s'écarter de plus de 30 % **du dernier
 * montant réellement versé** : mois après mois, la dotation rejoint donc
 * l'habitude réelle du foyer au lieu de rester bloquée autour du tout premier
 * montant saisi.
 */
export function montantPeriodeSuivante(
  enveloppe: Enveloppe,
  transactions: Transaction[],
  finPeriode: string,
  dernierVerse?: number,
): number {
  const base = enveloppe.montantPeriode ?? enveloppe.dotation ?? enveloppe.plafond;
  if (!(base > 0)) return 0;
  // Point de départ de la variation : le dernier versement réel s'il existe.
  const reference = dernierVerse && dernierVerse > 0 ? dernierVerse : base;

  /* Ajustement de saison : les périodes d'activité (rentrée, fêtes, pluies)
     reçoivent plus, les mois calmes moins. Coefficient appris sur l'historique
     des années précédentes, 1 quand il n'y en a pas encore. */
  const saison = coefficientSaisonEnveloppe(enveloppe, transactions, finPeriode);
  const borner = (montant: number) =>
    Math.round(
      Math.min(reference * (1 + VARIATION_MAX), Math.max(reference * (1 - VARIATION_MAX), montant)),
    );

  if (!enveloppe.ajustementAuto) return saison === 1 ? Math.round(base) : borner(base * saison);

  // Habitude de dépense : moyenne des 3 derniers mois réellement vécus.
  const periode: Periode = "mois";

  let fin = finPeriode;
  const observees: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const debut = reculer(fin, periode);
    const depense = depensesEntre(enveloppe, transactions, debut, fin);
    if (depense > 0) observees.push(depense);
    fin = debut;
  }
  if (observees.length === 0) return borner(base * saison);

  const moyenne = observees.reduce((s, x) => s + x, 0) / observees.length;
  return borner(moyenne * saison);
}

/** Montant versé à l'enveloppe quand un revenu arrive (mode pourcentage). */
export function montantSurRevenu(enveloppe: Enveloppe, revenu: number): number {
  if (enveloppe.modeRemplissage !== "pourcentage") return 0;
  const part = enveloppe.pourcentageRevenu ?? 0;
  if (!(part > 0) || !(revenu > 0)) return 0;
  return Math.round((revenu * part) / 100);
}

/** Premier jour du mois contenant la date donnée (AAAA-MM-01). */
function premierDuMois(dateIso: string): string {
  return `${jour(dateIso).slice(0, 7)}-01`;
}

/** Premier jour du mois suivant. */
function premierDuMoisSuivant(dateIso: string): string {
  const d = new Date(`${premierDuMois(dateIso)}T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Renouvellements arrivés à échéance et pas encore appliqués.
 *
 * Règle unique voulue par l'utilisateur : le contenu de chaque enveloppe se
 * renouvelle le premier jour de chaque mois, sans exception et sans date à
 * préciser. Seules les enveloppes alimentées par un pourcentage de revenu
 * gardent leur propre mécanique (elles se remplissent à chaque revenu).
 */
export function remplissagesDus(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  maintenant = new Date(),
  remplissages: { enveloppeId: string; montant: number; date: string }[] = [],
): RemplissageDu[] {
  const aujourdHui = maintenant.toISOString().slice(0, 10);
  const dus: RemplissageDu[] = [];

  for (const e of enveloppes) {
    if (!e.compteSource) continue;
    if ((e.modeRemplissage ?? "fixe") !== "fixe") continue;

    // Dernier montant réellement versé dans cette enveloppe : c'est autour de
    // lui que la variation maximale est calculée.
    let dernierVerse = 0;
    let derniereDate = "";
    for (const r of remplissages) {
      if (r.enveloppeId === e.id && r.date >= derniereDate) {
        derniereDate = r.date;
        dernierVerse = r.montant;
      }
    }

    // Départ : le 1er du mois en cours, ou le 1er du mois suivant le dernier
    // remplissage déjà appliqué.
    let date = e.dernierRemplissage
      ? premierDuMoisSuivant(e.dernierRemplissage)
      : premierDuMois(aujourdHui);

    let tours = 0;
    while (date <= aujourdHui && tours < RATTRAPAGE_MAX) {
      const montant = montantPeriodeSuivante(e, transactions, date, dernierVerse);
      if (montant > 0) {
        dus.push({ enveloppe: e, compte: e.compteSource, montant, date });
        // Rattrapage de plusieurs mois : chaque tour part du montant précédent.
        dernierVerse = montant;
      }
      date = premierDuMoisSuivant(date);
      tours += 1;
    }
  }
  return dus;
}

/** Prochaine date de renouvellement : toujours le 1er du mois suivant. */
export function prochainRenouvellement(e: Enveloppe): string | null {
  if (!e.compteSource || (e.modeRemplissage ?? "fixe") !== "fixe") return null;
  const aujourdHui = new Date().toISOString().slice(0, 10);
  if (!e.dernierRemplissage) {
    const premier = premierDuMois(aujourdHui);
    return premier <= aujourdHui ? premier : premierDuMoisSuivant(aujourdHui);
  }
  return premierDuMoisSuivant(e.dernierRemplissage);
}

/** Total déjà versé dans une enveloppe depuis sa création. */
export function totalVerse(enveloppeId: string, remplissages: Remplissage[]): number {
  return remplissages
    .filter((r) => r.enveloppeId === enveloppeId)
    .reduce((s, r) => s + r.montant, 0);
}

export const LABELS_PERIODE: Record<Periode, string> = {
  jour: "chaque jour",
  semaine: "chaque semaine",
  mois: "chaque mois",
  trimestre: "chaque trimestre",
  semestre: "chaque semestre",
  annee: "chaque année",
};
