/**
 * Prélèvement automatique d'épargne pour les objectifs.
 *
 * Chaque objectif doté d'un compte source et d'un compte d'épargne déclenche,
 * une fois par mois, un virement du montant nécessaire pour tenir l'échéance.
 * L'argent quitte ainsi le solde disponible et devient une épargne dédiée.
 */
import type { Objectif, Transfert } from "./store";
import type { SuiviObjectif } from "./objectifs";
import { journaliser } from "./journal";

/** Préfixe de note qui relie un virement à l'objectif qui l'a déclenché. */
export function noteObjectif(objectif: Objectif): string {
  return `Objectif:${objectif.id} — ${objectif.libelle}`;
}

/** true si le virement a été effectué pour cet objectif. */
export function estVirementObjectif(t: Transfert, objectifId: string): boolean {
  return t.note.startsWith(`Objectif:${objectifId}`);
}

/** Somme déjà mise de côté sur le compte d'épargne pour cet objectif. */
export function epargneObjectif(objectifId: string, transferts: Transfert[]): number {
  let total = 0;
  for (const t of transferts) if (estVirementObjectif(t, objectifId)) total += t.montant;
  return total;
}

export type PrelevementDu = {
  objectif: Objectif;
  compteSource: string;
  compteEpargne: string;
  montant: number;
  date: string;
};

/**
 * Liste les prélèvements mensuels encore à effectuer : un seul par objectif et
 * par mois, du montant de l'effort mensuel restant à fournir.
 */
export function prelevementsDus(
  suivis: SuiviObjectif[],
  transferts: Transfert[],
  maintenant = new Date(),
  soldes?: Record<string, number>,
): PrelevementDu[] {
  const date = maintenant.toISOString().slice(0, 10);
  const mois = date.slice(0, 7);
  const dus: PrelevementDu[] = [];
  // Solde restant de chaque compte au fil des prélèvements : deux objectifs
  // qui puisent au même endroit ne peuvent pas creuser un découvert.
  const restants: Record<string, number> = { ...(soldes ?? {}) };
  let bloques = 0;

  for (const s of suivis) {
    const o = s.objectif;
    if (!o.prelevementAuto || !o.compteSource || !o.compteEpargne) continue;
    if (o.compteSource === o.compteEpargne) continue;
    if (s.restant <= 0) continue;
    if (o.creeLe.slice(0, 7) > mois) continue;

    const dejaCeMois = transferts.some(
      (t) => estVirementObjectif(t, o.id) && t.date.slice(0, 7) === mois,
    );
    if (dejaCeMois) continue;

    let montant = Math.min(s.restant, Math.max(1, Math.round(s.effortMensuel)));
    if (soldes) {
      const disponible = Math.floor(restants[o.compteSource] ?? 0);
      if (disponible <= 0) {
        bloques += 1;
        continue;
      }
      // Prélèvement plafonné à ce que le compte peut réellement donner.
      montant = Math.min(montant, disponible);
      restants[o.compteSource] = disponible - montant;
    }
    if (montant <= 0) continue;
    dus.push({
      objectif: o,
      compteSource: o.compteSource,
      compteEpargne: o.compteEpargne,
      montant,
      date,
    });
  }

  if (bloques > 0) {
    journaliser(
      "avertissement",
      "application",
      `${bloques} épargne(s) d'objectif reportée(s) : le compte source n'a pas assez d'argent ce mois-ci.`,
    );
  }

  return dus;
}
