/**
 * Lien de changement de mot de passe — version HTTP publique.
 *
 * L'application Android installée appelle ce point d'entrée depuis la
 * WebView, sur une autre origine : une fonction serveur (RPC) ne serait pas
 * joignable. Le navigateur utilise la fonction serveur équivalente.
 *
 * Sécurité : l'e-mail part uniquement vers l'adresse demandée ; le jeton est
 * signé côté serveur et expire après 15 minutes ; aucune donnée budgétaire
 * ni aucun mot de passe ne transite ici. Limitation anti-abus par adresse IP.
 */

import { createFileRoute } from "@tanstack/react-router";

import {
  adresseValide,
  envoyerLienChangement,
  verifierCodeConfirmation,
  verifierJetonLien,
} from "@/lib/code-confirmation.server";

const FENETRE_MS = 60_000;
const REQUETES_PAR_FENETRE = 10;
const limites = new Map<string, { depuis: number; nombre: number }>();

function estLimitee(request: Request): boolean {
  const maintenant = Date.now();
  const adresse =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "inconnue";
  const courante = limites.get(adresse);
  if (!courante || maintenant - courante.depuis >= FENETRE_MS) {
    limites.set(adresse, { depuis: maintenant, nombre: 1 });
    return false;
  }
  courante.nombre += 1;
  return courante.nombre > REQUETES_PAR_FENETRE;
}

const ENTETES = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function reponse(corps: unknown, status = 200): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json", ...ENTETES },
  });
}

type Corps = {
  action?: "demander" | "verifier";
  email?: string;
  jeton?: string;
};

export const Route = createFileRoute("/api/public/compte/lien")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: ENTETES }),

      POST: async ({ request }) => {
        if (estLimitee(request)) {
          return reponse({ ok: false, message: "Trop de demandes : réessayez dans une minute." }, 429);
        }
        let corps: Corps;
        try {
          corps = (await request.json()) as Corps;
        } catch {
          return reponse({ ok: false, message: "Requête invalide." }, 400);
        }
        const email = (corps.email || "").trim();
        if (!adresseValide(email)) {
          return reponse({ ok: false, message: "Adresse e-mail invalide." }, 400);
        }

        if (corps.action === "verifier") {
          const resultat = await verifierJetonLien(email, corps.jeton || "");
          return reponse({ ok: resultat.valide, message: resultat.message }, resultat.valide ? 200 : 403);
        }

        const resultat = await envoyerLienChangement(email);
        return reponse({ ok: resultat.envoye, message: resultat.message }, resultat.envoye ? 200 : 502);
      },
    },
  },
});
