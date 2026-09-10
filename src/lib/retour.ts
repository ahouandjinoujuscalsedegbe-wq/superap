import type { AnyRouter } from "@tanstack/react-router";

/**
 * Retour arrière fiable et unifié.
 *
 * Défauts corrigés :
 * - `window.history.length > 1` est faux dès qu'un onglet a déjà servi à autre
 *   chose : il pouvait faire sortir de l'application (page précédente externe).
 * - Une arrivée directe sur une page profonde (lien, notification, rechargement)
 *   n'avait pas de parent : le retour quittait l'application.
 * - Chaque écran réimplémentait sa propre logique (`window.history.back`,
 *   `router.history.back`), donc des comportements différents.
 */

/** Chemin parent d'une route : /objectifs/action/creer -> /objectifs/action */
export function cheminParent(pathname: string): string {
  const parties = pathname.split("/").filter(Boolean);
  if (parties.length <= 1) return "/";
  parties.pop();
  return "/" + parties.join("/");
}

/** Vrai si l'on peut reculer sans sortir de l'application. */
export function peutReculer(router: AnyRouter): boolean {
  const historique = router.history as unknown as {
    canGoBack?: () => boolean;
    length?: number;
  };
  if (typeof historique.canGoBack === "function") return historique.canGoBack();
  // Repli : au moins une navigation interne a eu lieu dans cette session.
  return (router.state.location.state as { key?: string } | undefined) !== undefined
    ? window.history.length > 1
    : false;
}

/**
 * Recule d'un cran dans l'application ; à défaut remonte vers la page parente,
 * et en dernier recours vers l'accueil. Ne sort jamais de l'application.
 */
export function retourIntelligent(router: AnyRouter): void {
  if (peutReculer(router)) {
    router.history.back();
    return;
  }
  const parent = cheminParent(router.state.location.pathname);
  void router.navigate({ to: parent, replace: true }).catch(() => {
    void router.navigate({ to: "/", replace: true });
  });
}
