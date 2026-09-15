/**
 * Instantané des données à sauvegarder (e-mail, fichier de secours).
 * Un seul endroit décrit ce qui doit être copié : ainsi aucune liste n'est
 * oubliée dans l'une des sauvegardes.
 */

import type { Etat } from "@/lib/store";

export function instantaneEtat(etat: Etat): Partial<Etat> {
  return {
    transactions: etat.transactions,
    enveloppes: etat.enveloppes,
    categories: etat.categories,
    comptes: etat.comptes,
    comptesExclus: etat.comptesExclus,
    ordreComptes: etat.ordreComptes,
    iconesComptes: etat.iconesComptes,
    transferts: etat.transferts,
    remplissages: etat.remplissages,
    budgets: etat.budgets,
    dettes: etat.dettes,
    objectifs: etat.objectifs,
    corbeille: etat.corbeille,
    membres: etat.membres,
    transparence: etat.transparence,
    ...(etat.nomUtilisateur ? { nomUtilisateur: etat.nomUtilisateur } : {}),
  };
}
