/**
 * Détection des limites de l'intelligence de l'application.
 *
 * Jusqu'ici les intelligences locales répondaient toujours, même quand elles
 * manquaient de données pour être fiables. Ce module inspecte l'état unifié
 * (cerveau, coach, suivi planifié, objectifs, lecture des tickets, mémoire des
 * habitudes) et déclare honnêtement ce que l'application ne sait PAS faire,
 * ne sait pas encore, ou ne peut pas garantir.
 *
 * Tout est calculé sur l'appareil, sans aucune connexion.
 */
import type { EtatIA } from "./ia-unifiee";

export type Limite = {
  id: string;
  /** Domaine concerné : prévisions, catégorisation, tickets, etc. */
  domaine: string;
  /** Ce que l'application ne peut pas faire, en clair. */
  titre: string;
  /** Pourquoi, et ce qui la débloquerait. */
  detail: string;
  /** Gravité : bloquante (réponse peu fiable) ou simple réserve. */
  gravite: "bloquante" | "reserve";
};

export type BilanLimites = {
  /** Fiabilité globale estimée des réponses, de 0 à 100. */
  fiabilite: number;
  /** Limites détectées, les plus bloquantes d'abord. */
  limites: Limite[];
  /** Phrase de prudence à ajouter aux réponses du conseiller. */
  avertissement: string;
  /** Ce que l'application ne saura jamais faire, par conception. */
  horsPortee: string[];
};

const JOUR_MS = 86_400_000;

function joursDepuis(date: string): number {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / JOUR_MS);
}

/** Limites structurelles : vraies quelles que soient les données. */
export const HORS_PORTEE: string[] = [
  "Je ne vois que ce que vous saisissez : aucune connexion à vos banques ni à vos comptes mobile money.",
  "Je ne lis aucun SMS ni notification bancaire, donc une opération non saisie n'existe pas pour moi.",
  "Je ne connais ni l'inflation, ni les prix du marché, ni l'actualité : je ne compare qu'à votre propre historique.",
  "Je ne suis ni conseiller bancaire, ni fiscaliste : mes conseils sont des repères, pas un avis professionnel.",
  "Mes prévisions supposent que vos habitudes continuent : un imprévu (maladie, fête, panne) n'est pas prévisible.",
  "Je fonctionne hors ligne sur ce téléphone : je n'apprends pas des autres utilisateurs.",
];

/**
 * Analyse l'état des intelligences et retourne leurs limites du moment.
 */
