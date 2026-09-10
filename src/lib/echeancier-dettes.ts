/**
 * Paiements échelonnés des dettes et des créances.
 *
 * Tout est calculé sur l'appareil : aucune donnée ne sort du téléphone.
 * Chaque fiche peut porter un échéancier (montant, rythme, heure d'alarme).
 * Ce module dit quelles échéances sont arrivées à terme et prépare les
 * rappels à programmer sur le téléphone.
 */

import type { Dette, EcheancierDette, UniteRappel } from "@/lib/store";
import { resteDu } from "@/lib/store";

/** Jour local au format YYYY-MM-DD. */
export function jourLocal(d: Date = new Date()): string {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return x.toISOString().slice(0, 10);
}

/** Avance une date d'un nombre d'unités (jour, semaine, mois, année). */
export function avancerEcheance(date: string, intervalle: number, unite: UniteRappel): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const pas = Math.min(31, Math.max(1, Math.round(intervalle) || 1));
  if (unite === "jour") d.setDate(d.getDate() + pas);
  else if (unite === "semaine") d.setDate(d.getDate() + pas * 7);
  else if (unite === "mois") d.setMonth(d.getMonth() + pas);
  else d.setFullYear(d.getFullYear() + pas);
  return jourLocal(d);
}

/** Libellé lisible du rythme choisi. */
export function libelleRythme(e: EcheancierDette): string {
  const pas = e.intervalle;
  const mots: Record<UniteRappel, string> = {
    jour: pas > 1 ? "jours" : "jour",
    semaine: pas > 1 ? "semaines" : "semaine",
    mois: "mois",
    annee: pas > 1 ? "ans" : "an",
  };
  return `Tous les ${pas} ${mots[e.unite]}`;
}

/** Montant réellement à verser : jamais plus que le reste dû. */
export function montantEcheance(d: Dette): number {
  const reste = resteDu(d);
  if (!d.echeancier) return reste;
  return Math.min(reste, d.echeancier.montant);
}

export type EcheanceDette = {
  dette: Dette;
  /** Clé stable du rappel (fiche + date d'échéance). */
  cle: string;
  date: string;
  montant: number;
};

/** Échéances dont l'heure d'alarme est passée et qui attendent une réponse. */
export function echeancesDettesDues(dettes: Dette[], maintenant = new Date()): EcheanceDette[] {
  const dues: EcheanceDette[] = [];
  for (const d of dettes) {
    const e = d.echeancier;
    if (!e || !e.actif) continue;
    if (resteDu(d) <= 0) continue;
    const quand = new Date(`${e.prochaine}T${e.heure}:00`);
    if (Number.isNaN(quand.getTime()) || quand.getTime() > maintenant.getTime()) continue;
    dues.push({
      dette: d,
      cle: `${d.id}-${e.prochaine}`,
      date: e.prochaine,
      montant: montantEcheance(d),
    });
  }
  return dues.sort((a, z) => a.date.localeCompare(z.date));
}

/** Prochaines échéances à programmer sur le téléphone (120 jours à l'avance). */
export function rappelsDettesAProgrammer(
  dettes: Dette[],
  maintenant = new Date(),
): { cle: string; titre: string; texte: string; quand: Date }[] {
  const limite = maintenant.getTime() + 120 * 86_400_000;
  const sortie: { cle: string; titre: string; texte: string; quand: Date }[] = [];
  for (const d of dettes) {
    const e = d.echeancier;
    if (!e || !e.actif || resteDu(d) <= 0) continue;
    let date = e.prochaine;
    for (let i = 0; i < 24; i += 1) {
      const quand = new Date(`${date}T${e.heure}:00`);
      if (Number.isNaN(quand.getTime())) break;
      if (quand.getTime() > limite) break;
      if (quand.getTime() > maintenant.getTime()) {
        sortie.push({
          cle: `dette-${d.id}-${date}`,
          titre:
            d.sens === "dette"
              ? `Paiement à faire : ${d.personne}`
              : `Versement attendu de ${d.personne}`,
          texte: `Échéance du ${date}. Ouvrez l'application pour confirmer le versement.`,
          quand,
        });
      }
      date = avancerEcheance(date, e.intervalle, e.unite);
    }
  }
  return sortie.slice(0, 60);
}
