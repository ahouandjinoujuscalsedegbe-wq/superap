import type { Budget, Dette, Enveloppe, Transaction } from "./store";
import { resteDu } from "./store";

/**
 * Moteurs de simulation : trésorerie prédictive, impact « Et si ? »,
 * plans de redressement à 3 scénarios, arbitrage épargne/dette,
 * détection des fuites et optimisation des frais récurrents.
 */

const JOUR = 86400000;

function jour(iso: string): string {
  return iso.slice(0, 10);
}


/* ------------------------------------------------------------------ */
/* Rythme de dépense                                                    */
/* ------------------------------------------------------------------ */

export function rythmeJournalier(transactions: Transaction[], jours = 30): number {
  const limite = jour(new Date(Date.now() - (jours - 1) * JOUR).toISOString());
  const total = transactions
    .filter((t) => t.type === "depense" && jour(t.date) >= limite)
    .reduce((s, t) => s + t.montant, 0);
  return total / jours;
}

export function revenuMensuelMoyen(transactions: Transaction[], mois = 3): number {
  const limite = jour(new Date(Date.now() - mois * 30 * JOUR).toISOString());
  const total = transactions
    .filter((t) => t.type === "revenu" && jour(t.date) >= limite)
    .reduce((s, t) => s + t.montant, 0);
  return total / mois;
}

/* ------------------------------------------------------------------ */
/* Alerte trésorerie prédictive                                         */
/* ------------------------------------------------------------------ */

export type AlerteTresorerie = {
  compte: string;
  solde: number;
  chargesAVenir: number;
  depensesEstimees: number;
  soldeProjete: number;
  dateRupture: string | null;
  enDeficit: boolean;
};