export function detecterLimites(etat: EtatIA): BilanLimites {
  const limites: Limite[] = [];
  const { transactions, enveloppes, budgets, objectifs, dettes } = etat.donnees;

  const depenses = transactions.filter((t) => t.type === "depense");
  const revenus = transactions.filter((t) => t.type === "revenu");
  const dates = transactions.map((t) => joursDepuis(t.date)).filter((j) => Number.isFinite(j));
  const anciennete = dates.length ? Math.max(...dates) : 0;
  const derniereSaisie = dates.length ? Math.min(...dates) : Infinity;
  const sansCategorie = depenses.filter((t) => !t.categorie).length;

  if (transactions.length < 20) {
    limites.push({
      id: "historique-court",
      domaine: "Toutes les analyses",
      titre: `Je n'ai que ${transactions.length} opération(s) enregistrée(s).`,
      detail:
        "En dessous d'une vingtaine d'opérations, mes moyennes et mes conseils ne valent pas grand-chose. Continuez à saisir vos dépenses.",
      gravite: "bloquante",
    });
  }

  if (anciennete < 60) {
    limites.push({
      id: "profondeur",
      domaine: "Prévisions",
      titre: `Mon historique remonte à ${anciennete} jour(s) seulement.`,
      detail:
        "Mes prévisions s'appuient sur 60 jours et ma comparaison saisonnière sur un an. Avant cela, je devine plus que je ne calcule.",
      gravite: anciennete < 30 ? "bloquante" : "reserve",
    });
  }

  if (anciennete < 365) {
    limites.push({
      id: "saison",
      domaine: "Saisonnalité",
      titre: "Je ne peux pas comparer avec l'année dernière.",
      detail:
        "Rentrée, fêtes, saison des pluies : sans douze mois d'historique, je ne repère pas ces cycles.",
      gravite: "reserve",
    });
  }

  if (revenus.length < 2) {
    limites.push({
      id: "revenus",
      domaine: "Trésorerie",
      titre: "Je connais mal vos revenus.",
      detail:
        "Avec moins de deux revenus enregistrés, mon estimation de découvert et ma capacité d'épargne sont peu fiables.",
      gravite: "bloquante",
    });
  }

  if (depenses.length > 0 && sansCategorie / depenses.length > 0.2) {
    limites.push({
      id: "categories",
      domaine: "Catégorisation",
      titre: `${sansCategorie} dépense(s) sans enveloppe.`,
      detail:
        "Ces montants n'entrent dans aucun poste : mes répartitions et mes plafonds conseillés sont donc incomplets.",
      gravite: "reserve",
    });
  }

  if (derniereSaisie > 7 && Number.isFinite(derniereSaisie)) {
    limites.push({
      id: "fraicheur",
      domaine: "Fiabilité des chiffres",
      titre: `Aucune saisie depuis ${derniereSaisie} jour(s).`,
      detail:
        "Vos soldes affichés sont probablement dépassés : je ne détecte pas les dépenses non enregistrées.",
      gravite: "bloquante",
    });
  }

  if (enveloppes.length === 0) {
    limites.push({
      id: "enveloppes",
      domaine: "Budget",
      titre: "Aucune enveloppe créée.",
      detail:
        "Sans enveloppes, je ne peux ni surveiller un plafond ni vous alerter d'un dépassement.",
      gravite: "reserve",
    });
  }

  if (budgets.length === 0 || etat.suivi.length === 0) {
    limites.push({
      id: "planifie",
      domaine: "Planifié / réel",
      titre: "Je n'ai pas de dépenses planifiées à comparer.",
      detail: "Sans plan, je constate après coup mais je ne peux pas vous prévenir avant l'écart.",
      gravite: "reserve",
    });
  }

  if (objectifs.length === 0) {
    limites.push({
      id: "objectifs",
      domaine: "Objectifs",
      titre: "Aucun objectif à suivre.",
      detail: "Je ne peux donc pas dire si votre épargne est en avance ou en retard.",
      gravite: "reserve",
    });
  }

  if (dettes.length === 0) {
    limites.push({
      id: "dettes",
      domaine: "Dettes et créances",
      titre: "Je ne connais aucune dette ni créance.",
      detail:
        "Si vous devez de l'argent hors application, mon solde disponible est plus optimiste que la réalité.",
      gravite: "reserve",
    });
  }

  const c = etat.collaboration;
  if (c.ticketsAppris < 3) {
    limites.push({
      id: "tickets",
      domaine: "Lecture des tickets",
      titre: "Je reconnais encore mal vos commerçants.",
      detail: `Seulement ${c.ticketsAppris} commerçant(s) appris : corrigez mes lectures pour que je progresse.`,
      gravite: "reserve",
    });
  }

  if (etat.habitudes.total < 30) {
    limites.push({
      id: "habitudes",
      domaine: "Mémoire des habitudes",
      titre: "Je vous connais encore peu.",
      detail: `${etat.habitudes.total} action(s) observée(s) : mes suggestions de saisie restent génériques.`,
      gravite: "reserve",
    });
  }

  if (etat.habitudes.satisfaction >= 0 && etat.habitudes.satisfaction < 50) {
    limites.push({
      id: "satisfaction",
      domaine: "Qualité des conseils",
      titre: `Vous ne jugez utiles que ${etat.habitudes.satisfaction} % de mes conseils.`,
      detail: "Continuez à noter mes réponses : c'est le seul moyen que j'ai de me corriger.",
      gravite: "reserve",
    });
  }

  limites.push({
    id: "langage",
    domaine: "Compréhension",
    titre: "Je comprends des questions par mots-clés, pas le langage libre.",
    detail:
      "Une question tournée autrement peut ne pas être comprise : reformulez avec un mot comme comptes, dettes, objectifs, planifié, alertes, prévisions.",
    gravite: "reserve",
  });

  const bloquantes = limites.filter((l) => l.gravite === "bloquante").length;
  const reserves = limites.length - bloquantes;
  const fiabilite = Math.max(5, Math.min(100, 100 - bloquantes * 22 - reserves * 5));

  limites.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === "bloquante" ? -1 : 1));

  const avertissement =
    fiabilite >= 80
      ? "Mes réponses s'appuient sur des données suffisantes ; elles restent des estimations."
      : fiabilite >= 50
        ? "Prenez mes chiffres comme des ordres de grandeur : il me manque encore des données."
        : "Attention : je manque trop de données pour être fiable aujourd'hui. Ne décidez pas sur ma seule base.";

  return { fiabilite, limites, avertissement, horsPortee: HORS_PORTEE };
}

/** Résumé parlé/écrit des limites, pour le conseiller. */
export function phrasesLimites(bilan: BilanLimites): string[] {
  return [
    `Fiabilité estimée de mes réponses : ${bilan.fiabilite} %.`,
    bilan.avertissement,
    ...bilan.limites.slice(0, 6).map((l) => `${l.titre} ${l.detail}`),
    ...bilan.horsPortee.slice(0, 3),
  ];
}
