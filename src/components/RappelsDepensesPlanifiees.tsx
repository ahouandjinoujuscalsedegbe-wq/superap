import { useCallback, useEffect } from "react";
import { useSuperApp } from "@/lib/store";
import { declencherAlarmeAppareil } from "@/lib/alarme-appareil";
import { publierAlerteConseiller } from "@/lib/alertes-conseiller";
import { echeancesDues, marquerRappelSonne, momentRappel, rappelNonSonne } from "@/lib/echeances-dues";
import { formatFCFA } from "@/lib/format";

/**
 * Surveille les dépenses planifiées : dès que l'heure de rappel est atteinte,
 * une alarme sonne et « Mon conseiller » prévient l'utilisateur.
 * Aucune dépense n'est enregistrée automatiquement : l'utilisateur confirme
 * lui-même dans la page « Dépenses à confirmer ».
 */
export function RappelsDepensesPlanifiees() {
  const { budgets } = useSuperApp();

  const verifier = useCallback(() => {
    const maintenant = new Date();
    for (const due of echeancesDues(budgets, maintenant)) {
      if (momentRappel(due.budget).getTime() > maintenant.getTime()) continue;
      if (!rappelNonSonne(due.cle)) continue;
      marquerRappelSonne(due.cle);
      const titre = `Dépense à effectuer : ${due.budget.libelle}`;
      const texte = `${formatFCFA(due.budget.montant)} prévu${due.budget.heure ? ` à ${due.budget.heure}` : ""}. Confirmez si la dépense a bien été réalisée.`;
      void declencherAlarmeAppareil({
        volume: 70,
        urgent: true,
        son: true,
        vibration: true,
        notification: true,
        titre,
        texte,
      });
      void publierAlerteConseiller({ titre, texte, urgent: true });
    }
  }, [budgets]);

  useEffect(() => {
    verifier();
    const minuterie = window.setInterval(verifier, 60_000);
    const auRetour = () => {
      if (document.visibilityState === "visible") verifier();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [verifier]);

  return null;
}
