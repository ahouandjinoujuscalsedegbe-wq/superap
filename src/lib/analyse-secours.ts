/**
 * Fusion « Analyse intelligente » + « Plan de secours ».
 *
 * Une seule intelligence locale : elle lit les constats du cerveau, repère les
 * enveloppes en détresse, propose des transferts sûrs, mesure ce que chaque
 * solution rapporte réellement puis apprend du comportement de l'utilisateur
 * (solution appliquée, montant ajusté, proposition ignorée) pour améliorer ses
 * prochaines propositions. Tout est calculé et stocké sur l'appareil.
 */

import { plansSecours, type Donneur, type PlanSecours } from "./sauvetage";
import type { AlerteAffichable } from "./cerveau/discours";
import type { Enveloppe, Transaction } from "./store";

const CLE = "super-app:apprentissage-secours";

export type DecisionSecours = {
  date: string;
  /** Enveloppe secourue. */
  cible: string;
  /** Enveloppe donneuse. */
  donneur: string;
  /** Montant proposé par l'intelligence. */
  propose: number;
  /** Montant réellement appliqué (0 = proposition ignorée). */
  applique: number;
  action: "applique" | "ajuste" | "ignore";
};

export type MemoireSecours = {
  decisions: DecisionSecours[];
  /** Retours explicites de l'utilisateur sur l'utilité d'une solution. */
  utiles: number;
  inutiles: number;
  /** Notes de 1 à 5 données aux solutions avant approbation ou rejet. */
  notes: number[];
};

export const MEMOIRE_VIDE: MemoireSecours = { decisions: [], utiles: 0, inutiles: 0, notes: [] };

const MAX_DECISIONS = 200;

function assainir(brut: unknown): MemoireSecours {
  if (!brut || typeof brut !== "object") return MEMOIRE_VIDE;
  const o = brut as Partial<MemoireSecours>;
  const decisions = Array.isArray(o.decisions)
    ? o.decisions
        .filter((d): d is DecisionSecours => !!d && typeof d === "object")
        .map((d) => ({
          date: String(d.date ?? ""),
          cible: String(d.cible ?? ""),
          donneur: String(d.donneur ?? ""),
          propose: Number(d.propose) || 0,
          applique: Number(d.applique) || 0,
          action: (d.action === "applique" || d.action === "ajuste"
            ? d.action
            : "ignore") as DecisionSecours["action"],
        }))
        .slice(-MAX_DECISIONS)
    : [];
  return {
    decisions,
    utiles: Number(o.utiles) || 0,
    inutiles: Number(o.inutiles) || 0,
    notes: Array.isArray(o.notes)
      ? o.notes
          .map((n) => Math.max(1, Math.min(5, Math.round(Number(n)) || 0)))
          .filter((n) => n >= 1)
          .slice(-MAX_DECISIONS)
      : [],
  };
}

/** Note de 1 à 5 donnée par l'utilisateur avant d'approuver ou de rejeter une solution. */
export function noterQualiteSolution(note: number): MemoireSecours {
  const m = lireMemoireSecours();
  const valeur = Math.max(1, Math.min(5, Math.round(note)));
  const suite: MemoireSecours = { ...m, notes: [...m.notes, valeur].slice(-MAX_DECISIONS) };
  ecrire(suite);
  return suite;
}

export function lireMemoireSecours(): MemoireSecours {
  if (typeof localStorage === "undefined") return MEMOIRE_VIDE;
  try {
    return assainir(JSON.parse(localStorage.getItem(CLE) ?? "null"));
  } catch {
    return MEMOIRE_VIDE;
  }
}

function ecrire(m: MemoireSecours): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLE, JSON.stringify(m));
  } catch {
    /* stockage indisponible */
  }
}

/** Mémorise ce que l'utilisateur a fait d'une proposition. */
export function enregistrerDecision(d: Omit<DecisionSecours, "date">): MemoireSecours {
  const m = lireMemoireSecours();
  const suite: MemoireSecours = {
    ...m,
    decisions: [...m.decisions, { ...d, date: new Date().toISOString() }].slice(-MAX_DECISIONS),
  };
  ecrire(suite);
  return suite;
}

/** Retour explicite de l'utilisateur : la solution lui a-t-elle servi ? */
export function noterSolution(utile: boolean): MemoireSecours {
  const m = lireMemoireSecours();
  const suite = {
    ...m,
    utiles: m.utiles + (utile ? 1 : 0),
    inutiles: m.inutiles + (utile ? 0 : 1),
  };
  ecrire(suite);
  return suite;
}

export function oublierApprentissageSecours(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* rien */
  }
}

/**
 * Coefficient appris pour une enveloppe donneuse : proche de 1 quand
 * l'utilisateur accepte ses propositions, plus faible quand il les refuse ou
 * réduit systématiquement les montants.
 */
