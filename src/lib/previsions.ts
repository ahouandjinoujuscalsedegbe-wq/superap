/**
 * Prévisions financières mois par mois, calculées entièrement sur l'appareil.
 *
 * Le moteur part des habitudes observées (revenus et dépenses moyens des mois
 * vécus), y ajoute les objectifs futurs saisis par l'utilisateur (projets
 * ponctuels ou récurrents) ainsi que l'effort d'épargne exigé par les
 * objectifs déjà suivis, puis déroule le solde mois après mois.
 */

import type { Enveloppe, Objectif, Transaction } from "./store";
import { decalerMois, PERIODES_PAR_MOIS, revenuMensuelMoyen } from "./budget-mensuel";
import { suivreObjectifs } from "./objectifs";
import { lireSecurise, ecrireSecurise } from "./coffre-local";

/** Objectif futur saisi par l'utilisateur (dépense ou rentrée à venir). */
export type ProjetFutur = {
  id: string;
  libelle: string;
  /** Montant en FCFA. */
  montant: number;
  /** Mois concerné, au format AAAA-MM. */
  mois: string;
  sens: "depense" | "revenu";
  /** true : le montant revient chaque mois à partir du mois indiqué. */
  recurrent: boolean;
};

export type MoisPrevu = {
  mois: string;
  libelle: string;
  revenusHabituels: number;
  revenusProjets: number;
  depensesHabituelles: number;
  depensesProjets: number;
  epargneObjectifs: number;
  /** Total des entrées prévues. */
  revenus: number;
  /** Total des sorties prévues (dépenses + épargne mise de côté). */
  depenses: number;
  /** revenus - depenses du mois. */
  net: number;
  /** Solde cumulé projeté à la fin du mois. */
  soldeFin: number;
  /** Projets tombant sur ce mois. */
  projets: ProjetFutur[];
  niveau: "sain" | "tendu" | "critique";
};

export type Previsions = {
  moisPrevus: MoisPrevu[];
  revenuMoyen: number;
  depenseMoyenne: number;
  /** Premier mois où le solde projeté devient négatif, si applicable. */
  moisDeficit?: string;
  /** Solde à la fin de l'horizon. */
  soldeFinal: number;
  /** Synthèse en une phrase, en français. */
  resume: string;
};

const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Libellé lisible d'un mois AAAA-MM. */
export function libelleMoisPrevu(mois: string): string {
  const [a, m] = mois.split("-");
  return `${MOIS_FR[Number(m) - 1] ?? m} ${a}`;
}

/** Dépense mensuelle moyenne observée ; à défaut, somme des budgets d'enveloppes. */
export function depenseMensuelleMoyenne(
  transactions: Transaction[],
  enveloppes: Enveloppe[],
): number {
  const parMois: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const m = t.date.slice(0, 7);
    parMois[m] = (parMois[m] ?? 0) + t.montant;
  }
  const mois = Object.keys(parMois);
  if (mois.length > 0) {
    const total = mois.reduce((s, m) => s + (parMois[m] ?? 0), 0);
    return total / mois.length;
  }
  // Aucune dépense enregistrée : on s'appuie sur les enveloppes renouvelées.
  return enveloppes.reduce((s, e) => {
    if (e.modeRemplissage === "fixe" && e.montantPeriode && e.periodeRenouvellement) {
      return s + e.montantPeriode * PERIODES_PAR_MOIS[e.periodeRenouvellement];
    }
    return s + (e.plafond || 0);
  }, 0);
}

/** Effort d'épargne mensuel encore exigé par les objectifs suivis. */
export function effortObjectifs(
  objectifs: Objectif[],
  transactions: Transaction[],
  mois: string,
): number {
  const suivis = suivreObjectifs(objectifs, transactions);
  let total = 0;
  for (const s of suivis) {
    if (s.etat === "atteint") continue;
    if (s.objectif.dateCible.slice(0, 7) < mois) continue;
    total += s.effortMensuel;
  }
  return total;
}

function projetsDuMois(projets: ProjetFutur[], mois: string): ProjetFutur[] {
  return projets.filter((p) => (p.recurrent ? p.mois <= mois : p.mois === mois));
}

