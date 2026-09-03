/**
 * Accès serveur au coffre de synchronisation.
 *
 * Les fonctions de base de données `sync_publier` et `sync_lire` ne sont plus
 * appelables directement depuis le téléphone : elles sont réservées au serveur.
 * Le contenu déposé reste chiffré de bout en bout sur l'appareil, le serveur ne
 * voit qu'un texte illisible. Le salon est une empreinte SHA-256 (64 caractères
 * hexadécimaux) vérifiée ici avant tout accès à la base.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const salonSchema = z.string().regex(/^[0-9a-f]{64}$/, "salon invalide");
const appareilSchema = z.string().min(1).max(60);

const publierSchema = z.object({
  salon: salonSchema,
  appareil: appareilSchema,
  contenu: z.string().min(1).max(2_000_000),
});

const lireSchema = z.object({
  salon: salonSchema,
  appareil: appareilSchema,
  depuis: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

export const publierCoffre = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => publierSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("sync_publier", {
      p_salon: data.salon,
      p_appareil: data.appareil,
      p_contenu: data.contenu,
    });
    if (error) throw new Error("Dépôt impossible pour le moment.");
    return { id: Number(id ?? 0) };
  });

export const lireCoffre = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lireSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lignes, error } = await supabaseAdmin.rpc("sync_lire", {
      p_salon: data.salon,
      p_appareil: data.appareil,
      p_depuis: data.depuis,
    });
    if (error) throw new Error("Lecture impossible pour le moment.");
    return {
      lignes: (lignes ?? []).map((l) => ({ id: Number(l.id), contenu: l.contenu })),
    };
  });