export function confianceDonneur(donneur: string, memoire = lireMemoireSecours()): number {
  const liees = memoire.decisions.filter((d) => d.donneur === donneur);
  if (liees.length === 0) return 1;
  let poids = 0;
  for (const d of liees) {
    if (d.action === "ignore") poids += 0;
    else if (d.action === "ajuste")
      poids += Math.max(0.2, Math.min(1, d.applique / Math.max(1, d.propose)));
    else poids += 1;
  }
  // Lissage : une seule décision ne condamne pas une enveloppe.
  return Math.max(0.25, Math.min(1, (poids + 1) / (liees.length + 1)));
}

export type SolutionSecours = {
  id: string;
  plan: PlanSecours;
  /** Donneurs réordonnés et ajustés par l'apprentissage. */
  donneurs: (Donneur & { confiance: number })[];
  /** Gravité 0–100 : sert à trier les solutions. */
  gravite: number;
  /** Ce que l'utilisateur gagne concrètement s'il applique la solution. */
  impact: string;
};

/** Solutions issues de la fusion analyse + secours, de la plus urgente à la moins urgente. */
export function solutionsSecours(
  enveloppes: Enveloppe[],
  depensesParEnveloppe: Record<string, number>,
  transactions: Transaction[],
  maintenant = new Date(),
  memoire = lireMemoireSecours(),
): SolutionSecours[] {
  return plansSecours(enveloppes, depensesParEnveloppe, transactions, maintenant).map((plan) => {
    const donneurs = plan.donneurs
      .map((d) => {
        const confiance = confianceDonneur(d.enveloppe.nom, memoire);
        return {
          ...d,
          confiance,
          montantPropose: Math.max(0, Math.round(d.montantPropose * confiance)),
        };
      })
      .filter((d) => d.montantPropose > 0)
      .sort((a, b) => {
        if (a.prioritaire !== b.prioritaire) return a.prioritaire ? 1 : -1;
        return b.confiance * b.montantPropose - a.confiance * a.montantPropose;
      });

    const couverture = donneurs.reduce((s, d) => s + d.montantPropose, 0);
    const gravite = Math.round(
      Math.min(
        100,
        (plan.manque / Math.max(1, plan.manque + couverture)) * 60 +
          (plan.depassement > 0 ? 40 : 10),
      ),
    );
    const part = Math.min(100, Math.round((couverture / Math.max(1, plan.manque)) * 100));
    const impact =
      couverture <= 0
        ? `Aucun transfert sûr possible : la seule action utile est de suspendre les dépenses de ${plan.enveloppe.nom}.`
        : `En appliquant ces transferts, ${part}% du manque de ${plan.enveloppe.nom} est comblé et aucune autre enveloppe ne passe en dessous de ses dépenses prévues.`;

    return { id: plan.enveloppe.id, plan, donneurs, gravite, impact };
  });
}

export type BilanSecours = {
  propositions: number;
  appliquees: number;
  ajustees: number;
  ignorees: number;
  /** Part des propositions suivies, en %. */
  adoption: number;
  /** Total réellement transféré grâce aux propositions. */
  montantSauve: number;
  utiles: number;
  inutiles: number;
  /** Maturité de l'intelligence 0–100. */
  maturite: number;
  /** Note moyenne sur 5 donnée aux solutions (0 si aucune note). */
  noteMoyenne: number;
  notes: number;
};

export function bilanSecours(memoire = lireMemoireSecours()): BilanSecours {
  const d = memoire.decisions;
  const appliquees = d.filter((x) => x.action === "applique").length;
  const ajustees = d.filter((x) => x.action === "ajuste").length;
  const ignorees = d.filter((x) => x.action === "ignore").length;
  const montantSauve = d.reduce((s, x) => s + x.applique, 0);
  const adoption = d.length ? Math.round(((appliquees + ajustees) / d.length) * 100) : 0;
  const retours = memoire.utiles + memoire.inutiles;
  const maturite = Math.min(
    100,
    Math.round(
      Math.min(60, d.length * 3) +
        Math.min(40, retours * 5) * (retours ? memoire.utiles / retours : 0),
    ),
  );
  return {
    propositions: d.length,
    appliquees,
    ajustees,
    ignorees,
    adoption,
    montantSauve,
    utiles: memoire.utiles,
    inutiles: memoire.inutiles,
    maturite,
  };
}

/** Fusionne constats du cerveau et solutions de secours en une seule liste lisible. */
export function fusionner(
  alertes: AlerteAffichable[],
  solutions: SolutionSecours[],
): { alertes: AlerteAffichable[]; solutions: SolutionSecours[]; urgentes: number } {
  const utiles = alertes.filter((a) => a.niveau !== "bravo");
  const urgentes = utiles.filter((a) => a.niveau === "alerte").length + solutions.length;
  return { alertes: utiles, solutions, urgentes };
}