export function alertesTresorerie(args: {
  soldesParCompte: Record<string, number>;
  budgets: Budget[];
  transactions: Transaction[];
}): AlerteTresorerie[] {
  const aujourdhui = new Date();
  const finDeMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0);
  const joursRestants = Math.max(1, finDeMois.getDate() - aujourdhui.getDate());
  const parJourGlobal = rythmeJournalier(args.transactions);

  const totalSoldes = Object.values(args.soldesParCompte).reduce(
    (s, v) => s + Math.max(0, v),
    0,
  );

  return Object.entries(args.soldesParCompte).map(([compte, solde]) => {
    const chargesAVenir = args.budgets
      .filter((b) => b.actif && b.compte === compte)
      .filter((b) => !b.prochaine || jour(b.prochaine) <= jour(finDeMois.toISOString()))
      .reduce((s, b) => s + b.montant, 0);
    const poids = totalSoldes > 0 ? Math.max(0, solde) / totalSoldes : 0;
    const depensesEstimees = Math.round(parJourGlobal * joursRestants * poids);
    const soldeProjete = solde - chargesAVenir - depensesEstimees;
    const sortieParJour = (chargesAVenir + depensesEstimees) / joursRestants;
    let dateRupture: string | null = null;
    if (soldeProjete < 0 && sortieParJour > 0) {
      const joursTenus = Math.max(0, Math.floor(solde / sortieParJour));
      dateRupture = jour(new Date(Date.now() + joursTenus * JOUR).toISOString());
    }
    return {
      compte,
      solde,
      chargesAVenir,
      depensesEstimees,
      soldeProjete,
      dateRupture,
      enDeficit: soldeProjete < 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Simulateur « Et si ? »                                               */
/* ------------------------------------------------------------------ */

export type ImpactAchat = {
  montant: number;
  soldeActuel: number;
  soldeApres: number;
  capaciteMensuelle: number;
  moisPourReconstituer: number | null;
  moisTrajectoire: { label: string; solde: number }[];
  verdict: "sereine" | "tendue" | "risquee";
  message: string;
};

export function simulerAchat(args: {
  montant: number;
  solde: number;
  transactions: Transaction[];
  differeMois?: number;
}): ImpactAchat {
  const revenus = revenuMensuelMoyen(args.transactions);
  const depenses = rythmeJournalier(args.transactions) * 30;
  const capacite = Math.round(revenus - depenses);
  const differe = Math.max(1, args.differeMois ?? 1);
  const parMois = args.montant / differe;

  const moisTrajectoire: { label: string; solde: number }[] = [];
  let courant = args.solde;
  const base = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    courant += capacite - (i < differe ? parMois : 0);
    moisTrajectoire.push({
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      solde: Math.round(courant),
    });
  }

  const soldeApres = args.solde - (differe === 1 ? args.montant : parMois);
  const moisPourReconstituer = capacite > 0 ? Math.ceil(args.montant / capacite) : null;
  const creux = Math.min(...moisTrajectoire.map((m) => m.solde));

  let verdict: ImpactAchat["verdict"] = "sereine";
  if (creux < 0) verdict = "risquee";
  else if (soldeApres < depenses / 2 || (moisPourReconstituer ?? 99) > 6) verdict = "tendue";

  const message =
    verdict === "risquee"
      ? "Cet achat vous ferait passer en négatif dans les 12 prochains mois. Reportez-le ou étalez le paiement."
      : verdict === "tendue"
        ? "Cet achat est possible mais il fragilise votre marge de sécurité. Prévoyez un étalement."
        : "Cet achat reste compatible avec votre trajectoire financière.";

  return {
    montant: args.montant,
    soldeActuel: args.solde,
    soldeApres,
    capaciteMensuelle: capacite,
    moisPourReconstituer,
    moisTrajectoire,
    verdict,
    message,
  };
}

/* ------------------------------------------------------------------ */
/* Plans de redressement à 3 scénarios                                  */
/* ------------------------------------------------------------------ */

export type Scenario = {
  id: "conservateur" | "equilibre" | "agressif";
  titre: string;
  resume: string;
  actions: string[];
  effortMensuel: number;
  duree: number;
};

function formater(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

export function plansRedressement(args: {
  choc: number;
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
}): Scenario[] {
  const choc = Math.max(0, args.choc);
  const classement = args.enveloppes
    .map((e) => ({ e, depense: args.depensesParEnveloppe[e.id] ?? 0 }))
    .sort((a, b) => b.depense - a.depense);
  const cibles = classement.slice(0, 2).map((c) => c.e.nom);
  const libelleCibles = cibles.length > 0 ? cibles.join(" et ") : "vos postes variables";

  return [
    {
      id: "conservateur",
      titre: "Option conservatrice",
      resume: `Réduction forte de ${libelleCibles} sur 45 jours.`,
      actions: [
        `Réduire de 60 % les dépenses de ${libelleCibles} pendant 45 jours.`,
        `Économie attendue : environ ${formater(choc * 0.6)} sur la période.`,
        "Aucun recours à l'épargne ni au fonds d'urgence.",
      ],
      effortMensuel: Math.round((choc / 45) * 30),
      duree: 2,
    },
    {
      id: "equilibre",
      titre: "Option équilibrée",
      resume: "Suspension temporaire de l'épargne projet pendant 1 mois.",
      actions: [
        "Suspendre les versements d'épargne du mois en cours.",
        `Réduire de 25 % ${libelleCibles} pendant 3 mois.`,
        `Effort réparti : environ ${formater(choc / 3)} par mois.`,
      ],
      effortMensuel: Math.round(choc / 3),
      duree: 3,
    },
    {
      id: "agressif",
      titre: "Option agressive",
      resume: "Prélèvement sur le fonds d'urgence, réapprovisionné sur 6 mois.",
      actions: [
        `Prélever ${formater(choc)} immédiatement sur la réserve disponible.`,
        `Réapprovisionner à raison de ${formater(choc / 6)} par mois pendant 6 mois.`,
        "Aucune coupe immédiate dans les enveloppes du quotidien.",
      ],
      effortMensuel: Math.round(choc / 6),
      duree: 6,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Arbitrage épargne vs dette                                           */
/* ------------------------------------------------------------------ */

export type Arbitrage = {
  recommandation: "dette" | "epargne";
  detteCiblee: { personne: string; reste: number } | null;
  coutDette: number;
  rendementEpargne: number;
  message: string;
};

export function arbitrerEpargneDette(args: {
  dettes: Dette[];
  tauxDette: number;
  tauxEpargne: number;
  montantDisponible: number;
}): Arbitrage {
  const dettesDues = args.dettes
    .filter((d) => d.sens === "dette" && resteDu(d) > 0)
    .sort((a, b) => resteDu(b) - resteDu(a));
  const cible = dettesDues[0];
  const coutDette = Math.round((args.montantDisponible * args.tauxDette) / 100);
  const rendementEpargne = Math.round((args.montantDisponible * args.tauxEpargne) / 100);
  const versDette = cible !== undefined && coutDette >= rendementEpargne;

  return {
    recommandation: versDette ? "dette" : "epargne",
    detteCiblee: cible ? { personne: cible.personne, reste: resteDu(cible) } : null,
    coutDette,
    rendementEpargne,
    message: versDette
      ? `Remboursez d'abord ${cible?.personne} : chaque franc remboursé vous économise ${formater(
          coutDette - rendementEpargne,
        )} par an de plus que l'épargne.`
      : dettesDues.length === 0
        ? "Aucune dette en cours : placez ce montant en épargne ou en tontine."
        : `Placez ce montant en épargne : son rendement dépasse le coût de vos dettes de ${formater(
            rendementEpargne - coutDette,
          )} par an.`,
  };
}

/* ------------------------------------------------------------------ */
/* Détection des fuites et frais récurrents                             */
/* ------------------------------------------------------------------ */

export type Fuite = {
  libelle: string;
  occurrences: number;
  total: number;
  moyenne: number;
  conseil: string;
};

export function detecterFuites(transactions: Transaction[], jours = 30): Fuite[] {
  const limite = jour(new Date(Date.now() - jours * JOUR).toISOString());
  const carte = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.type !== "depense" || jour(t.date) < limite) continue;
    const cle = t.libelle.trim().toUpperCase() || "SANS LIBELLÉ";
    carte.set(cle, [...(carte.get(cle) ?? []), t.montant]);
  }
  return [...carte.entries()]
    .filter(([, montants]) => montants.length >= 3)
    .map(([libelle, montants]) => {
      const total = montants.reduce((s, m) => s + m, 0);
      const moyenne = Math.round(total / montants.length);
      const groupables = montants.length >= 5 && moyenne < 5000;
      return {
        libelle,
        occurrences: montants.length,
        total,
        moyenne,
        conseil: groupables
          ? `Regrouper ces ${montants.length} petites opérations en 2 opérations pourrait vous économiser une partie des ${formater(
              total,
            )} dépensés.`
          : `Poste récurrent : ${montants.length} opérations pour ${formater(total)} en ${jours} jours.`,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export type Doublon = { libelle: string; montant: number; date: string; nombre: number };

export function detecterDoublons(transactions: Transaction[]): Doublon[] {
  const carte = new Map<string, { t: Transaction; nombre: number }>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const cle = `${jour(t.date)}|${t.libelle.trim().toUpperCase()}|${t.montant}`;
    const actuel = carte.get(cle);
    carte.set(cle, { t, nombre: (actuel?.nombre ?? 0) + 1 });
  }
  return [...carte.values()]
    .filter((v) => v.nombre > 1)
    .map((v) => ({
      libelle: v.t.libelle,
      montant: v.t.montant,
      date: jour(v.t.date),
      nombre: v.nombre,
    }))
    .sort((a, b) => b.montant * b.nombre - a.montant * a.nombre);
}
