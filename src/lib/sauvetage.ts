/**
 * Plan de secours des enveloppes (intelligence locale).
 *
 * Principe voulu par l'utilisateur :
 * - les dépenses appauvrissent l'enveloppe, les remplissages sont une prévision ;
 * - quand une enveloppe a épuisé son plafond ET sa réserve, l'application doit
 *   expliquer la situation puis orienter vers les enveloppes qui peuvent aider,
 *   sans créer de déficit ailleurs ni casser les objectifs.
 *
 * Tout est calculé sur l'appareil, sans réseau ni service externe.
 */

import { dotationDe, etatEnveloppe } from "./enveloppe-etat";
import { PERIODES_PAR_MOIS } from "./budget-mensuel";
import type { Enveloppe, Transaction } from "./store";

/** Part du disponible qu'une enveloppe donneuse garde toujours en sécurité. */
const MARGE_SECURITE = 0.2;

/** Enveloppes jugées vitales : on n'y puise qu'en dernier recours. */
const MOTS_PRIORITAIRES = [
  "LOYER",
  "FACTURE",
  "ÉLECTRICITÉ",
  "ELECTRICITE",
  "EAU",
  "SANTÉ",
  "SANTE",
  "SCOLARITÉ",
  "SCOLARITE",
  "ÉCOLE",
  "ECOLE",
  "DETTE",
  "ÉPARGNE",
  "EPARGNE",
  "OBJECTIF",
  "ASSURANCE",
];

export type Donneur = {
  enveloppe: Enveloppe;
  /** Somme réellement disponible dans l'enveloppe. */
  restant: number;
  /** Dépense encore attendue d'ici la fin de la période. */
  besoinPrevu: number;
  /** Somme mobilisable sans mettre l'enveloppe en difficulté. */
  mobilisable: number;
  /** Montant proposé pour ce sauvetage. */
  montantPropose: number;
  /** true si l'enveloppe est vitale (loyer, santé, épargne…). */
  prioritaire: boolean;
  /** Explication en français de la proposition. */
  raison: string;
};

export type PlanSecours = {
  enveloppe: Enveloppe;
  /** Dépenses déjà faites sur l'enveloppe. */
  utilise: number;
  /** Dépassement constaté au-delà de la dotation. */
  depassement: number;
  /** Somme nécessaire pour finir la période sans nouvelle dépense à découvert. */
  manque: number;
  /** Total que les enveloppes donneuses peuvent apporter. */
  couverture: number;
  /** true si les donneurs couvrent tout le manque. */
  couvert: boolean;
  donneurs: Donneur[];
  /** Analyse en français : ce qui s'est passé et pourquoi. */
  explication: string;
  /** Conseil de gestion si la couverture est partielle ou nulle. */
  conseil: string;
};

