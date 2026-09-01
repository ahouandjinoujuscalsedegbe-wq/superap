import { useCallback, useEffect, useRef } from "react";
import { remplissagesDus } from "@/lib/remplissage";
import { useSuperApp } from "@/lib/store";
import { classerRapportAvantRenouvellement } from "@/lib/rapport-enveloppes";

/**
 * Renouvelle seul le contenu des enveloppes dont la période est écoulée :
 * au démarrage, au retour dans l'application et toutes les heures.
 * Chaque versement est débité du compte qui alimente l'enveloppe.
 */
export function RemplissageAuto() {
  const { enveloppes, transactions, remplissages, remplirEnveloppe, chargement } = useSuperApp();
  const enCours = useRef(false);

  const appliquer = useCallback(() => {
    if (chargement || enCours.current) return;
    const dus = remplissagesDus(enveloppes, transactions);
    if (dus.length === 0) return;
    // Avant tout renouvellement, le mois écoulé est figé dans le rapport
    // d'utilisation quotidienne des enveloppes.
    classerRapportAvantRenouvellement(enveloppes, transactions, remplissages);
    enCours.current = true;
    for (const d of dus) {
      remplirEnveloppe(d.enveloppe.id, d.montant, d.compte, "periode", d.date);
    }
    enCours.current = false;
  }, [chargement, enveloppes, transactions, remplissages, remplirEnveloppe]);

  useEffect(() => {
    appliquer();
    const minuterie = window.setInterval(appliquer, 60 * 60 * 1000);
    const auRetour = () => {
      if (document.visibilityState === "visible") appliquer();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [appliquer]);

  return null;
}
