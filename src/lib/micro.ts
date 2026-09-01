/**
 * Autorisation du microphone.
 *
 * Sur Android (WebView Capacitor) comme sur navigateur, la permission micro
 * n'est demandée qu'au premier appel réel à getUserMedia. On déclenche donc
 * explicitement cette demande avant toute dictée ou discussion vocale.
 */

import { journalAvertissement, journalInfo } from "@/lib/journal";

let autorisationAccordee = false;
let demandeEnCours: Promise<boolean> | null = null;

export function microDisponible(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** Demande (une seule fois) l'accès au micro. Renvoie true si accordé. */
export function assurerMicro(): Promise<boolean> {
  if (autorisationAccordee) return Promise.resolve(true);
  if (demandeEnCours) return demandeEnCours;
  if (!microDisponible()) return Promise.resolve(false);

  demandeEnCours = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((flux) => {
      // On libère immédiatement le micro : seule l'autorisation nous intéresse.
      flux.getTracks().forEach((piste) => piste.stop());
      autorisationAccordee = true;
      journalInfo("micro", "Autorisation micro accordée");
      return true;
    })
    .catch((erreur) => {
      journalAvertissement("micro", "Autorisation micro refusée", {
        nom: String((erreur as Error)?.name ?? erreur),
      });
      return false;
    })
    .finally(() => {
      demandeEnCours = null;
    });

  return demandeEnCours;
}

export const MESSAGE_MICRO_REFUSE =
  "Micro refusé. Autorisez le microphone pour SUPER APP dans Paramètres › Applications › Autorisations.";
