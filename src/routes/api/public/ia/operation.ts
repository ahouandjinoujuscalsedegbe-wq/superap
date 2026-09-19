import { createFileRoute } from "@tanstack/react-router";

/**
 * Analyse d'une opération décrite en texte libre.
 *
 * Le téléphone envoie uniquement la phrase écrite par l'utilisateur et la
 * liste des noms d'enveloppes / de comptes (aucun montant, aucun solde,
 * aucun historique). Le modèle répond par une suggestion : type de mouvement,
 * enveloppe, compte, montant et libellé. Rien n'est enregistré côté serveur.
 *
 * C'est une route HTTP publique (et non une fonction serveur) parce que l'APK
 * Android appelle ce point d'entrée depuis la WebView, sur une autre origine.
 */

const FENETRE_MS = 60_000;
const REQUETES_PAR_FENETRE = 20;
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
  texte?: string;
  enveloppes?: { id?: string; nom?: string; categorie?: string; sousCategorie?: string }[];
  comptes?: string[];
  sources?: string[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "montant", "libelle", "enveloppe", "compte", "source", "confiance", "raison"],
  properties: {
    type: { type: "string", enum: ["depense", "revenu", "transfert", "inconnu"] },
    montant: { type: ["number", "null"] },
    libelle: { type: "string" },
    enveloppe: { type: ["string", "null"] },
    compte: { type: ["string", "null"] },
    source: { type: ["string", "null"] },
    confiance: { type: "number" },
    raison: { type: "string" },
  },
} as const;

export const Route = createFileRoute("/api/public/ia/operation")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: ENTETES }),

      POST: async ({ request }) => {
        if (estLimitee(request)) {
          return reponse({ ok: false, raison: "trop_de_requetes" }, 429);
        }
        let corps: Corps;
        try {
          corps = (await request.json()) as Corps;
        } catch {
          return reponse({ ok: false, raison: "requete_invalide" }, 400);
        }
        const texte = (corps.texte || "").trim().slice(0, 600);
        if (texte.length < 3) {
          return reponse({ ok: false, raison: "texte_trop_court" }, 400);
        }
        const cle = process.env["LOVABLE_API_KEY"];
        if (!cle) {
          return reponse({ ok: false, raison: "ia_indisponible" }, 503);
        }

        const enveloppes = (corps.enveloppes ?? []).slice(0, 120).map((e) => ({
          id: String(e.id ?? "").slice(0, 60),
          nom: String(e.nom ?? "").slice(0, 60),
          categorie: String(e.categorie ?? "").slice(0, 60),
          sousCategorie: String(e.sousCategorie ?? "").slice(0, 60),
        }));
        const comptes = (corps.comptes ?? []).slice(0, 60).map((c) => String(c).slice(0, 60));
        const sources = (corps.sources ?? []).slice(0, 40).map((s) => String(s).slice(0, 60));

        const consigne = [
          "Tu aides une application de budget familial au Bénin, en francs CFA (FCFA).",
          "À partir d'une phrase écrite librement par l'utilisateur, déduis :",
          "- type : depense, revenu, transfert, ou inconnu si la phrase n'est pas une opération ;",
          "- montant : le nombre en FCFA, ou null s'il n'est pas écrit (ignore les mots comme « mille » seulement si tu n'es pas sûr) ;",
          "- libelle : un intitulé court (3 à 40 caractères) ;",
          "- enveloppe : l'identifiant EXACT d'une enveloppe de la liste, ou null ;",
          "- compte : le nom EXACT d'un compte de la liste, ou null ;",
          "- source : pour un revenu, le nom EXACT d'une source de la liste, ou null ;",
          "- confiance : 0 à 100 ;",
          "- raison : une phrase courte en français simple expliquant ton choix.",
          "N'invente jamais un identifiant ou un nom absent des listes.",
          "",
          `Enveloppes : ${JSON.stringify(enveloppes)}`,
          `Comptes : ${JSON.stringify(comptes)}`,
          `Sources de revenu : ${JSON.stringify(sources)}`,
        ].join("\n");

        let http: Response;
        try {
          http = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": cle,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              stream: true,
              instructions: consigne,
              input: texte,
              reasoning: { effort: "low", summary: "auto" },
              store: false,
              text: {
                format: {
                  type: "json_schema",
                  name: "suggestion_operation",
                  strict: true,
                  schema: SCHEMA,
                },
              },
            }),
          });
        } catch {
          return reponse({ ok: false, raison: "reseau_indisponible" }, 502);
        }

        if (!http.ok || !http.body) {
          const detail = await http.text().catch(() => "");
          const raison =
            http.status === 402
              ? "credits_epuises"
              : http.status === 429
                ? "trop_de_requetes"
                : "ia_en_erreur";
          return reponse({ ok: false, raison, detail: detail.slice(0, 300) }, http.status || 502);
        }

        // Lecture du flux SSE : on n'affiche rien en direct, on accumule le texte final.
        const lecteur = http.body.getReader();
        const decodeur = new TextDecoder();
        let tampon = "";
        let sortie = "";
        while (true) {
          const { done, value } = await lecteur.read();
          if (done) break;
          tampon += decodeur.decode(value, { stream: true });
          const lignes = tampon.split("\n");
          tampon = lignes.pop() ?? "";
          for (const ligne of lignes) {
            if (!ligne.startsWith("data:")) continue;
            const brut = ligne.slice(5).trim();
            if (!brut || brut === "[DONE]") continue;
            try {
              const evenement = JSON.parse(brut) as {
                type?: string;
                delta?: string;
                response?: { output_text?: string };
              };
              if (evenement.type === "response.output_text.delta" && evenement.delta) {
                sortie += evenement.delta;
              } else if (
                evenement.type === "response.completed" &&
                evenement.response?.output_text
              ) {
                sortie = evenement.response.output_text;
              }
            } catch {
              // Événement partiel ou non JSON : ignoré.
            }
          }
        }

        let suggestion: unknown;
        try {
          suggestion = JSON.parse(sortie.trim());
        } catch {
          return reponse({ ok: false, raison: "reponse_illisible" }, 502);
        }
        return reponse({ ok: true, suggestion });
      },
    },
  },
});
