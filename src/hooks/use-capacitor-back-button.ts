import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Gère le bouton "Retour" matériel d'Android pour la navigation TanStack Router.
 * 
 * 1. Ferme d'abord les overlays (clavier interne, menu, dialogs).
 * 2. Si l'application est verrouillée, quitte immédiatement.
 * 3. Sinon, recule dans l'historique du routeur ou quitte si à la racine.
 */
export function useCapacitorBackButton() {
  const router = useRouter();
  const isMobile = import.meta.env["VITE_COQUE_MOBILE"] || Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isMobile) return;

    const handler = App.addListener('backButton', () => {
      // 1. Détection des overlays
      const menuOuvert = document.getElementById('menu-principal')?.getAttribute('aria-hidden') === 'false';
      const clavierOuvert = document.querySelector('[data-clavier-interne]') !== null;
      const overlayOuvert = document.querySelector('[role="dialog"], [role="alertdialog"], [data-state="open"]') !== null;
      const verrouille = document.getElementById('ecran-verrou') !== null;

      // 2. Si verrouillé, le "retour" quitte l'app pour des raisons de sécurité (ne pas naviguer derrière).
      if (verrouille) {
        App.exitApp();
        return;
      }

      // 3. Fermeture des overlays via Escape
      if (menuOuvert || clavierOuvert || overlayOuvert) {
        document.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Escape', 
          bubbles: true,
          cancelable: true 
        }));
        return;
      }

      // 4. Navigation Router
      if (router.state.location.pathname !== '/') {
        router.history.back();
      } else {
        // 5. Sortie de l'application si on est à l'accueil
        App.exitApp();
      }
    });

    return () => {
      handler.then(h => h.remove());
    };
  }, [router, isMobile]);
}
