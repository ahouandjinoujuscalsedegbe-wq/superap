import { createServerFn } from "@tanstack/react-start";

export type ResultatEnvoi = {
  envoye: boolean;
  raison?: "adresse_invalide" | "expediteur_absent" | "erreur_envoi";
  message?: string;
};

type Entree = { email: string; appareil: string; colis: string; creeLe: string };

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

    const domaine = process.env["SENDER_DOMAIN"];
    const cle = process.env["LOVABLE_API_KEY"];
    if (!domaine || !cle) {
      return {
        envoye: false,
        raison: "expediteur_absent",
        message: "L'adresse d'expédition n'est pas encore configurée.",
      };
    }

    try {
      const reponse = await fetch("https://api.lovable.dev/email/v1/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
        body: JSON.stringify({
          from: `SUPER APP <sauvegarde@${domaine}>`,
          to: data.email,
          subject: `SUPER APP — sauvegarde chiffrée (${data.appareil})`,
          text: `Sauvegarde chiffrée créée le ${data.creeLe}.\nConservez ce message : il permet de récupérer vos données sur un autre téléphone avec votre phrase de récupération.\n\n${data.colis}\n`,
        }),
      });
      if (!reponse.ok) {
        return { envoye: false, raison: "erreur_envoi", message: `HTTP ${reponse.status}` };
      }
      return { envoye: true };
    } catch (e) {
      return { envoye: false, raison: "erreur_envoi", message: (e as Error).message };
    }
  });
