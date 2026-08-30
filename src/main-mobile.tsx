// Point d'entrée de l'application mobile native (build Capacitor).
// Rendu 100% côté client : aucun serveur n'est nécessaire, toutes les
// données restent dans le téléphone (localStorage), comme en mode web.
import { installerCompatibiliteMobile } from "./lib/compat-mobile";

// Doit rester la toute première instruction exécutée : sans ces
// remplacements d'API, une WebView Android ancienne plante avant l'affichage.
installerCompatibiliteMobile();

import { createRoot } from "react-dom/client";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const racine = document.getElementById("root");

/** Affiche l'erreur dans l'écran au lieu de laisser une page blanche. */
function afficherPanne(message: string) {
  if (!racine) return;
  racine.innerHTML = `
    <div style="padding:20px;font-family:system-ui,sans-serif;color:#3b1d29">
      <h1 style="font-size:18px;margin:0 0 8px">L'application n'a pas pu démarrer</h1>
      <p style="font-size:13px;margin:0 0 12px">Détail technique (à me transmettre) :</p>
      <pre style="white-space:pre-wrap;font-size:12px;background:#f6e6ec;padding:10px;border-radius:8px">${message.replace(
        /[<>&]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
      )}</pre>
      <button onclick="location.reload()" style="margin-top:14px;padding:10px 16px;border:0;border-radius:8px;background:#c2557a;color:#fff;font-size:14px">Redémarrer</button>
    </div>`;
}

window.addEventListener("error", (ev) => {
  if (racine && racine.childElementCount === 0) {
    afficherPanne(`${ev.message}\n${ev.filename ?? ""}:${ev.lineno ?? ""}`);
  }
});
window.addEventListener("unhandledrejection", (ev) => {
  if (racine && racine.childElementCount === 0) {
    afficherPanne(String((ev as PromiseRejectionEvent).reason));
  }
});

try {
  // Dans la WebView Android, l'URL de départ est un fichier (index.html) :
  // un historique en mémoire évite toute page « 404 » au démarrage.
  const router = getRouter(createMemoryHistory({ initialEntries: ["/"] }));
  if (racine) createRoot(racine).render(<RouterProvider router={router} />);
} catch (erreur) {
  afficherPanne(
    erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ""}` : String(erreur),
  );
}