function fcfa(v: number): string {
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

function estPrioritaire(e: Enveloppe): boolean {
  const texte = `${e.nom} ${e.categorie ?? ""} ${e.sousCategorie ?? ""}`.toUpperCase();
  return MOTS_PRIORITAIRES.some((m) => texte.includes(m));
}

/** Durée en jours de la période de renouvellement (30 jours par défaut). */
export function joursPeriode(e: Enveloppe): number {
  const p = e.periodeRenouvellement;
  if (!p) return 30;
  return Math.round(365 / 12 / PERIODES_PAR_MOIS[p]);
}

/** Rythme de dépense journalier observé sur l'enveloppe (60 derniers jours). */
export function rythmeJournalier(
  e: Enveloppe,
  transactions: Transaction[],
  maintenant = new Date(),
): number {
  const debut = new Date(maintenant.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const total = transactions
    .filter((t) => t.type === "depense" && t.categorie === e.nom && t.date.slice(0, 10) >= debut)
    .reduce((s, t) => s + t.montant, 0);
  return total / 60;
}

/** Jours restants avant le prochain renouvellement de l'enveloppe. */
export function joursRestants(e: Enveloppe, maintenant = new Date()): number {
  const duree = joursPeriode(e);
  if (!e.dernierRemplissage) return Math.round(duree / 2);
  const debut = new Date(`${e.dernierRemplissage.slice(0, 10)}T12:00:00`).getTime();
  const ecoules = Math.floor((maintenant.getTime() - debut) / 86400000);
  return Math.max(1, duree - Math.max(0, ecoules));
}

/** Dépense encore attendue sur l'enveloppe d'ici la fin de sa période. */
export function besoinPrevu(
  e: Enveloppe,
  transactions: Transaction[],
  maintenant = new Date(),
): number {
  return Math.round(rythmeJournalier(e, transactions, maintenant) * joursRestants(e, maintenant));
}

/**
 * Enveloppes en détresse : plafond atteint et dotation entièrement consommée.
 */
export function enveloppesEnDetresse(
  enveloppes: Enveloppe[],
  depensesParEnveloppe: Record<string, number>,
): Enveloppe[] {
  return enveloppes.filter((e) => {
    const utilise = depensesParEnveloppe[e.nom] ?? depensesParEnveloppe[e.id] ?? 0;
    const etat = etatEnveloppe(e, utilise);
    return etat.epuisee && utilise > 0 && (etat.plafondAtteint || dotationDe(e) > 0);
  });
}

/**
 * Construit le plan de secours d'une enveloppe épuisée : combien il manque,
 * quelles enveloppes peuvent aider, et pourquoi c'est sans danger.
 */
export function planSecours(
  cible: Enveloppe,
  enveloppes: Enveloppe[],
  depensesParEnveloppe: Record<string, number>,
  transactions: Transaction[],
  maintenant = new Date(),
): PlanSecours {
  const utilise = depensesParEnveloppe[cible.nom] ?? depensesParEnveloppe[cible.id] ?? 0;
  const etat = etatEnveloppe(cible, utilise);
  const depassement = Math.max(0, utilise - dotationDe(cible));
  const jours = joursRestants(cible, maintenant);
  const manque = Math.max(depassement, besoinPrevu(cible, transactions, maintenant) - etat.restant);

  const candidats: Donneur[] = enveloppes
    .filter((e) => e.id !== cible.id)
    .map((e) => {
      const u = depensesParEnveloppe[e.nom] ?? depensesParEnveloppe[e.id] ?? 0;
      const et = etatEnveloppe(e, u);
      const besoin = besoinPrevu(e, transactions, maintenant);
      const libre = et.restant - besoin;
      const mobilisable = Math.max(0, Math.floor(libre * (1 - MARGE_SECURITE)));
      return {
        enveloppe: e,
        restant: et.restant,
        besoinPrevu: besoin,
        mobilisable,
        montantPropose: 0,
        prioritaire: estPrioritaire(e),
        raison: "",
      };
    })
    .filter((d) => d.mobilisable > 0)
    // Les enveloppes non vitales et les plus larges d'abord.
    .sort((a, b) => {
      if (a.prioritaire !== b.prioritaire) return a.prioritaire ? 1 : -1;
      return b.mobilisable - a.mobilisable;
    });

  let reste = manque;
  const donneurs: Donneur[] = [];
  for (const d of candidats) {
    if (reste <= 0) break;
    const montant = Math.min(d.mobilisable, reste);
    reste -= montant;
    donneurs.push({
      ...d,
      montantPropose: montant,
      raison: d.prioritaire
        ? `Enveloppe sensible : elle garde ${fcfa(d.restant - montant)} pour ses ${fcfa(
            d.besoinPrevu,
          )} de dépenses encore attendues. À utiliser seulement si les autres pistes ne suffisent pas.`
        : `Il y reste ${fcfa(d.restant)} alors que seulement ${fcfa(
            d.besoinPrevu,
          )} devraient y être dépensés d'ici la fin de la période : ${fcfa(
            montant,
          )} peuvent partir sans manquer.`,
    });
  }

  const couverture = donneurs.reduce((s, d) => s + d.montantPropose, 0);
  const couvert = couverture >= manque && manque > 0;

  const explication =
    `${cible.nom} a consommé ${fcfa(utilise)} pour un plafond de ${fcfa(cible.plafond)} et une ` +
    `dotation de ${fcfa(dotationDe(cible))}. La réserve est épuisée` +
    (depassement > 0 ? ` et le dépassement atteint ${fcfa(depassement)}` : "") +
    `. Au rythme observé, il faudrait encore ${fcfa(
      besoinPrevu(cible, transactions, maintenant),
    )} pour tenir les ${jours} jour(s) restants de la période.`;

  const conseil = couvert
    ? `Les transferts proposés couvrent le manque de ${fcfa(
        manque,
      )} sans mettre aucune autre enveloppe en difficulté : chaque donneuse conserve de quoi payer ses propres dépenses prévues.`
    : couverture > 0
      ? `Les enveloppes disponibles n'apportent que ${fcfa(couverture)} sur ${fcfa(
          manque,
        )}. Complétez en réduisant le rythme de dépense de ${fcfa(
          Math.round((manque - couverture) / Math.max(1, jours)),
        )} par jour jusqu'au renouvellement, ou reportez une dépense non urgente.`
      : `Aucune enveloppe ne peut aider sans se mettre elle-même en danger. Mettez les dépenses de ${cible.nom} en pause jusqu'au prochain renouvellement, ou augmentez sa dotation depuis un compte si le solde le permet.`;

  return {
    enveloppe: cible,
    utilise,
    depassement,
    manque: Math.max(0, Math.round(manque)),
    couverture,
    couvert,
    donneurs,
    explication,
    conseil,
  };
}

/** Tous les plans de secours à proposer, du plus urgent au moins urgent. */
export function plansSecours(
  enveloppes: Enveloppe[],
  depensesParEnveloppe: Record<string, number>,
  transactions: Transaction[],
  maintenant = new Date(),
): PlanSecours[] {
  return enveloppesEnDetresse(enveloppes, depensesParEnveloppe)
    .map((e) => planSecours(e, enveloppes, depensesParEnveloppe, transactions, maintenant))
    .filter((p) => p.manque > 0)
    .sort((a, b) => b.manque - a.manque);
}
