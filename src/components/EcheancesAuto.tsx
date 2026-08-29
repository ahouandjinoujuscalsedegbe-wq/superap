import { useEffect } from "react";
import { useSuperApp } from "@/lib/store";

/**
 * Convertit automatiquement en dépenses réelles les échéances planifiées
 * dont la date est arrivée : au démarrage de l'application, au retour dans
 * l'onglet et toutes les heures tant que l'application reste ouverte.
 */
export function EcheancesAuto() {
  const { genererEcheancesDues } = useSuperApp();

  useEffect(() => {
    genererEcheancesDues();
    const minuterie = window.setInterval(genererEcheancesDues, 60 * 60 * 1000);
    const auRetour = () => {
      if (document.visibilityState === "visible") genererEcheancesDues();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [genererEcheancesDues]);

  return null;
}
