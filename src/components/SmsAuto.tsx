import { useCallback, useEffect, useRef } from "react";
import { useSuperApp } from "@/lib/store";
import { autoriserSms, lireSmsRecents, smsDisponible, surNouveauSms } from "@/lib/sms-lecture";
import {
  analyserMessages,
  apprendreSms,
  lectureAutoActive,
  marquerTraite,
} from "@/lib/sms-transactions";

/** Seuil au-delà duquel une opération est enregistrée sans confirmation. */
const SEUIL_CERTITUDE = 0.88;

/**
 * Lit en silence les nouveaux SMS de transaction et enregistre les opérations
 * reconnues avec certitude. Les messages douteux restent en attente dans la
 * page « Messages » pour être confirmés par l'utilisateur.
 */
export function SmsAuto() {
  const { comptes, enveloppes, ajouterTransaction, chargement } = useSuperApp();
  const enCours = useRef(false);

  const analyser = useCallback(async () => {
    if (chargement || enCours.current) return;
    if (!lectureAutoActive() || !smsDisponible()) return;
    enCours.current = true;
    try {
      if (!(await autoriserSms())) return;
      const messages = await lireSmsRecents(Date.now() - 7 * 86400000);
      const contexte = {
        comptes,
        enveloppes: enveloppes.map((e) => ({ id: e.id, nom: e.nom, categorie: e.categorie })),
      };
      for (const op of analyserMessages(messages, contexte)) {
        if (op.confiance < SEUIL_CERTITUDE) continue;
        ajouterTransaction({
          type: op.type,
          montant: op.montant,
          libelle: op.libelle,
          categorie: op.enveloppeId ?? "",
          compte: op.compte,
          date: op.date,
        });
        if (op.frais > 0) {
          ajouterTransaction({
            type: "depense",
            montant: op.frais,
            libelle: `Frais — ${op.libelle}`,
            categorie: op.enveloppeId ?? "",
            compte: op.compte,
            date: op.date,
          });
        }
        apprendreSms(op, { type: op.type, enveloppeId: op.enveloppeId, compte: op.compte });
        marquerTraite(op.id);
      }
    } finally {
      enCours.current = false;
    }
  }, [chargement, comptes, enveloppes, ajouterTransaction]);

  useEffect(() => {
    void analyser();
    const minuterie = window.setInterval(() => void analyser(), 15 * 60 * 1000);
    const auRetour = () => {
      if (document.visibilityState === "visible") void analyser();
    };
    document.addEventListener("visibilitychange", auRetour);
    // Réception d'un nouveau SMS : analyse immédiate, sans attendre le cycle.
    const desabonner = surNouveauSms(() => void analyser());
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
      desabonner();
    };
  }, [analyser]);

  return null;
}
