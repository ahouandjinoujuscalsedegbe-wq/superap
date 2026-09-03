/**
 * Suivi : dépenses réelles comparées aux dépenses planifiées.
 *
 * Pour un mois donné, on calcule ce qui était planifié (à partir des dépenses
 * planifiées de la Budgétisation) et ce qui a réellement été dépensé
 * (transactions saisies), enveloppe par enveloppe et ligne par ligne.
 *
 * Tout est calculé sur l'appareil, sans réseau.
 */

import type { Budget, Enveloppe, Transaction } from "./store";
import { avancerDate } from "./periodes";

export type LignePlanifiee = {
  budget: Budget;
  /** Date d'échéance dans le mois (AAAA-MM-JJ). */
  date: string;
};

export type DepenseReelle = {
  transaction: Transaction;
  /** Enveloppe correspondante si elle existe encore. */
  enveloppe: Enveloppe | undefined;
};

export type ComparaisonEnveloppe = {
  /** Nom de l'enveloppe (ou « Sans enveloppe »). */
  nom: string;
  emoji: string;
  planifie: number;
  reel: number;
  /** reel - planifie : positif = dépassement. */
  ecart: number;
};

const SANS_ENVELOPPE = "Sans enveloppe";

/** Échéances planifiées tombant dans le mois AAAA-MM. */
export function echeancesDuMois(budgets: Budget[], mois: string): LignePlanifiee[] {
  const lignes: LignePlanifiee[] = [];
  for (const b of budgets) {
    if (!b.actif) continue;
    if (b.ponctuel) {
      if (b.prochaine.slice(0, 7) === mois) lignes.push({ budget: b, date: b.prochaine });
      continue;
    }
    let date = b.debut ?? b.prochaine;
    for (let i = 0; i < 400 && date.slice(0, 7) <= mois; i += 1) {
      if (b.fin && date > b.fin) break;
      if (date.slice(0, 7) === mois) lignes.push({ budget: b, date });
      const suivante = avancerDate(date, b.periode, b.intervalle);
      if (suivante <= date) break;
      date = suivante;
    }
  }
  return lignes.sort((a, z) => a.date.localeCompare(z.date));
}

/** Dépenses réellement saisies pendant le mois AAAA-MM. */
export function depensesDuMois(
  transactions: Transaction[],
  enveloppes: Enveloppe[],
  mois: string,
): DepenseReelle[] {
  return transactions
    .filter((t) => t.type === "depense" && t.date.slice(0, 7) === mois)
    .map((t) => ({ transaction: t, enveloppe: enveloppes.find((e) => e.nom === t.categorie) }))
    .sort((a, z) => z.transaction.date.localeCompare(a.transaction.date));
}

/** Comparaison planifié / réel, enveloppe par enveloppe, pour un mois. */
export function comparerPlanifieEtReel(
  budgets: Budget[],
  transactions: Transaction[],
  enveloppes: Enveloppe[],
  mois: string,
): ComparaisonEnveloppe[] {
  const par = new Map<string, ComparaisonEnveloppe>();
  const ligne = (nom: string, emoji: string) => {
    const existante = par.get(nom);
    if (existante) return existante;
    const creee: ComparaisonEnveloppe = { nom, emoji, planifie: 0, reel: 0, ecart: 0 };
    par.set(nom, creee);
    return creee;
  };

  for (const l of echeancesDuMois(budgets, mois)) {
    const env = enveloppes.find((e) => e.id === l.budget.enveloppeId);
    ligne(env?.nom ?? SANS_ENVELOPPE, env?.emoji ?? "📄").planifie += l.budget.montant;
  }

  for (const d of depensesDuMois(transactions, enveloppes, mois)) {
    const nom = d.enveloppe?.nom ?? (d.transaction.categorie || SANS_ENVELOPPE);
    ligne(nom, d.enveloppe?.emoji ?? "📄").reel += d.transaction.montant;
  }

  return [...par.values()]
    .map((l) => ({ ...l, ecart: l.reel - l.planifie }))
    .sort((a, z) => z.planifie + z.reel - (a.planifie + a.reel));
}

/** Axes de comparaison possibles entre planifié et réel. */
export type AxeSuivi = "enveloppe" | "libelle" | "sous-categorie" | "categorie";

export const AXES_SUIVI: ReadonlyArray<{ axe: AxeSuivi; titre: string; detail: string }> = [
  {
    axe: "enveloppe",
    titre: "Enveloppe par enveloppe",
    detail: "Comparer le planifié et le réel pour chaque enveloppe.",
  },
  {
    axe: "libelle",
    titre: "Dépense par dépense",
    detail: "Comparer chaque dépense selon son libellé.",
  },
  {
    axe: "sous-categorie",
    titre: "Sous-catégorie par sous-catégorie",
    detail: "Regrouper les montants par sous-catégorie d'enveloppe.",
  },
  {
    axe: "categorie",
    titre: "Catégorie par catégorie",
    detail: "Vue d'ensemble par grande catégorie d'enveloppe.",
  },
];

export type LigneSuivi = {
  /** Libellé de la ligne (planifié ou réel). */
  libelle: string;
  date: string;
  montant: number;
  origine: "planifie" | "reel";
};

export type GroupeSuivi = {
  cle: string;
  emoji: string;
  planifie: number;
  reel: number;
  ecart: number;
  lignes: LigneSuivi[];
};

function cleDe(axe: AxeSuivi, env: Enveloppe | undefined, libelle: string): string {
  if (axe === "enveloppe") return env?.nom ?? SANS_ENVELOPPE;
  if (axe === "libelle") return libelle.trim() || "Sans libellé";
  if (axe === "sous-categorie") return env?.sousCategorie?.trim() || "Sans sous-catégorie";
  return env?.categorie?.trim() || "Sans catégorie";
}

/** Comparaison planifié / réel d'un mois, regroupée selon l'axe demandé. */
export function comparerParAxe(
  budgets: Budget[],
  transactions: Transaction[],
  enveloppes: Enveloppe[],
  mois: string,
  axe: AxeSuivi,
): GroupeSuivi[] {
  const par = new Map<string, GroupeSuivi>();
  const groupe = (cle: string, emoji: string) => {
    const existant = par.get(cle);
    if (existant) return existant;
    const cree: GroupeSuivi = { cle, emoji, planifie: 0, reel: 0, ecart: 0, lignes: [] };
    par.set(cle, cree);
    return cree;
  };

  for (const l of echeancesDuMois(budgets, mois)) {
    const env = enveloppes.find((e) => e.id === l.budget.enveloppeId);
    const g = groupe(cleDe(axe, env, l.budget.libelle), env?.emoji ?? "📄");
    g.planifie += l.budget.montant;
    g.lignes.push({
      libelle: l.budget.libelle,
      date: l.date,
      montant: l.budget.montant,
      origine: "planifie",
    });
  }

  for (const d of depensesDuMois(transactions, enveloppes, mois)) {
    const g = groupe(
      cleDe(axe, d.enveloppe, d.transaction.libelle),
      d.enveloppe?.emoji ?? "📄",
    );
    g.reel += d.transaction.montant;
    g.lignes.push({
      libelle: d.transaction.libelle,
      date: d.transaction.date,
      montant: d.transaction.montant,
      origine: "reel",
    });
  }

  return [...par.values()]
    .map((g) => ({
      ...g,
      ecart: g.reel - g.planifie,
      lignes: g.lignes.sort((a, z) => a.date.localeCompare(z.date)),
    }))
    .sort((a, z) => z.planifie + z.reel - (a.planifie + a.reel));
}
