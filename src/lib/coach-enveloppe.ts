/**
 * Conseiller par enveloppe : chaque enveloppe reçoit son propre bilan et ses
 * propres conseils, calculés uniquement à partir des dépenses réelles
 * observées sur l'appareil. Plus l'utilisateur dépense, plus le rythme mesuré
 * est précis et plus les conseils se resserrent.
 */

import type { Enveloppe, Transaction } from "./store";
import { dotationDe, etatEnveloppe, type EtatEnveloppe } from "./enveloppe-etat";

const JOUR = 86400000;

export type ConseilEnveloppe = {
  id: string;
  texte: string;
  action: string;
  /** Gravité : 2 = urgent, 1 = à surveiller, 0 = information. */
  gravite: 0 | 1 | 2;
};

export type BilanEnveloppe = {
  enveloppe: Enveloppe;
  etat: EtatEnveloppe;
  /** Dépenses des 30 derniers jours sur cette enveloppe. */
  depense30: number;
  /** Dépenses des 30 jours précédents, pour comparer. */
  depense30Avant: number;
  /** Variation en % entre les deux périodes (0 si pas d'historique). */
  tendance: number;
  /** Dépense moyenne par jour observée. */
  rythmeJour: number;
  /** Nombre de jours avant épuisement au rythme actuel (Infinity si aucun). */
  joursAvantEpuisement: number;
  /** Nombre d'opérations observées : mesure la fiabilité du bilan. */
  operations: number;
  /** Note de tenue de l'enveloppe, 0 à 100. */
  score: number;
  conseils: ConseilEnveloppe[];
  /** Résumé lisible en une phrase. */
  resume: string;
};

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

/** Construit le bilan d'une enveloppe à partir de ses dépenses réelles. */
export function bilanEnveloppe(
  enveloppe: Enveloppe,
  transactions: Transaction[],
  utilise: number,
  maintenant = new Date(),
): BilanEnveloppe {
  const now = maintenant.getTime();
  const siennes = transactions.filter((t) => t.type === "depense" && t.categorie === enveloppe.id);

  let depense30 = 0;
  let depense30Avant = 0;
  for (const t of siennes) {
    const d = new Date(t.date).getTime();
    if (!Number.isFinite(d)) continue;
    const age = now - d;
    if (age >= 0 && age <= 30 * JOUR) depense30 += t.montant;
    else if (age > 30 * JOUR && age <= 60 * JOUR) depense30Avant += t.montant;
  }

  const etat = etatEnveloppe(enveloppe, utilise);
  const rythmeJour = depense30 / 30;
  const tendance = depense30Avant > 0 ? ((depense30 - depense30Avant) / depense30Avant) * 100 : 0;
  const joursAvantEpuisement =
    rythmeJour > 0 ? Math.floor(etat.restant / rythmeJour) : Number.POSITIVE_INFINITY;

  const conseils: ConseilEnveloppe[] = [];
  const dotation = dotationDe(enveloppe);

  if (etat.epuisee) {
    conseils.push({
      id: "epuisee",
      texte: `L'enveloppe est vide : ${fcfa(etat.utilise)} déjà dépensés sur ${fcfa(dotation)}.`,
      action:
        "Faites un transfert de secours depuis une enveloppe en avance, ou mettez-la en pause jusqu'au prochain remplissage.",
      gravite: 2,
    });
  } else if (joursAvantEpuisement <= 7) {
    conseils.push({
      id: "epuisement-proche",
      texte: `À ce rythme (${fcfa(rythmeJour)} par jour), il ne reste que ${joursAvantEpuisement} jour(s) de marge.`,
      action: `Descendez à ${fcfa(Math.max(0, etat.restant / 15))} par jour pour tenir deux semaines de plus.`,
      gravite: 2,
    });
  } else if (etat.plafondAtteint) {
    conseils.push({
      id: "plafond",
      texte: `Le plafond de ${fcfa(enveloppe.plafond)} est atteint ; vous puisez maintenant dans la réserve (${fcfa(etat.reserveDisponible)}).`,
      action:
        "Relevez le plafond s'il est irréaliste, sinon stoppez les dépenses non urgentes ici.",
      gravite: 1,
    });
  }

  if (tendance >= 25 && depense30Avant > 0) {
    conseils.push({
      id: "hausse",
      texte: `Vos dépenses ici montent de ${Math.round(tendance)} % par rapport au mois précédent (${fcfa(depense30Avant)} → ${fcfa(depense30)}).`,
      action: `Visez ${fcfa(depense30Avant)} ce mois-ci pour revenir à votre habitude.`,
      gravite: 1,
    });
  } else if (tendance <= -20 && depense30Avant > 0) {
    conseils.push({
      id: "baisse",
      texte: `Bravo : ${Math.round(Math.abs(tendance))} % de moins que le mois précédent, soit ${fcfa(depense30Avant - depense30)} économisés.`,
      action: "Basculez cette économie vers votre épargne pour la rendre définitive.",
      gravite: 0,
    });
  }

  if (dotation > 0 && depense30 > 0 && depense30 < dotation * 0.5 && !etat.epuisee) {
    conseils.push({
      id: "surdotee",
      texte: `Vous n'utilisez que ${Math.round((depense30 / dotation) * 100)} % de cette enveloppe.`,
      action: `Vous pouvez libérer environ ${fcfa(dotation - depense30 * 1.2)} vers une enveloppe plus tendue.`,
      gravite: 0,
    });
  }

  if (siennes.length === 0) {
    conseils.push({
      id: "aucune-donnee",
      texte:
        "Aucune dépense enregistrée ici pour l'instant : je n'ai pas encore de rythme à analyser.",
      action: "Saisissez vos dépenses de cette enveloppe pour que mes conseils deviennent précis.",
      gravite: 0,
    });
  }

  const partPlafond = enveloppe.plafond > 0 ? etat.utilise / enveloppe.plafond : 0;
  let score = 100;
  if (partPlafond > 1) score -= Math.min(45, (partPlafond - 1) * 100);
  else if (partPlafond > 0.85) score -= 15;
  if (tendance > 0) score -= Math.min(25, tendance / 4);
  if (etat.epuisee) score -= 25;
  if (joursAvantEpuisement <= 7) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const resume = etat.epuisee
    ? `Enveloppe vide, ${fcfa(etat.utilise)} consommés.`
    : Number.isFinite(joursAvantEpuisement)
      ? `${fcfa(etat.restant)} restants, environ ${joursAvantEpuisement} jour(s) de marge.`
      : `${fcfa(etat.restant)} restants, aucune dépense récente.`;

  return {
    enveloppe,
    etat,
    depense30,
    depense30Avant,
    tendance,
    rythmeJour,
    joursAvantEpuisement,
    operations: siennes.length,
    score,
    conseils,
    resume,
  };
}

/** Bilans de toutes les enveloppes, les plus tendues d'abord. */
export function bilansEnveloppes(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  depensesParEnveloppe: Record<string, number>,
  maintenant = new Date(),
): BilanEnveloppe[] {
  return enveloppes
    .map((e) => bilanEnveloppe(e, transactions, depensesParEnveloppe[e.id] ?? 0, maintenant))
    .sort((a, b) => a.score - b.score);
}
