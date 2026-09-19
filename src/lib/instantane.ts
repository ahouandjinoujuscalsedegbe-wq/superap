/**
 * Instantané des données à sauvegarder (e-mail, fichier de secours).
 * Un seul endroit décrit ce qui doit être copié : ainsi aucune liste n'est
 * oubliée dans l'une des sauvegardes. En plus de l'état principal, la copie
 * embarque tous les réglages personnels et les saisies en cours, pour que
 * pas un point, pas une virgule ne manque.
 */

import type { Etat } from "@/lib/store";
import { collecterReglages } from "@/lib/reglages-complets";
import { lireBrouillons, type Brouillon } from "@/lib/brouillons";

export type InstantaneComplet = Partial<Etat> & {
  reglages?: Record<string, string>;
  brouillons?: Record<string, Brouillon>;
};

export function instantaneEtat(etat: Etat): InstantaneComplet {
  const reglages = collecterReglages();
  const brouillons = lireBrouillons();
  return {
    transactions: etat.transactions,
    enveloppes: etat.enveloppes,
    categories: etat.categories,
    comptes: etat.comptes,
    comptesExclus: etat.comptesExclus,
    ordreComptes: etat.ordreComptes,
    iconesComptes: etat.iconesComptes,
    transferts: etat.transferts,
    reglesTransfert: etat.reglesTransfert,
    comptesReserves: etat.comptesReserves,
    comptesRelais: etat.comptesRelais,
    remplissages: etat.remplissages,
    budgets: etat.budgets,
    dettes: etat.dettes,
    objectifs: etat.objectifs,
    corbeille: etat.corbeille,
    membres: etat.membres,
    transparence: etat.transparence,
    ...(etat.nomUtilisateur ? { nomUtilisateur: etat.nomUtilisateur } : {}),
    ...(Object.keys(reglages).length > 0 ? { reglages } : {}),
    ...(Object.keys(brouillons).length > 0 ? { brouillons } : {}),
  };
}
