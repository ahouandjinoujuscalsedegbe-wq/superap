// Point d'entrée de l'application mobile native (build Capacitor).
// Rendu 100% côté client : aucun serveur n'est nécessaire, toutes les
// données restent dans le téléphone (localStorage), comme en mode web.
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

const racine = document.getElementById("root");
if (racine) {
  createRoot(racine).render(<RouterProvider router={router} />);
}
