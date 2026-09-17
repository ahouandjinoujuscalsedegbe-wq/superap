/**
 * Première connexion sur un téléphone : tant que le dossier du coffre local
 * n'existe pas, l'application ouvre la page dédiée /coffre. Aucun panneau ne se
 * superpose à une autre page : le clavier reste donc entièrement utilisable.
 */

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { dossierAcreer } from "@/lib/coffre-dossier";

export function CreationDossierCoffre() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname === "/coffre") return;
    if (dossierAcreer()) navigate({ to: "/coffre", replace: true });
  }, [pathname, navigate]);

  return null;
}
