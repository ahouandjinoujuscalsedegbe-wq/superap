/**
 * Première ouverture sur un téléphone : l'application ouvre d'abord la page
 * dédiée /compte (création de compte ou connexion), puis /coffre tant que le
 * dossier chiffré local n'existe pas. Aucun panneau ne se superpose à une autre
 * page : le clavier reste donc entièrement utilisable.
 */

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { dossierAcreer } from "@/lib/coffre-dossier";
import { compteConnecte } from "@/lib/compte-utilisateur";

export function CreationDossierCoffre() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname === "/compte") return;
    if (!compteConnecte()) {
      navigate({ to: "/compte", replace: true });
      return;
    }
    if (pathname === "/coffre") return;
    if (dossierAcreer()) navigate({ to: "/coffre", replace: true });
  }, [pathname, navigate]);

  return null;
}
