import type { Dette, Transaction } from "./store";
import { resteDu } from "./store";
import { rythmeJournalier, revenuMensuelMoyen } from "./simulation";

/**
 * Extensions du module Outils et Simulation :
 * découvert, choc de revenu, inflation, comparateur de scénarios,
 * stratégies de remboursement, fonds d'urgence, crédit contre comptant,
 * alertes proactives, partage et historique des simulations.
 */

const JOUR = 86400000;

export function formaterFCFA(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

/* ------------------------------------------------------------------ */
/* 1. Simulateur de découvert                                           */
/* ------------------------------------------------------------------ */

export type Decouvert = {
  compte: string;
  solde: number;
  sortieParJour: number;
  joursTenus: number | null;
  dateDecouvert: string | null;
  trouA30Jours: number;
  message: string;
};

export function simulerDecouvert(args: {
  soldesParCompte: Record<string, number>;
  transactions: Transaction[];
  horizonJours?: number;
}): Decouvert[] {
  const horizon = args.horizonJours ?? 30;
  const parJourGlobal = rythmeJournalier(args.transactions);
  const total = Object.values(args.soldesParCompte).reduce((s, v) => s + Math.max(0, v), 0);

  return Object.entries(args.soldesParCompte)
    .map(([compte, solde]) => {
      const poids = total > 0 ? Math.max(0, solde) / total : 1;
      const sortieParJour = parJourGlobal * poids;
      const soldeHorizon = solde - sortieParJour * horizon;
      const joursTenus = sortieParJour > 0 ? Math.floor(solde / sortieParJour) : null;
      const dateDecouvert =
        joursTenus !== null && joursTenus <= horizon
          ? new Date(Date.now() + joursTenus * JOUR).toISOString().slice(0, 10)
          : null;
      return {
        compte,
        solde,
        sortieParJour: Math.round(sortieParJour),
        joursTenus,
        dateDecouvert,
        trouA30Jours: Math.round(Math.min(0, soldeHorizon)),
        message:
          dateDecouvert === null
            ? `Au rythme actuel, ${compte} tient au-delà de ${horizon} jours.`
            : `${compte} passerait en négatif le ${dateFr(dateDecouvert)}, avec un trou de ${formaterFCFA(
                Math.abs(Math.min(0, soldeHorizon)),
              )} à ${horizon} jours.`,
      };
    })
    .sort((a, b) => (a.joursTenus ?? 9999) - (b.joursTenus ?? 9999));
}

/* ------------------------------------------------------------------ */
/* 2. Choc de revenu (perte ou baisse)                                  */
/* ------------------------------------------------------------------ */

export type ChocRevenu = {
  revenuActuel: number;
  revenuApres: number;
  depensesMensuelles: number;
  margeApres: number;
  moisDeSurvie: number | null;
  coupeNecessaire: number;
  message: string;
};

export function simulerChocRevenu(args: {
  transactions: Transaction[];
  solde: number;
  baissePourcent: number;
}): ChocRevenu {
  const revenu = revenuMensuelMoyen(args.transactions);
  const depenses = rythmeJournalier(args.transactions) * 30;
  const revenuApres = revenu * (1 - Math.min(100, Math.max(0, args.baissePourcent)) / 100);
  const marge = revenuApres - depenses;
  const moisDeSurvie = marge < 0 ? Math.max(0, Math.floor(args.solde / Math.abs(marge))) : null;
  const coupeNecessaire = marge < 0 ? Math.round(Math.abs(marge)) : 0;

  return {
    revenuActuel: Math.round(revenu),
    revenuApres: Math.round(revenuApres),
    depensesMensuelles: Math.round(depenses),
    margeApres: Math.round(marge),
    moisDeSurvie,
    coupeNecessaire,
    message:
      marge >= 0
        ? `Même avec cette baisse, votre budget reste équilibré avec ${formaterFCFA(marge)} de marge par mois.`
        : `Votre épargne tiendrait environ ${moisDeSurvie} mois. Il faudrait couper ${formaterFCFA(
            coupeNecessaire,
          )} de dépenses par mois pour revenir à l'équilibre.`,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Inflation / hausse des prix                                       */
/* ------------------------------------------------------------------ */

export type Inflation = {
  tauxAnnuel: number;
  depensesActuelles: number;
  depensesDans1An: number;
  depensesDans5Ans: number;
  surcoutAnnuel: number;
  message: string;
};

export function simulerInflation(args: {
  transactions: Transaction[];
  tauxAnnuel: number;
}): Inflation {
  const depenses = rythmeJournalier(args.transactions) * 30;
  const t = args.tauxAnnuel / 100;
  const dans1An = depenses * (1 + t);
  const dans5Ans = depenses * Math.pow(1 + t, 5);
  const surcout = (dans1An - depenses) * 12;
  return {
    tauxAnnuel: args.tauxAnnuel,
    depensesActuelles: Math.round(depenses),
    depensesDans1An: Math.round(dans1An),
    depensesDans5Ans: Math.round(dans5Ans),
    surcoutAnnuel: Math.round(surcout),
    message: `Avec ${args.tauxAnnuel} % d'inflation, votre train de vie coûterait ${formaterFCFA(
      surcout,
    )} de plus sur un an.`,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Comparateur de scénarios                                          */
/* ------------------------------------------------------------------ */

export type OptionScenario = {
  nom: string;
  cout: number;
  dureeMois: number;
};

export type ComparaisonScenario = OptionScenario & {
  coutMensuel: number;
  soldeFinal: number;
  ecartMeilleur: number;
  meilleur: boolean;
};

export function comparerScenarios(args: {
  options: OptionScenario[];
  solde: number;
  capaciteMensuelle: number;
}): ComparaisonScenario[] {
  const calcules = args.options.map((o) => {
    const duree = Math.max(1, o.dureeMois);
    const coutMensuel = o.cout / duree;
    const soldeFinal = args.solde + (args.capaciteMensuelle - coutMensuel) * duree;
    return { ...o, dureeMois: duree, coutMensuel: Math.round(coutMensuel), soldeFinal: Math.round(soldeFinal) };
  });
  type Calcule = (typeof calcules)[number];
  const meilleur = calcules.reduce<Calcule | undefined>(
    (best, c) => (best === undefined || c.soldeFinal > best.soldeFinal ? c : best),
    undefined,
  );
  return calcules.map((c) => ({
    ...c,
    ecartMeilleur: Math.round(c.soldeFinal - (meilleur?.soldeFinal ?? 0)),
    meilleur: c.nom === meilleur?.nom,
  }));
}

/* ------------------------------------------------------------------ */
/* 5. Stratégies de remboursement des dettes                            */
/* ------------------------------------------------------------------ */

export type EtapeRemboursement = {
  personne: string;
  reste: number;
  moisPourSolder: number;
  cumulMois: number;
};

export type StrategieDettes = {
  strategie: "boule-de-neige" | "avalanche";
  etapes: EtapeRemboursement[];
  dureeTotale: number;
  message: string;
};

export function strategieRemboursement(args: {
  dettes: Dette[];
  capaciteMensuelle: number;
  strategie: "boule-de-neige" | "avalanche";
}): StrategieDettes {
  const capacite = Math.max(1, args.capaciteMensuelle);
  const restantes = args.dettes
    .filter((d) => d.sens === "dette" && resteDu(d) > 0)
    .map((d) => ({ personne: d.personne, reste: resteDu(d) }));

  restantes.sort((a, b) =>
    args.strategie === "boule-de-neige" ? a.reste - b.reste : b.reste - a.reste,
  );

  let cumul = 0;
  const etapes = restantes.map((d) => {
    const moisPourSolder = Math.ceil(d.reste / capacite);
    cumul += moisPourSolder;
    return { personne: d.personne, reste: d.reste, moisPourSolder, cumulMois: cumul };
  });

  return {
    strategie: args.strategie,
    etapes,
    dureeTotale: cumul,
    message:
      etapes.length === 0
        ? "Aucune dette en cours à rembourser."
        : args.strategie === "boule-de-neige"
          ? `En commençant par la plus petite dette (${etapes[0]?.personne}), vous soldez tout en ${cumul} mois avec des victoires rapides.`
          : `En attaquant la plus grosse dette (${etapes[0]?.personne}), vous soldez tout en ${cumul} mois en limitant le coût total.`,
  };
}

/* ------------------------------------------------------------------ */
/* 6. Fonds d'urgence                                                   */
/* ------------------------------------------------------------------ */

export type FondsUrgence = {
  depensesMensuelles: number;
  soldeActuel: number;
  moisCouverts: number;
  cible: number;
  manquant: number;
  moisPourAtteindre: number | null;
  niveau: "insuffisant" | "correct" | "solide";
  message: string;
};

export function evaluerFondsUrgence(args: {
  transactions: Transaction[];
  solde: number;
  moisCibles: number;
  capaciteMensuelle: number;
}): FondsUrgence {
  const depenses = Math.max(1, rythmeJournalier(args.transactions) * 30);
  const moisCouverts = args.solde / depenses;
  const cible = depenses * Math.max(1, args.moisCibles);
  const manquant = Math.max(0, cible - args.solde);
  const moisPourAtteindre =
    manquant === 0 ? 0 : args.capaciteMensuelle > 0 ? Math.ceil(manquant / args.capaciteMensuelle) : null;
  const niveau: FondsUrgence["niveau"] =
    moisCouverts >= args.moisCibles ? "solide" : moisCouverts >= 1 ? "correct" : "insuffisant";

  return {
    depensesMensuelles: Math.round(depenses),
    soldeActuel: args.solde,
    moisCouverts: Math.round(moisCouverts * 10) / 10,
    cible: Math.round(cible),
    manquant: Math.round(manquant),
    moisPourAtteindre,
    niveau,
    message:
      niveau === "solide"
        ? `Votre réserve couvre ${Math.round(moisCouverts * 10) / 10} mois de dépenses : objectif atteint.`
        : moisPourAtteindre === null
          ? `Il vous manque ${formaterFCFA(manquant)} mais votre capacité d'épargne est nulle : réduisez d'abord vos dépenses.`
          : `Il vous manque ${formaterFCFA(manquant)}, soit ${moisPourAtteindre} mois d'épargne au rythme actuel.`,
  };
}

/* ------------------------------------------------------------------ */
/* 7. Crédit contre comptant                                            */
/* ------------------------------------------------------------------ */

export type CreditComptant = {
  prix: number;
  mensualite: number;
  coutCredit: number;
  surcout: number;
  soldeApresComptant: number;
  rendementEpargneConserve: number;
  recommandation: "comptant" | "credit";
  message: string;
};

export function comparerCreditComptant(args: {
  prix: number;
  tauxAnnuel: number;
  dureeMois: number;
  solde: number;
  tauxEpargne: number;
}): CreditComptant {
  const duree = Math.max(1, args.dureeMois);
  const i = args.tauxAnnuel / 100 / 12;
  const mensualite = i === 0 ? args.prix / duree : (args.prix * i) / (1 - Math.pow(1 + i, -duree));
  const coutCredit = mensualite * duree;
  const surcout = coutCredit - args.prix;
  const rendement = (args.prix * (args.tauxEpargne / 100) * duree) / 12;
  const comptantPossible = args.solde >= args.prix;
  const versComptant = comptantPossible && surcout > rendement;

  return {
    prix: args.prix,
    mensualite: Math.round(mensualite),
    coutCredit: Math.round(coutCredit),
    surcout: Math.round(surcout),
    soldeApresComptant: Math.round(args.solde - args.prix),
    rendementEpargneConserve: Math.round(rendement),
    recommandation: versComptant ? "comptant" : "credit",
    message: !comptantPossible
      ? `Votre solde ne couvre pas le prix comptant : le crédit coûterait ${formaterFCFA(surcout)} d'intérêts.`
      : versComptant
        ? `Payez comptant : le crédit vous coûterait ${formaterFCFA(
            surcout - rendement,
          )} de plus que le rendement de votre épargne.`
        : `Le crédit reste intéressant : votre épargne rapporte ${formaterFCFA(
            rendement - surcout,
          )} de plus que le coût des intérêts.`,
  };
}

/* ------------------------------------------------------------------ */
/* 8. Alertes proactives                                                */
/* ------------------------------------------------------------------ */

export type AlerteProactive = {
  id: string;
  niveau: "info" | "attention" | "critique";
  titre: string;
  detail: string;
};

export function alertesProactives(args: {
  decouverts: Decouvert[];
  fondsUrgence: FondsUrgence;
  capaciteMensuelle: number;
  dettes: Dette[];
}): AlerteProactive[] {
  const liste: AlerteProactive[] = [];

  for (const d of args.decouverts) {
    if (d.dateDecouvert) {
      liste.push({
        id: `decouvert-${d.compte}`,
        niveau: "critique",
        titre: `Découvert prévu sur ${d.compte}`,
        detail: d.message,
      });
    }
  }

  if (args.capaciteMensuelle < 0) {
    liste.push({
      id: "capacite",
      niveau: "critique",
      titre: "Vous dépensez plus que vous ne gagnez",
      detail: `Déficit mensuel estimé de ${formaterFCFA(Math.abs(args.capaciteMensuelle))}.`,
    });
  }

  if (args.fondsUrgence.niveau === "insuffisant") {
    liste.push({
      id: "fonds",
      niveau: "attention",
      titre: "Fonds d'urgence insuffisant",
      detail: args.fondsUrgence.message,
    });
  }

  const dettesDues = args.dettes.filter((d) => d.sens === "dette" && resteDu(d) > 0);
  const totalDu = dettesDues.reduce((s, d) => s + resteDu(d), 0);
  if (totalDu > 0 && args.capaciteMensuelle > 0 && totalDu / args.capaciteMensuelle > 12) {
    liste.push({
      id: "dettes",
      niveau: "attention",
      titre: "Endettement élevé",
      detail: `Il faudrait plus de 12 mois d'épargne complète pour solder ${formaterFCFA(totalDu)} de dettes.`,
    });
  }

  if (liste.length === 0) {
    liste.push({
      id: "ok",
      niveau: "info",
      titre: "Aucune alerte",
      detail: "Votre situation ne déclenche aucune alerte de simulation aujourd'hui.",
    });
  }

  return liste;
}

/* ------------------------------------------------------------------ */
/* 9. Partage d'une simulation                                          */
/* ------------------------------------------------------------------ */

export function texteSimulation(titre: string, lignes: string[]): string {
  return [
    `SUPER APP — ${titre.toUpperCase()}`,
    `Édité le ${new Date().toLocaleDateString("fr-FR")}`,
    "",
    ...lignes,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* 10. Historique des simulations                                       */
/* ------------------------------------------------------------------ */

export type SimulationEnregistree = {
  id: string;
  titre: string;
  date: string;
  contenu: string;
};

const CLE_HISTORIQUE = "superapp:simulations:v1";

export function lireHistoriqueSimulations(): SimulationEnregistree[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_HISTORIQUE);
    if (!brut) return [];
    const data: unknown = JSON.parse(brut);
    return Array.isArray(data) ? (data as SimulationEnregistree[]) : [];
  } catch {
    return [];
  }
}

export function ecrireHistoriqueSimulations(liste: SimulationEnregistree[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste.slice(0, 50)));
}

export function enregistrerSimulation(
  titre: string,
  contenu: string,
): SimulationEnregistree[] {
  const entree: SimulationEnregistree = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    titre,
    date: new Date().toISOString(),
    contenu,
  };
  const liste = [entree, ...lireHistoriqueSimulations()];
  ecrireHistoriqueSimulations(liste);
  return liste;
}

export function supprimerSimulation(id: string): SimulationEnregistree[] {
  const liste = lireHistoriqueSimulations().filter((s) => s.id !== id);
  ecrireHistoriqueSimulations(liste);
  return liste;
}
