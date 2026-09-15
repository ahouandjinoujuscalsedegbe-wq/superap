import { createServerFn } from "@tanstack/react-start";

export type ResultatEnvoi = {
  envoye: boolean;
  raison?: "adresse_invalide" | "expediteur_absent" | "erreur_envoi" | "adresse_bloquee";
  message?: string;
};

type Entree = { email: string; appareil: string; colis: string; creeLe: string };

/** Sous-domaine d'expédition vérifié pour ce projet. */
const SENDER_DOMAIN = "notify.jsc.com";
const FROM_DOMAIN = "jsc.com";

/**
 * Envoie le colis chiffré vers l'adresse de sauvegarde de l'utilisateur.
 * Le contenu arrive déjà chiffré cinq fois : le serveur ne peut rien lire.
 */
export const envoyerColisSauvegarde = createServerFn({ method: "POST" })
  .inputValidator((d: Entree) => d)
  .handler(async ({ data }): Promise<ResultatEnvoi> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      return { envoye: false, raison: "adresse_invalide" };
    }
    if (!process.env["LOVABLE_API_KEY"]) {
      return {
        envoye: false,
        raison: "expediteur_absent",
        message: "L'adresse d'expédition n'est pas encore configurée.",
      };
    }

    const texte = `Sauvegarde chiffrée créée le ${data.creeLe} depuis ${data.appareil}.\nConservez ce message : il permet de récupérer vos données sur un autre téléphone avec votre phrase de récupération.\n\n${data.colis}\n`;

    try {
      const { sendLovableEmail, EmailAPIError } = await import("@lovable.dev/email-js");
      const resultat = await sendLovableEmail(
        {
          to: data.email,
          from: `SUPER APP <sauvegarde@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `SUPER APP — sauvegarde chiffrée (${data.appareil})`,
          text: texte,
          html: `<pre style="white-space:pre-wrap;font-family:monospace">${texte.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre>`,
          purpose: "transactional",
          label: "sauvegarde-chiffree",
          idempotency_key: crypto.randomUUID(),
        },
        { apiKey: process.env["LOVABLE_API_KEY"]! },
      );
      if (resultat && (resultat as { suppressed?: boolean }).suppressed) {
        return {
          envoye: false,
          raison: "adresse_bloquee",
          message: "Cette adresse a été bloquée pour les envois : utilisez une autre adresse.",
        };
      }
      return { envoye: true };
    } catch (e) {
      const erreur = e as { code?: string; status?: number; message?: string };
      return {
        envoye: false,
        raison: "erreur_envoi",
        message: erreur.code ? `${erreur.code}` : (erreur.message ?? "envoi impossible"),
      };
    }
  });
