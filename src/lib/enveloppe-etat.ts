import type { Enveloppe } from "./store";

export type EtatEnveloppe = {
  /** Somme attribuée à l'enveloppe. */
  dotation: number;
  /** Total déjà dépensé depuis cette enveloppe. */
  utilise: number;
  /** Somme restante réellement disponible dans l'enveloppe. */
  restant: number;
  /** Montant encore dépensable avant d'atteindre le plafond. */
  avantPlafond: number;
  /** Part de la dotation située au-delà du plafond : la réserve. */
  reserve: number;
  /** Réserve encore disponible une fois le plafond atteint. */
  reserveDisponible: number;
  /** true dès que le plafond de dépenses est atteint ou dépassé. */
  plafondAtteint: boolean;
  /** true quand la dotation est entièrement consommée. */
  epuisee: boolean;
  /** Consommation du plafond, en pourcentage (0-100). */
  pourcentage: number;
};

/** Retourne la dotation de l'enveloppe (ancien état : plafond par défaut). */
export function dotationDe(e: Enveloppe): number {
  return typeof e.dotation === "number" ? e.dotation : e.plafond;
}

/**
 * Calcule l'état d'une enveloppe : la dotation diminue à chaque dépense,
 * le plafond signale la zone rouge et le reste constitue la réserve.
 */
export function etatEnveloppe(e: Enveloppe, utilise: number): EtatEnveloppe {
  const dotation = dotationDe(e);
  const restant = Math.max(0, dotation - utilise);
  const avantPlafond = Math.max(0, e.plafond - utilise);
  const reserve = Math.max(0, dotation - e.plafond);
  const plafondAtteint = utilise >= e.plafond && e.plafond > 0;
  return {
    dotation,
    utilise,
    restant,
    avantPlafond,
    reserve,
    reserveDisponible: plafondAtteint ? restant : reserve,
    plafondAtteint,
    epuisee: restant <= 0,
    pourcentage: e.plafond > 0 ? Math.min(100, (utilise / e.plafond) * 100) : 0,
  };
}
