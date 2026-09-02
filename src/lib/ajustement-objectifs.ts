/**
 * Propositions d'ajustement des objectifs d'épargne.
 *
 * L'application compare l'effort mensuel exigé par chaque objectif à la
 * capacité d'épargne réellement constatée (revenus − dépenses des derniers
 * mois) et suggère, si besoin, une date plus réaliste ou un montant révisé.
 * L'utilisateur reste libre d'appliquer ou d'ignorer la proposition.
 */
import type { Objectif, Transaction } from "./store";
import type { SuiviObjectif } from "./objectifs";

/** Capacité d'épargne mensuelle moyenne, calculée sur les 6 derniers mois. */
export function capaciteEpargneMensuelle(
  transactions: Transaction[],
  maintenant = new Date(),
): number {
  const mois = new Set<string>();
  let net = 0;
  const limite = new Date(maintenant);
  limite.setMonth(limite.getMonth() - 6);
  const debut = limite.toISOString().slice(0, 10);

  for (const t of transactions) {
    if (t.date < debut) continue;
    mois.add(t.date.slice(0, 7));
    net += t.type === "revenu" ? t.montant : -t.montant;
  }
  const nb = Math.max(1, mois.size);
  return Math.max(0, Math.round(net / nb));
}

export type Ajustement = {
  objectif: Objectif;
  /** Effort mensuel actuellement exigé. */
  effortActuel: number;
  /** Effort mensuel supportable au vu de la capacité d'épargne. */
  effortTenable: number;
  /** Nouvelle date proposée (YYYY-MM-DD), si repousser l'échéance suffit. */
  dateProposee?: string;
  /** Montant visé proposé, si la date ne peut pas bouger. */
  ciblePropose?: number;
  message: string;
};

/** Part maximale de la capacité d'épargne qu'un seul objectif devrait prendre. */
const PART_MAX = 0.4;

/**
 * Propose un ajustement pour les objectifs dont l'effort mensuel dépasse la
 * part raisonnable de la capacité d'épargne constatée.
 */
export function proposerAjustements(
  suivis: SuiviObjectif[],
  transactions: Transaction[],
  maintenant = new Date(),
): Ajustement[] {
  const capacite = capaciteEpargneMensuelle(transactions, maintenant);
  const actifs = suivis.filter((s) => s.restant > 0);
  if (actifs.length === 0) return [];

  const total = actifs.reduce((s, x) => s + x.effortMensuel, 0);
  const out: Ajustement[] = [];

  for (const s of actifs) {
    // Part de la capacité attribuable à cet objectif, proportionnelle à son poids.
    const partObjectif = total > 0 ? s.effortMensuel / total : 1;
    const budget = capacite > 0 ? Math.round(capacite * Math.max(PART_MAX, partObjectif)) : 0;
    if (budget > 0 && s.effortMensuel <= budget) continue;

    const effortTenable = Math.max(1, budget);
    const moisNecessaires = Math.ceil(s.restant / effortTenable);
    const date = new Date(maintenant);
    date.setMonth(date.getMonth() + moisNecessaires);
    const dateProposee = date.toISOString().slice(0, 10);

    const ajustement: Ajustement = {
      objectif: s.objectif,
      effortActuel: s.effortMensuel,
      effortTenable,
      dateProposee,
      ciblePropose: Math.max(
        s.objectif.deja + 1,
        Math.round(s.reuni + effortTenable * Math.max(1, s.moisRestants)),
      ),
      message:
        capacite <= 0
          ? `Aucune capacité d'épargne constatée : l'effort de ${s.effortMensuel.toLocaleString("fr-FR")} FCFA/mois n'est pas tenable.`
          : `L'effort de ${s.effortMensuel.toLocaleString("fr-FR")} FCFA/mois dépasse votre capacité d'épargne (${capacite.toLocaleString("fr-FR")} FCFA/mois).`,
    };
    out.push(ajustement);
  }

  return out.sort((a, b) => b.effortActuel - a.effortActuel);
}
