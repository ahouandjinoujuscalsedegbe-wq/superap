/**
 * Relais de mise à jour — manifeste (version.json).
 *
 * Le jeton GitHub reste ICI, côté serveur. L'application installée ne le voit
 * jamais : elle interroge simplement cette adresse publique et reçoit le
 * manifeste (version, url, empreinte SHA-256, taille).
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

/** Cherche la Release la plus récente contenant version.json. */
export async function trouverAssets(jeton: string): Promise<Asset[] | null> {
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
  const trouvee = releases.find(
    (r) => !r.draft && r.assets?.some((a) => a.name === "version.json"),
  );
  return trouvee?.assets ?? null;
}

export const Route = createFileRoute("/api/public/maj/version")({
  server: {
    handlers: {
      GET: async () => {
        const jeton = process.env["SUPERAPP_UPDATE_TOKEN"];
        if (!jeton) {
          return Response.json({ erreur: "Relais de mise à jour non configuré." }, { status: 503 });
        }
        const assets = await trouverAssets(jeton);
        const manifeste = assets?.find((a) => a.name === "version.json");
        if (!manifeste) {
          return Response.json({ erreur: "Aucune version publiée." }, { status: 404 });
        }
        const contenu = await fetch(manifeste.url, {
          headers: entetes(jeton, "application/octet-stream"),
        });
        if (!contenu.ok) {
          return Response.json({ erreur: "Manifeste illisible." }, { status: 502 });
        }
        const donnees = (await contenu.json()) as Record<string, unknown>;
        // Seules les informations publiques du manifeste sont renvoyées.
        return Response.json(
          {
            version: donnees["version"],
            url: donnees["url"],
            changelog: donnees["changelog"],
            sha256: donnees["sha256"],
            taille: donnees["taille"],
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
