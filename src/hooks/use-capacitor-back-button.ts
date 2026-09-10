import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { retourIntelligent } from "../lib/retour";

/**
 * Gère le bouton "Retour" matériel d'Android pour la navigation TanStack Router.
 *
 * 1. Ferme d'abord les overlays (clavier interne, menu, dialogs).
 * 2. Si l'application est verrouillée, elle reste verrouillée (mise en arrière-plan).
 * 3. Sinon, recule dans l'application (jamais vers l'extérieur).
 * 4. À l'accueil, une seconde pression dans les 2 secondes quitte l'application.
 */
export function useCapacitorBackButton() {
  const router = useRouter();
  const dernierAppui = useRef(0);

  useEffect(() => {
    if (!import.meta.env["VITE_COQUE_MOBILE"] && !Capacitor.isNativePlatform()) return;

    const inscription = App.addListener("backButton", () => {
      const menuOuvert =
        document.getElementById("menu-principal")?.getAttribute("aria-hidden") === "false";
      const clavierOuvert = document.querySelector("[data-clavier-interne]") !== null;
      const dialogue = document.querySelector<HTMLElement>(
        '[role="dialog"], [role="alertdialog"], [data-state="open"]',
      );
      const verrouille = document.getElementById("ecran-verrou") !== null;

      // Écran de verrouillage : ne pas quitter (perte de contexte) ni naviguer
      // derrière ; l'application passe simplement en arrière-plan.
      if (verrouille) {
        void App.minimizeApp?.();
        return;
      }

      // Échap couvre Radix, le menu et le clavier interne. On ne clique plus sur
      // le dialogue lui-même : cela pouvait déclencher un bouton à l'intérieur.
      if (menuOuvert || clavierOuvert || dialogue) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
        if (dialogue && document.contains(dialogue)) {
          const fermeture = dialogue.querySelector<HTMLElement>(
            '[data-fermer], [aria-label="Fermer"], [aria-label="Annuler"]',
          );
          fermeture?.click();
        }
        return;
      }

      if (router.state.location.pathname !== "/") {
        retourIntelligent(router);
        return;
      }

      // Accueil : confirmation par double appui pour éviter les sorties accidentelles.
      const maintenant = Date.now();
      if (maintenant - dernierAppui.current < 2000) {
        void App.exitApp();
        return;
      }
      dernierAppui.current = maintenant;
      toast("Appuyez encore une fois pour quitter l'application");
    });

    return () => {
      void inscription.then((ecouteur) => ecouteur.remove());
    };
  }, [router]);
}
