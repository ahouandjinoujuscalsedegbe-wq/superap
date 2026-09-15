import { createFileRoute } from "@tanstack/react-router";

/**
 * Espace de stockage chiffré rattaché à l'adresse e-mail de l'utilisateur.
 *
 * Le serveur ne reçoit jamais l'adresse e-mail ni la phrase de récupération :
 * seulement une empreinte secrète dérivée des deux (`cle`) et un colis déjà
 * chiffré cinq fois sur le téléphone. Rien n'est lisible ici.
 *
 * C'est une route HTTP (et non une fonction serveur) parce que l'APK Android
 * appelle ce point d'entrée depuis la WebView, sur une autre origine.
 */

const VERSIONS_GARDEES = 10;
const CORPS_MAX = 12_500_000;
const FENETRE_MS = 60_000;
const REQUETES_PAR_FENETRE = 40;
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
  action?: "deposer" | "lire";
  cle?: string;
  empreinte?: string;
  contenu?: string;
  appareil?: string;
  taille?: number;
  classement?: string;
};

export const Route = createFileRoute("/api/public/coffre/")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: ENTETES }),

      POST: async ({ request }) => {
        if (estLimitee(request)) {
          return reponse({ ok: false, raison: "trop_de_requetes" }, 429);
        }
        const tailleAnnoncee = Number(request.headers.get("content-length") ?? 0);
        if (tailleAnnoncee > CORPS_MAX) {
          return reponse({ ok: false, raison: "requete_trop_grande" }, 413);
        }
        let corps: Corps;
        try {
          corps = (await request.json()) as Corps;
        } catch {
          return reponse({ ok: false, raison: "requete_invalide" }, 400);
        }

        const cle = (corps.cle || "").trim();
        if (!/^[0-9a-f]{64}$/.test(cle)) {
          return reponse({ ok: false, raison: "cle_invalide" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (corps.action === "lire") {
          const { data, error } = await supabaseAdmin
            .from("coffre_email")
            .select("empreinte, contenu, appareil, taille, classement, cree_le")
            .eq("cle", cle)
            .order("cree_le", { ascending: false })
            .limit(VERSIONS_GARDEES);
          if (error) return reponse({ ok: false, raison: "lecture_impossible" }, 502);
          return reponse({
            ok: true,
            copies: (data ?? []).map((l) => ({
              empreinte: l.empreinte,
              contenu: l.contenu,
              appareil: l.appareil ?? "",
              taille: l.taille ?? 0,
              classement: l.classement ?? "",
              creeLe: l.cree_le ?? "",
            })),
          });
        }

        const contenu = corps.contenu || "";
        if (!contenu.startsWith("SAM5:") || contenu.length > 12_000_000) {
          return reponse({ ok: false, raison: "colis_invalide" }, 400);
        }

        const { error } = await supabaseAdmin.from("coffre_email").upsert(
          {
            cle,
            empreinte: (corps.empreinte || "").slice(0, 128),
            contenu,
            appareil: (corps.appareil || "MON TÉLÉPHONE").slice(0, 60),
            taille: typeof corps.taille === "number" ? corps.taille : contenu.length,
            classement: corps.classement ?? null,
          },
          { onConflict: "cle,empreinte" },
        );
        if (error) return reponse({ ok: false, raison: "depot_refuse" }, 502);

        // On ne garde que les dernières copies du compte.
        const { data: anciennes } = await supabaseAdmin
          .from("coffre_email")
          .select("id")
          .eq("cle", cle)
          .order("cree_le", { ascending: false })
          .range(VERSIONS_GARDEES, VERSIONS_GARDEES + 50);
        if (anciennes && anciennes.length > 0) {
          await supabaseAdmin
            .from("coffre_email")
            .delete()
            .in(
              "id",
              anciennes.map((a) => a.id),
            );
        }
        return reponse({ ok: true });
      },
    },
  },
});
