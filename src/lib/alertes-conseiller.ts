/**
 * Canal unique des alertes vers « Mon conseiller ».
 *
 * Toute notification ou alerte de l'application (alarme intelligente, rappel
 * du budget mensuel, rappels planifiés reçus en arrière-plan…) est aussi
 * déposée dans le fil de discussion du conseiller. L'utilisateur peut ainsi
 * la relire et poser ses questions. Tout reste sur l'appareil.
 */

import { ecrireMemoire, lireMemoire, type MessageCoach } from "@/lib/coach";

/** Événement émis quand une alerte vient d'être ajoutée à la discussion. */
export const EVENEMENT_ALERTE = "super-app:alerte-conseiller";

/** Empreintes déjà publiées dans la session, pour ne pas doubler un message. */
const dejaPubliees = new Set<string>();

function empreinte(titre: string, texte: string): string {
  // Une même alerte ne doit apparaître qu'une fois par heure.
  return `${titre}|${texte}|${new Date().toISOString().slice(0, 13)}`;
}

export type AlerteConseiller = {
  titre: string;
  texte: string;
  /** Précisions affichées sous le message. */
  details?: string[];
  /** Alerte grave (affichée avec une pastille rouge dans la discussion). */
  urgent?: boolean;
};

/**
 * Dépose une alerte dans la discussion du conseiller. Sans effet si la même
 * alerte vient déjà d'être publiée.
 */
export async function publierAlerteConseiller(alerte: AlerteConseiller): Promise<void> {
  if (typeof window === "undefined") return;
  const cle = empreinte(alerte.titre, alerte.texte);
  if (dejaPubliees.has(cle)) return;
  dejaPubliees.add(cle);
  if (dejaPubliees.size > 200) dejaPubliees.clear();

  try {
    const memoire = await lireMemoire();
    const dernier = memoire.messages[memoire.messages.length - 1];
    if (dernier && dernier.texte.includes(alerte.texte) && dernier.auteur === "coach") return;

    const message: MessageCoach = {
      id: `alerte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      auteur: "coach",
      texte: `${alerte.urgent ? "🚨" : "🔔"} ${alerte.titre}\n${alerte.texte}`,
      ...(alerte.details && alerte.details.length > 0 ? { details: alerte.details } : {}),
      categorie: "bilan",
      date: new Date().toISOString(),
      lu: false,
    };

    const suivante = { ...memoire, messages: [...memoire.messages, message].slice(-400) };
    await ecrireMemoire(suivante);
    window.dispatchEvent(new CustomEvent(EVENEMENT_ALERTE, { detail: message.id }));
  } catch {
    /* coffre indisponible : l'alerte reste visible à l'écran */
  }
}
