/**
 * Cerveau local : point d'entrée unique des analyses de l'application.
 *
 * Trois couches :
 *   1. faits.ts    — les chiffres, calculés une seule fois ;
 *   2. regles.ts   — les détections, écrites une seule fois ;
 *   3. discours.ts — la mise en mots, selon l'écran qui appelle.
 *
 * Tout écran qui a besoin d'un chiffre, d'une alerte ou d'un conseil doit
 * passer par `analyser()` afin que l'application dise partout la même chose.
 */
import { calculerFaits, type DonneesCerveau, type Faits } from "./faits";
import { evaluerRegles, type Constat } from "./regles";
import { enAlerte, resumeDuMois, type AlerteAffichable } from "./discours";

export * from "./faits";
export * from "./regles";
export * from "./discours";

export type Analyse = {
  faits: Faits;
  constats: Constat[];
  alertes: AlerteAffichable[];
  resume: string;
};

let cacheCle = "";
let cacheValeur: Analyse | null = null;

/** Signature légère des données : évite de tout recalculer à chaque rendu. */
function signature(d: DonneesCerveau): string {
  const derniere = d.transactions[d.transactions.length - 1];
  return [
    d.transactions.length,
    derniere?.id ?? "",
    d.enveloppes.length,
    d.enveloppes.reduce((s, e) => s + (e.dotation ?? e.plafond), 0),
    d.dettes?.length ?? 0,
    d.objectifs?.length ?? 0,
    d.solde ?? "",
    new Date(d.maintenant ?? Date.now()).toISOString().slice(0, 13),
  ].join("|");
}

/** Analyse complète et mise en cache des données de l'application. */
export function analyser(donnees: DonneesCerveau): Analyse {
  const cle = signature(donnees);
  if (cle === cacheCle && cacheValeur) return cacheValeur;
  const faits = calculerFaits(donnees);
  const constats = evaluerRegles(faits);
  const analyse: Analyse = {
    faits,
    constats,
    alertes: constats.map(enAlerte),
    resume: resumeDuMois(faits, constats),
  };
  cacheCle = cle;
  cacheValeur = analyse;
  return analyse;
}

/** Vide le cache : à appeler après une restauration de sauvegarde. */
export function oublierCache(): void {
  cacheCle = "";
  cacheValeur = null;
}
