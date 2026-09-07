// Point d'entrée de l'application mobile native (build Capacitor).
// Rendu 100% côté client : aucun serveur n'est nécessaire, toutes les
// données restent dans le téléphone (localStorage), comme en mode web.
import { installerCompatibiliteMobile } from "./lib/compat-mobile";

// Doit rester la toute première instruction exécutée : sans ces
// remplacements d'API, une WebView Android ancienne plante avant l'affichage.
installerCompatibiliteMobile();

import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const racine = document.getElementById("root");

/** Dernière erreur observée, réutilisée par le filet de sécurité. */
let derniereErreur = "";

/** Cache l'écran de démarrage, quoi qu'il arrive. */
function masquerSplash() {
  void import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 350 }))
    .catch(() => undefined);
}

/** Affiche l'erreur dans l'écran au lieu de laisser une page blanche ou noire. */
function afficherPanne(message: string) {
  if (!racine) return;
  masquerSplash();
  racine.innerHTML = `
    <div style="padding:20px;font-family:system-ui,sans-serif;color:#3b1d29;background:#fdf2f6;min-height:100vh">
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
  derniereErreur = `${ev.message}\n${ev.filename ?? ""}:${ev.lineno ?? ""}`;
  if (racine && racine.childElementCount === 0) afficherPanne(derniereErreur);
});
window.addEventListener("unhandledrejection", (ev) => {
  derniereErreur = String((ev as PromiseRejectionEvent).reason);
  if (racine && racine.childElementCount === 0) afficherPanne(derniereErreur);
});

/**
 * Filet de sécurité : si l'interface plante pendant l'affichage, l'écran
 * resterait vide (noir) sans aucun message. On affiche alors le détail.
 */
class FiletSecurite extends Component<{ children: ReactNode }, { panne: string | null }> {
  override state: { panne: string | null } = { panne: null };

  static getDerivedStateFromError(erreur: unknown) {
    return {
      panne:
        erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ""}` : String(erreur ?? ""),
    };
  }

  override componentDidCatch() {
    masquerSplash();
  }

  override render() {
    if (this.state.panne === null) return this.props.children;
    return (
      <div
        style={{
          padding: 20,
          fontFamily: "system-ui, sans-serif",
          color: "#3b1d29",
          background: "#fdf2f6",
          minHeight: "100vh",
        }}
      >
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Un problème a interrompu l'affichage</h1>
        <p style={{ fontSize: 13, margin: "0 0 12px" }}>Détail technique (à me transmettre) :</p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            background: "#f6e6ec",
            padding: 10,
            borderRadius: 8,
          }}
        >
          {this.state.panne}
        </pre>
        <button
          type="button"
          onClick={() => location.reload()}
          style={{
            marginTop: 14,
            padding: "10px 16px",
            border: 0,
            borderRadius: 8,
            background: "#c2557a",
            color: "#fff",
            fontSize: 14,
          }}
        >
          Redémarrer
        </button>
      </div>
    );
  }
}

try {
  // Dans la WebView Android, l'URL de départ est un fichier (index.html) :
  // un historique en mémoire évite toute page « 404 » au démarrage.
  const router = getRouter(createMemoryHistory({ initialEntries: ["/"] }));
  if (racine) {
    createRoot(racine).render(
      <FiletSecurite>
        <RouterProvider router={router} />
      </FiletSecurite>,
    );
  }
  // L'écran de démarrage reste visible jusqu'à ce que l'interface soit prête.
  window.setTimeout(masquerSplash, 400);

  // Si au bout de 10 secondes rien n'est affiché, on ne laisse pas un écran
  // vide : l'utilisateur reçoit un message et un bouton pour redémarrer.
  window.setTimeout(() => {
    if (racine && racine.childElementCount === 0) {
      afficherPanne(
        derniereErreur ||
          "L'affichage ne s'est pas terminé. Redémarrez l'application ; si le problème persiste, réinstallez la dernière version.",
      );
    }
  }, 10000);
} catch (erreur) {
  afficherPanne(
    erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ""}` : String(erreur),
  );
}
