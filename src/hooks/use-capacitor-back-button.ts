import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Gère le bouton "Retour" matériel d'Android pour la navigation TanStack Router.
 * 
 * 1. Ferme d'abord les overlays (clavier interne, menu, dialogs).
 * 2. Si l'application est verrouillée, quitte immédiatement.
 * 3. Sinon, recule dans l'historique du routeur ou quitte si à la racine.
 */
export function useCapacitorBackButton() {
  const router = useRouter();
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

      // 2. Si verrouillé, le "retour" quitte l'app pour des raisons de sécurité (ne pas naviguer derrière).
      if (verrouille) {
        void App.exitApp();
        return;
      }

      // Échap couvre Radix, le menu et le clavier. Le clic de repli couvre
      // les anciennes fenêtres personnalisées qui se ferment via leur fond.
      if (menuOuvert || clavierOuvert || dialogue) {
        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }));
        if (dialogue && document.contains(dialogue)) dialogue.click();
        return;
      }

      // 4. Navigation Router
      if (router.state.location.pathname !== "/") {
        router.history.back();
      } else {
        void App.exitApp();
      }
    });

    return () => {
      void inscription.then((ecouteur) => ecouteur.remove());
    };
  }, [router]);
}
