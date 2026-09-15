import { createServerFn } from "@tanstack/react-start";

export type ResultatEnvoi = {
  envoye: boolean;
  raison?: "adresse_invalide" | "expediteur_absent" | "erreur_envoi" | "adresse_bloquee";
  message?: string;
};

type Entree = {
  email: string;
  appareil: string;
  colis: string;
  creeLe: string;
  /** Deuxième adresse facultative : la copie y part aussi. */
  emailSecours?: string;
  /** Mention ajoutée à l'objet (ex. TEST). */
  mention?: string;
  /** Rangement de la copie : « SUPER APP / 2026-09 / DÉPENSES / « Marché » ». */
  classement?: string;
  /** Rubrique technique, pour un filtre automatique dans la boîte. */
  rubrique?: string;
};

/** Marqueur présent dans chaque objet : sert à filtrer et archiver d'un coup. */
const MARQUEUR = "[SUPERAPP-COFFRE]";

/** Sous-domaine d'expédition vérifié pour ce projet. */
const SENDER_DOMAIN = "notify.superappbudget.com";
const FROM_DOMAIN = "superappbudget.com";

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

    const rangement = data.classement ?? "SUPER APP / GÉNÉRAL";
    const texte = `${rangement}\nSauvegarde chiffrée créée le ${data.creeLe} depuis ${data.appareil}.\nConservez ce message : il permet de récupérer vos données sur un autre téléphone avec votre phrase de récupération.\n\n${data.colis}\n`;
    const html = `<pre style="white-space:pre-wrap;font-family:monospace">${texte.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</pre>`;
    // Objet classé : marqueur de filtre, puis rangement (année-mois, rubrique,
    // nom saisi), puis date. La boîte e-mail devient un espace de stockage
    // rangé, filtrable et archivable automatiquement hors boîte de réception.
    const sujet = `${MARQUEUR} ${rangement} — ${data.creeLe}${data.mention ? ` (${data.mention})` : ""} — ${data.appareil}`;

    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const cle = process.env["LOVABLE_API_KEY"]!;

    const envoyerA = async (destinataire: string) =>
      sendLovableEmail(
        {
          to: destinataire,
          from: `SUPER APP <sauvegarde@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: sujet,
          text: texte,
          html,
          purpose: "transactional",
          label: data.rubrique ? `coffre-${data.rubrique}` : "sauvegarde-chiffree",
          idempotency_key: crypto.randomUUID(),
        },
        { apiKey: cle },
      );

    try {
      const resultat = await envoyerA(data.email);
      if (resultat && (resultat as { suppressed?: boolean }).suppressed) {
        return {
          envoye: false,
          raison: "adresse_bloquee",
          message: "Cette adresse a été bloquée pour les envois : utilisez une autre adresse.",
        };
      }
      // Adresse de secours : un échec ici ne remet pas en cause la sauvegarde.
      if (data.emailSecours && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.emailSecours)) {
        try {
          await envoyerA(data.emailSecours);
        } catch {
          /* la copie principale est déjà partie */
        }
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