/** Déroule la prévision mois par mois sur l'horizon demandé. */
export function projeter(args: {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  objectifs: Objectif[];
  projets: ProjetFutur[];
  soldeActuel: number;
  horizon?: number;
  moisDepart?: string;
}): Previsions {
  const horizon = Math.max(1, Math.min(36, args.horizon ?? 12));
  const depart = args.moisDepart ?? new Date().toISOString().slice(0, 7);
  const revenuMoyen = Math.round(revenuMensuelMoyen(args.transactions));
  const depenseMoyenne = Math.round(
    depenseMensuelleMoyenne(args.transactions, args.enveloppes),
  );

  let solde = args.soldeActuel;
  let moisDeficit: string | undefined;
  const moisPrevus: MoisPrevu[] = [];

  for (let i = 0; i < horizon; i += 1) {
    const mois = decalerMois(depart, i + 1);
    const liste = projetsDuMois(args.projets, mois);
    const revenusProjets = liste
      .filter((p) => p.sens === "revenu")
      .reduce((s, p) => s + p.montant, 0);
    const depensesProjets = liste
      .filter((p) => p.sens === "depense")
      .reduce((s, p) => s + p.montant, 0);
    const epargne = Math.round(effortObjectifs(args.objectifs, args.transactions, mois));

    const revenus = revenuMoyen + revenusProjets;
    const depenses = depenseMoyenne + depensesProjets + epargne;
    const net = revenus - depenses;
    solde += net;
    if (solde < 0 && !moisDeficit) moisDeficit = mois;

    const niveau: MoisPrevu["niveau"] =
      solde < 0 ? "critique" : net < 0 || solde < depenseMoyenne * 0.5 ? "tendu" : "sain";

    moisPrevus.push({
      mois,
      libelle: libelleMoisPrevu(mois),
      revenusHabituels: revenuMoyen,
      revenusProjets,
      depensesHabituelles: depenseMoyenne,
      depensesProjets,
      epargneObjectifs: epargne,
      revenus,
      depenses,
      net,
      soldeFin: Math.round(solde),
      projets: liste,
      niveau,
    });
  }

  const soldeFinal = Math.round(solde);
  const fcfa = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
  const resume = moisDeficit
    ? `Au rythme actuel, votre solde devient négatif en ${libelleMoisPrevu(moisDeficit)}. Réduisez les dépenses ou décalez un projet avant cette date.`
    : soldeFinal > args.soldeActuel
      ? `Votre trajectoire est bonne : ${fcfa(soldeFinal)} prévus à la fin de la période, soit ${fcfa(soldeFinal - args.soldeActuel)} de plus qu'aujourd'hui.`
      : `Vos projets consomment votre épargne : ${fcfa(soldeFinal)} resteront à la fin de la période contre ${fcfa(args.soldeActuel)} aujourd'hui.`;

  return { moisPrevus, revenuMoyen, depenseMoyenne, moisDeficit, soldeFinal, resume };
}

// ------------------------------------------------ stockage local chiffré

const CLE_PROJETS = "superapp-projets-futurs";

function assainirProjet(v: unknown): ProjetFutur | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const montant = Number(o["montant"]);
  const libelle = typeof o["libelle"] === "string" ? o["libelle"].trim() : "";
  const mois = typeof o["mois"] === "string" ? o["mois"].slice(0, 7) : "";
  if (!libelle || !Number.isFinite(montant) || montant <= 0) return null;
  if (!/^\d{4}-\d{2}$/.test(mois)) return null;
  return {
    id: typeof o["id"] === "string" ? o["id"] : crypto.randomUUID(),
    libelle,
    montant: Math.round(montant),
    mois,
    sens: o["sens"] === "revenu" ? "revenu" : "depense",
    recurrent: o["recurrent"] === true,
  };
}

/** Lit les projets futurs enregistrés (stockage chiffré local). */
export async function lireProjets(): Promise<ProjetFutur[]> {
  const brut = await lireSecurise(CLE_PROJETS);
  if (!brut) return [];
  try {
    const data = JSON.parse(brut);
    if (!Array.isArray(data)) return [];
    return data.map(assainirProjet).filter((p): p is ProjetFutur => p !== null);
  } catch {
    return [];
  }
}

/** Enregistre les projets futurs (stockage chiffré local). */
export async function ecrireProjets(projets: ProjetFutur[]): Promise<void> {
  await ecrireSecurise(CLE_PROJETS, JSON.stringify(projets));
}
