import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import { useSuperApp } from "@/lib/store";
import {
  analyserMessages,
  apprendre,
  estTraite,
  lireTraites,
  marquerTraite,
  suggestionApprise,
  SEUIL_CONFIANCE,
} from "@/lib/sms-transactions";
import { lectureAutoActive, lectureSmsDisponible, lireMessagesRecents } from "@/lib/sms-lecture";
import { journalInfo } from "@/lib/journal";

/**
 * Lecture automatique des messages de transaction à l'ouverture de
 * l'application. Les messages clairs sont enregistrés directement ; les cas
 * douteux attendent une confirmation dans la page « Messages de transaction ».
 */
export function SmsAuto() {
  const { comptes, ajouterTransaction } = useSuperApp();
  const navigate = useNavigate();
  const fait = useRef(false);

  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    if (!lectureSmsDisponible() || !lectureAutoActive()) return;

    let annule = false;
    const minuteur = window.setTimeout(async () => {
      const messages = await lireMessagesRecents(7, 100);
      if (annule || messages.length === 0) return;
      const traites = lireTraites();
      const nouvelles = analyserMessages(messages).filter((t) => !estTraite(t.cle, traites));
      if (nouvelles.length === 0) return;

      let enregistrees = 0;
      let aVerifier = 0;
      for (const t of nouvelles) {
        const appris = suggestionApprise(t.expediteur);
        const compte = appris.compte ?? comptes[0];
        if (t.confiance < SEUIL_CONFIANCE || !compte) {
          aVerifier += 1;
          continue;
        }
        ajouterTransaction({
          type: t.type,
          montant: t.montant,
          libelle: t.libelle,
          categorie: appris.enveloppe ?? "",
          compte,
          date: t.date,
        });
        apprendre(t, {
          type: t.type,
          ...(appris.enveloppe ? { enveloppe: appris.enveloppe } : {}),
          compte,
        });
        marquerTraite(t.cle);
        enregistrees += 1;
      }

      journalInfo("sms", "Lecture automatique des messages", {
        analyses: nouvelles.length,
        enregistrees,
        aVerifier,
      });

      if (enregistrees > 0) {
        toast.success(
          `${enregistrees} transaction${enregistrees > 1 ? "s" : ""} enregistrée${
            enregistrees > 1 ? "s" : ""
          } depuis vos messages.`,
        );
      }
      if (aVerifier > 0) {
        toast("Des messages demandent une vérification.", {
          action: {
            label: "Vérifier",
            onClick: () => void navigate({ to: "/messages" }),
          },
        });
      }
    }, 4000);

    return () => {
      annule = true;
      window.clearTimeout(minuteur);
    };
  }, [ajouterTransaction, comptes, navigate]);

  return null;
}
