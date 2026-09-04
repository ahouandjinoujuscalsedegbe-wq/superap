/**
 * Relais de mise à jour — fichier APK.
 *
 * L'application demande un nom de fichier ; le serveur (qui détient seul le
 * jeton GitHub) résout l'adresse de téléchargement temporaire et y redirige.
 * Aucun jeton n'est jamais transmis au téléphone.
 */
import { createFileRoute } from "@tanstack/react-router";

const DEPOT = "ahouandjinoujuscalsedegbe-wq/superap";

type Asset = { name: string; url: string };

function entetes(jeton: string, accept: string): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${jeton}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "super-app-updater",
  };
}

async function assetsRelease(jeton: string): Promise<Asset[] | null> {
  const base = `https://api.github.com/repos/${DEPOT}/releases`;
  const h = entetes(jeton, "application/vnd.github+json");
  const latest = await fetch(`${base}/latest`, { headers: h });
  if (latest.ok) {
    const donnees = (await latest.json()) as { assets?: Asset[] };
    if (donnees.assets?.some((a) => a.name === "version.json")) return donnees.assets;
  }
  const liste = await fetch(`${base}?per_page=15`, { headers: h });
  if (!liste.ok) return null;
  const releases = (await liste.json()) as Array<{ draft?: boolean; assets?: Asset[] }>;
  return (
    releases.find((r) => !r.draft && r.assets?.some((a) => a.name === "version.json"))?.assets ??
    null
  );
}

export const Route = createFileRoute("/api/public/maj/apk")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const jeton = process.env["SUPERAPP_UPDATE_TOKEN"];
        if (!jeton) return new Response("Relais non configuré.", { status: 503 });

        const nom = new URL(request.url).searchParams.get("nom") ?? "";
        // Seuls les noms d'APK publiés par le workflow sont acceptés.
        if (!/^super-app-[0-9A-Za-z.\-_]{1,40}\.apk$/.test(nom)) {
          return new Response("Nom de fichier invalide.", { status: 400 });
        }

        const assets = await assetsRelease(jeton);
        const asset = assets?.find((a) => a.name === nom);
        if (!asset) return new Response("Fichier introuvable.", { status: 404 });

        // GitHub renvoie une redirection vers une adresse signée temporaire,
        // téléchargeable sans jeton : on la transmet telle quelle.
        const reponse = await fetch(asset.url, {
          headers: entetes(jeton, "application/octet-stream"),
          redirect: "manual",
        });
        const cible = reponse.headers.get("location");
        if (cible) {
          return new Response(null, {
            status: 302,
            headers: { Location: cible, "Cache-Control": "no-store" },
          });
        }
        if (!reponse.ok || !reponse.body) {
          return new Response("Téléchargement impossible.", { status: 502 });
        }
        return new Response(reponse.body, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.android.package-archive",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
