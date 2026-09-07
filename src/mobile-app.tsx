import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const racine = document.getElementById("root");

function masquerSplash() {
  void import("@capacitor/splash-screen")
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 350 }))
    .catch(() => undefined);
}

class FiletSecurite extends Component<{ children: ReactNode }, { panne: string | null }> {
  override state: { panne: string | null } = { panne: null };

  static getDerivedStateFromError(erreur: unknown) {
    return {
      panne: erreur instanceof Error ? `${erreur.message}\n${erreur.stack ?? ""}` : String(erreur),
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
        <p style={{ fontSize: 13, margin: "0 0 12px" }}>Détail technique :</p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
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

export function demarrerApplicationMobile() {
  if (!racine) throw new Error("Zone d'affichage absente.");

  const router = getRouter(createMemoryHistory({ initialEntries: ["/"] }));
  createRoot(racine).render(
    <FiletSecurite>
      <RouterProvider router={router} />
    </FiletSecurite>,
  );
  window.setTimeout(masquerSplash, 400);
}
