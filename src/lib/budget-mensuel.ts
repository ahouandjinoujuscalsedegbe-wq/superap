/**
 * Budget mensuel automatique de chaque enveloppe.
 *
 * Le budget est déduit de la période de renouvellement : quelle que soit la
 * périodicité choisie (jour, semaine, trimestre…), on ramène le montant versé
 * à son équivalent mensuel. Ce budget est ensuite comparé aux dépenses
 * réellement enregistrées sur l'enveloppe.
 *
 * Tout est calculé sur l'appareil, sans réseau.
 */

import type { Enveloppe, Periode, Transaction } from "./store";

/** Nombre de périodes contenues dans un mois moyen. */
export const PERIODES_PAR_MOIS: Record<Periode, number> = {
  jour: 365 / 12,
  semaine: 52 / 12,
  mois: 1,
  trimestre: 1 / 3,
  semestre: 1 / 6,
  annee: 1 / 12,
};

export type BudgetEnveloppe = {
  enveloppe: Enveloppe;
  /** Budget mensuel calculé à partir de la période de renouvellement. */
  budgetMensuel: number;
  /** Dépenses réelles du mois analysé. */
  depenseMois: number;
  /** Moyenne mensuelle des dépenses sur les 3 mois précédents. */
  moyenneDepense: number;
  /** depenseMois - budgetMensuel : positif = dépassement. */
  ecart: number;
  /** Part du budget consommée, en % (0 si pas de budget). */
  consommation: number;
  /** Origine du budget : période fixe, part de revenu, ou plafond faute de réglage. */
  source: "periode" | "revenu" | "plafond" | "aucune";
};

function moisDe(iso: string): string {
  return iso.slice(0, 7);
}

/** Mois AAAA-MM décalé de `pas` mois (pas négatif = passé). */
export function decalerMois(mois: string, pas: number): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + pas, 1));
  return d.toISOString().slice(0, 7);
}

/** Moyenne mensuelle des revenus observés (tous comptes), sur les mois vécus. */
export function revenuMensuelMoyen(transactions: Transaction[]): number {
  const parMois: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== "revenu") continue;
    const m = moisDe(t.date);
    parMois[m] = (parMois[m] ?? 0) + t.montant;
  }
  const mois = Object.keys(parMois);
  if (mois.length === 0) return 0;
  const total = mois.reduce((s, m) => s + parMois[m], 0);
  return Math.round(total / mois.length);
}

/** Budget mensuel d'une enveloppe déduit de sa période de renouvellement. */
export function budgetMensuelEnveloppe(
  e: Enveloppe,
  revenuMoyen: number,
): { montant: number; source: BudgetEnveloppe["source"] } {
  if ((e.modeRemplissage ?? "fixe") === "pourcentage") {
    const part = e.pourcentageRevenu ?? 0;
    if (part > 0 && revenuMoyen > 0) {
      return { montant: Math.round((revenuMoyen * part) / 100), source: "revenu" };
    }
    return { montant: 0, source: "aucune" };
  }

  const montantPeriode = e.montantPeriode ?? e.dotation ?? 0;
  const periode = e.periodeRenouvellement;
  if (periode && montantPeriode > 0) {
    return { montant: Math.round(montantPeriode * PERIODES_PAR_MOIS[periode]), source: "periode" };
  }
  if (e.plafond > 0) return { montant: Math.round(e.plafond), source: "plafond" };
  return { montant: 0, source: "aucune" };
}

/** Dépenses d'une enveloppe pour un mois AAAA-MM. */
export function depensesDuMois(
  e: Enveloppe,
  transactions: Transaction[],
  mois: string,
): number {
  return transactions
    .filter((t) => t.type === "depense" && t.categorie === e.nom && moisDe(t.date) === mois)
    .reduce((s, t) => s + t.montant, 0);
}

/**
 * Comparaison budget / dépenses réelles pour toutes les enveloppes,
 * triée du plus gros dépassement au plus gros reste.
 */
export function comparerBudgets(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  mois = new Date().toISOString().slice(0, 7),
): BudgetEnveloppe[] {
  const revenuMoyen = revenuMensuelMoyen(transactions);

  return enveloppes
    .map((e) => {
      const { montant: budgetMensuel, source } = budgetMensuelEnveloppe(e, revenuMoyen);
      const depenseMois = depensesDuMois(e, transactions, mois);
      const precedents = [1, 2, 3].map((i) => depensesDuMois(e, transactions, decalerMois(mois, -i)));
      const moyenneDepense = Math.round(precedents.reduce((s, x) => s + x, 0) / 3);
      return {
        enveloppe: e,
        budgetMensuel,
        depenseMois,
        moyenneDepense,
        ecart: depenseMois - budgetMensuel,
        consommation: budgetMensuel > 0 ? Math.round((depenseMois / budgetMensuel) * 100) : 0,
        source,
      };
    })
    .sort((a, b) => b.ecart - a.ecart);
}

/** Totaux du mois : budget global et dépenses globales. */
export function totauxBudget(lignes: BudgetEnveloppe[]) {
  const budget = lignes.reduce((s, l) => s + l.budgetMensuel, 0);
  const depense = lignes.reduce((s, l) => s + l.depenseMois, 0);
  return { budget, depense, ecart: depense - budget };
}
