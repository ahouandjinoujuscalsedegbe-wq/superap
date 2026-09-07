import { createFileRoute } from "@tanstack/react-router";

/**
 * Point d'envoi utilisé par le service worker de sauvegarde : il fonctionne
 * même quand l'application est fermée. Le contenu reçu est déjà chiffré cinq
 * fois côté téléphone, le serveur ne peut donc rien lire.
 */
export const Route = createFileRoute("/api/public/sauvegarde/envoi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let corps: {
          email?: string;
          appareil?: string;
          colis?: string;
          creeLe?: string;
        };
        try {
          corps = (await request.json()) as typeof corps;
        } catch {
          return Response.json({ envoye: false, raison: "requete_invalide" }, { status: 400 });
        }

        const email = (corps.email || "").trim();
        const colis = corps.colis || "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return Response.json({ envoye: false, raison: "adresse_invalide" }, { status: 400 });
        }
        if (!colis.startsWith("SAM5:") || colis.length > 4_000_000) {
          return Response.json({ envoye: false, raison: "colis_invalide" }, { status: 400 });
        }

        const domaine = process.env["SENDER_DOMAIN"] || "notify.jsc.com";
        const cle = process.env["LOVABLE_API_KEY"];
        if (!cle) {
          return Response.json({ envoye: false, raison: "expediteur_absent" }, { status: 503 });
        }

        const appareil = (corps.appareil || "MON TÉLÉPHONE").slice(0, 60);
        try {
          const reponse = await fetch("https://api.lovable.dev/email/v1/send", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
            body: JSON.stringify({
              from: `SUPER APP <sauvegarde@${domaine}>`,
              to: email,
              subject: `SUPER APP — sauvegarde chiffrée (${appareil})`,
              text: `Sauvegarde chiffrée créée le ${corps.creeLe || new Date().toISOString()}.\nConservez ce message : il permet de récupérer vos données sur un autre téléphone avec votre phrase de récupération.\n\n${colis}\n`,
            }),
          });
          if (!reponse.ok) {
            return Response.json(
              { envoye: false, raison: "erreur_envoi" },
              { status: reponse.status >= 500 ? 502 : 400 },
            );
          }
          return Response.json({ envoye: true });
        } catch {
          return Response.json({ envoye: false, raison: "erreur_envoi" }, { status: 502 });
        }
      },
    },
  },
});
