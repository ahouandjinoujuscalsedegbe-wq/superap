import { createServerFn } from "@tanstack/react-start";

/**
 * Coffre en ligne « adresse e-mail ». Le serveur ne reçoit JAMAIS l'adresse
 * e-mail ni la phrase de récupération : uniquement une empreinte secrète
 * dérivée des deux (`cle`) et un colis déjà chiffré cinq fois. Sans la phrase,
 * rien n'est lisible, même pour nous.
 */

const VERSIONS_GARDEES = 10;

type Depot = {
  cle: string;
  empreinte: string;
  contenu: string;
  appareil: string;
  taille: number;
  classement?: string;
};

function cleValide(cle: string): boolean {
  return /^[0-9a-f]{64}$/.test(cle);
}

/** Dépose (ou remplace) une copie chiffrée dans le coffre du compte. */
export const deposerCoffreCloud = createServerFn({ method: "POST" })
  .inputValidator((data: Depot) => data)
  .handler(async ({ data }) => {
    if (!cleValide(data.cle)) return { ok: false, raison: "cle-invalide" as const };
    if (!data.contenu || data.contenu.length > 12_000_000) {
      return { ok: false, raison: "colis-invalide" as const };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("coffre_email").upsert(
      {
        cle: data.cle,
        empreinte: data.empreinte,
        contenu: data.contenu,
        appareil: data.appareil.slice(0, 80),
        taille: data.taille,
        classement: data.classement ?? null,
      },
      { onConflict: "cle,empreinte" },
    );
    if (error) return { ok: false, raison: "depot-refuse" as const };

    // On ne garde que les dernières copies du compte.
    const { data: anciennes } = await supabaseAdmin
      .from("coffre_email")
      .select("id")
      .eq("cle", data.cle)
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
    return { ok: true as const };
  });

/** Liste les copies chiffrées du compte, la plus récente d'abord. */
export const lireCoffreCloud = createServerFn({ method: "POST" })
  .inputValidator((data: { cle: string }) => data)
  .handler(async ({ data }) => {
    if (!cleValide(data.cle)) return { copies: [] as CopieCloud[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lignes, error } = await supabaseAdmin
      .from("coffre_email")
      .select("empreinte, contenu, appareil, taille, classement, cree_le")
      .eq("cle", data.cle)
      .order("cree_le", { ascending: false })
      .limit(VERSIONS_GARDEES);
    if (error || !lignes) return { copies: [] as CopieCloud[] };
    return {
      copies: lignes.map((l) => ({
        empreinte: l.empreinte,
        contenu: l.contenu,
        appareil: l.appareil ?? "",
        taille: l.taille ?? 0,
        classement: l.classement ?? "",
        creeLe: l.cree_le ?? "",
      })),
    };
  });

export type CopieCloud = {
  empreinte: string;
  contenu: string;
  appareil: string;
  taille: number;
  classement: string;
  creeLe: string;
};
