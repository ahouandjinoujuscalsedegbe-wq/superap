// Point d'entrée de l'application mobile native (build Capacitor).
// Rendu 100% côté client : aucun serveur n'est nécessaire, toutes les
// données restent dans le téléphone (localStorage), comme en mode web.
import { createRoot } from "react-dom/client";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

// Dans la WebView Android, l'URL de départ est un fichier (index.html) :
// un historique en mémoire évite toute page « 404 » au démarrage.
const router = getRouter(createMemoryHistory({ initialEntries: ["/"] }));

const racine = document.getElementById("root");
if (racine) {
  createRoot(racine).render(<RouterProvider router={router} />);
}
