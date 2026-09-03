import { useCallback, useEffect } from "react";
import { useSuperApp } from "@/lib/store";
import {
  declencherAlarmeAppareil,
  demanderPermissionNotification,
  idRappel,
  programmerNotificationsPlanifiees,
} from "@/lib/alarme-appareil";
import { publierAlerteConseiller } from "@/lib/alertes-conseiller";
import {
  echeancesDues,
  jourLocalISO,
  marquerRappelSonne,
  momentRappel,
  rappelNonSonne,
} from "@/lib/echeances-dues";
import { occurrencesEntre } from "@/lib/planning";
import { formatFCFA } from "@/lib/format";

/**
 * Surveille les dépenses planifiées :
 * - programme de vraies notifications système à l'heure de rappel choisie,
 *   pour que le téléphone prévienne même application fermée ;
 * - quand l'application est ouverte, déclenche l'alarme et prévient
 *   « Mon conseiller ».
 * Aucune dépense n'est enregistrée sans confirmation de l'utilisateur.
 * Toutes les heures sont calculées dans le fuseau horaire local du téléphone.
 */
export function RappelsDepensesPlanifiees() {
  const { budgets, enveloppes } = useSuperApp();

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

  // Notifications système programmées à l'avance : le téléphone sonne à
  // l'heure de rappel de chaque dépense, même application fermée.
  useEffect(() => {
    void demanderPermissionNotification();

    const debut = jourLocalISO();
    const fin = jourLocalISO(new Date(Date.now() + 120 * 86_400_000));

    const rappels: { id: number; titre: string; texte: string; quand: Date }[] = [];
    for (const b of budgets) {
      const env = enveloppes.find((e) => e.id === b.enveloppeId);
      for (const date of occurrencesEntre(b, debut, fin)) {
        // Heure locale : « YYYY-MM-DDTHH:MM:00 » est interprété dans le
        // fuseau du téléphone, comme l'heure saisie par l'utilisateur.
        const quand = new Date(`${date}T${b.heureRappel ?? "07:30"}:00`);
        if (Number.isNaN(quand.getTime())) continue;
        rappels.push({
          id: idRappel(`${b.id}-${date}`),
          titre: `${env ? `${env.emoji} ` : "📌 "}${b.libelle}`,
          texte: `${formatFCFA(b.montant)} prévu le ${date}${b.heure ? ` à ${b.heure}` : ""}. À confirmer dans l'application.`,
          quand,
        });
      }
    }
    void programmerNotificationsPlanifiees(rappels);
  }, [budgets, enveloppes]);

  return null;
}
