import type { AnyRouter } from "@tanstack/react-router";

/**
 * Arbre de retour unique de l'application.
 *
 * Le retour ne dépend volontairement jamais de l'ordre des visites. Une page
 * possède toujours le même parent, qu'elle ait été ouverte depuis un lien, une
 * notification, l'accueil ou une autre rubrique.
 */

const PARENTS_EXACTS: Readonly<Record<string, string>> = {
  "/": "/",

  // Comptes
  "/comptes": "/",
  "/comptes/action": "/comptes",
  "/comptes/creer": "/comptes",
  "/comptes/historique": "/comptes",
  "/comptes/transferts": "/comptes",
  "/comptes/transferts/nouveau": "/comptes/transferts",

  // Enveloppes
  "/enveloppes": "/",
  "/enveloppes/action": "/enveloppes",
  "/enveloppes/budget-mensuel": "/enveloppes",
  "/enveloppes/categories": "/enveloppes/action",
  "/enveloppes/chronologie": "/enveloppes/action",
  "/enveloppes/classer": "/enveloppes/action",
  "/enveloppes/creer": "/enveloppes/action",
  "/enveloppes/details": "/enveloppes",
  "/enveloppes/modifier": "/enveloppes/action",
  "/enveloppes/renouvellements": "/enveloppes/action",
  "/enveloppes/secours": "/enveloppes/action",

  // Budgétisation
  "/budget": "/",
  "/budget/auto": "/budget",
  "/budget/bilan": "/budget",
  "/budget/confirmations": "/budget",
  "/budget/modifier": "/budget",
  "/budget/plan": "/budget",
  "/budget/planifier": "/budget/plan",
  "/budget/suivi": "/budget",

  // Objectifs
  "/objectifs": "/",
  "/objectifs/action": "/objectifs",
  "/objectifs/action/creer": "/objectifs/action",
  "/objectifs/action/gerer": "/objectifs/action",

  // Conseiller
  "/notifications": "/",
  "/conseiller/donnees": "/notifications",

  // Paramètres et outils associés
  "/parametres": "/",
  "/parametres/alarmes": "/parametres",
  "/parametres/clavier": "/parametres",
  "/parametres/donnees": "/parametres",
  "/parametres/mises-a-jour": "/parametres",
  "/parametres/profil": "/parametres",
  "/parametres/securite": "/parametres",
  "/aide": "/parametres",
  "/journal": "/parametres",
  "/sauvegarde": "/parametres",
  "/synchronisation": "/parametres",

  // Entrées principales indépendantes
  "/depense": "/",
  "/dettes": "/",
  "/historique/depenses": "/depense",
  "/historique/revenus": "/revenu",
  "/rapport": "/",
  "/recherche": "/",
  "/revenu": "/",
  "/saisie": "/",
  "/simulation": "/",
};

const PARENTS_DYNAMIQUES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/comptes\/modifier\/[^/]+$/, "/comptes/action"],
  [/^\/comptes\/categorie\/[^/]+$/, "/comptes"],
  [/^\/comptes\/[^/]+$/, "/comptes"],
  [/^\/enveloppes\/modifier\/[^/]+$/, "/enveloppes/modifier"],
  [/^\/enveloppes\/categorie\/[^/]+$/, "/enveloppes"],
  [/^\/budget\/modifier\/[^/]+$/, "/budget/modifier"],
  [/^\/budget\/plan-par\/[^/]+$/, "/budget/plan"],
  [/^\/budget\/suivi-par\/[^/]+$/, "/budget/suivi"],
  [/^\/rapport\/[^/]+$/, "/rapport"],
];

function normaliserChemin(pathname: string): string {
  const sansParametres = pathname.split(/[?#]/, 1)[0] || "/";
  if (sansParametres === "/") return "/";
  return sansParametres.replace(/\/+$/, "") || "/";
}

/** Renvoie le parent fonctionnel et stable d'une page dans l'arbre. */
export function cheminParent(pathname: string): string {
  const chemin = normaliserChemin(pathname);
  const parentExact = PARENTS_EXACTS[chemin];
  if (parentExact) return parentExact;

  const regle = PARENTS_DYNAMIQUES.find(([motif]) => motif.test(chemin));
  if (regle) return regle[1];

  // Une éventuelle nouvelle page reste sûre : elle remonte dans son URL,
  // puis finit à l'accueil, sans consulter l'historique du téléphone.
  const parties = chemin.split("/").filter(Boolean);
  if (parties.length <= 1) return "/";
  parties.pop();
  return `/${parties.join("/")}`;
}

/** Remonte exactement d'un niveau dans l'arbre, sans suivre l'historique. */
export function retourIntelligent(router: AnyRouter): void {
  const parent = cheminParent(router.state.location.pathname);
  void router.navigate({ to: parent, replace: true }).catch(() => {
    void router.navigate({ to: "/", replace: true });
  });
}
