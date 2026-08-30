/**
 * Synchronisation automatique chiffrée de bout en bout.
 *
 * Chaque téléphone dépose ses données **déjà chiffrées** (AES-GCM, clé dérivée
 * de la phrase secrète commune) dans un coffre en ligne. Le serveur ne stocke
 * que du texte illisible : il n'a jamais la phrase secrète.
 *
 * Le salon (point de rendez-vous des deux téléphones) est une empreinte
 * SHA-256 de la phrase secrète : la phrase elle-même ne quitte jamais
 * l'appareil.
 *
 * La fusion se fait élément par élément (identifiant unique) : si les deux
 * partenaires saisissent en même temps, les deux saisies sont conservées.
 * Aucune donnée n'est écrasée.
 */

import { supabase } from "@/integrations/supabase/client";
import { chiffrer, dechiffrer, type EnveloppeChiffree } from "./sauvegarde";
import { journaliser } from "./journal";
import type { Etat } from "./store";
import {
  assainirBudget,
  assainirCategorie,
  assainirComptes,
  assainirDette,
  assainirEnveloppe,
  assainirTransaction,
  assainirTransfert,
} from "./validation";

/**
 * Longueur minimale de la phrase secrète. Le salon en ligne est une simple
 * empreinte de cette phrase : une phrase courte serait devinable, ce qui
 * permettrait à un tiers de déposer de fausses données dans le coffre.
 */
export const PHRASE_MIN = 12;

export const CLE_SYNC_AUTO = "superapp:sync-auto:v1";

export type ReglagesAuto = {
  /** Synchronisation automatique activée. */
  actif: boolean;
  /** Phrase secrète commune au couple (reste sur l'appareil). */
  phrase: string;
  /** Nom de cet appareil, pour ne pas relire ses propres dépôts. */
  appareil: string;
  /** Dernier dépôt déjà reçu (point de reprise). */
  curseur: number;
  dernierEnvoi?: string;
  dernierRecu?: string;
};

export const REGLAGES_AUTO_INITIAUX: ReglagesAuto = {
  actif: false,
  phrase: "",
  appareil: "",
  curseur: 0,
};

export function lireReglagesAuto(): ReglagesAuto {
  if (typeof window === "undefined") return REGLAGES_AUTO_INITIAUX;
  try {
    const brut = window.localStorage.getItem(CLE_SYNC_AUTO);
    if (!brut) return REGLAGES_AUTO_INITIAUX;
    return { ...REGLAGES_AUTO_INITIAUX, ...(JSON.parse(brut) as Partial<ReglagesAuto>) };
  } catch {
    return REGLAGES_AUTO_INITIAUX;
  }
}

export function ecrireReglagesAuto(r: ReglagesAuto) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_SYNC_AUTO, JSON.stringify(r));
  } catch {
    journaliser("avertissement", "stockage", "Réglages de synchronisation auto non enregistrés.");
  }
}

/** Empreinte publique du salon : dérivée de la phrase, jamais réversible. */
export async function calculerSalon(phrase: string): Promise<string> {
  const octets = new TextEncoder().encode(`superapp-salon-v1:${phrase.trim().toUpperCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", octets);
  return Array.from(new Uint8Array(digest))
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Envoi                                                               */
/* ------------------------------------------------------------------ */

/** Dépose l'état chiffré dans le coffre. Renvoie l'identifiant du dépôt. */
export async function deposer(etat: Etat, r: ReglagesAuto): Promise<number> {
  const salon = await calculerSalon(r.phrase);
  const enveloppe = await chiffrer(etat, r.phrase);
  const { data, error } = await supabase.rpc("sync_publier", {
    p_salon: salon,
    p_appareil: r.appareil,
    p_contenu: JSON.stringify(enveloppe),
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/* ------------------------------------------------------------------ */
/* Réception et fusion sans écrasement                                 */
/* ------------------------------------------------------------------ */

type AvecId = { id: string };

/**
 * Fusionne une liste distante dans la liste locale.
 *
 * Chaque élément entrant passe OBLIGATOIREMENT par son assainisseur : un dépôt
 * forgé ou corrompu ne peut donc pas injecter de montant négatif, de NaN ou de
 * date impossible dans les comptes du foyer. Les éléments refusés sont comptés
 * et signalés dans le journal.
 */
function fusionner<T extends AvecId>(
  actuel: T[],
  entrant: unknown,
  assainir: (x: unknown) => T | null,
): { liste: T[]; ajoutes: number; refuses: number } {
  const connus = new Set(actuel.map((x) => x?.id));
  const nouveaux: T[] = [];
  let refuses = 0;
  for (const brut of Array.isArray(entrant) ? entrant : []) {
    const propre = assainir(brut);
    if (!propre) {
      refuses += 1;
      continue;
    }
    if (connus.has(propre.id)) continue;
    connus.add(propre.id);
    nouveaux.push(propre);
  }
  return { liste: [...nouveaux, ...actuel], ajoutes: nouveaux.length, refuses };
}

function fusionnerNoms(actuel: string[], entrant: unknown): string[] {
  const propres = assainirComptes(entrant);
  const nouveaux = propres.filter((x) => !actuel.includes(x));
  return [...actuel, ...nouveaux];
}

export type ResultatFusion = { etat: Etat; ajoutes: number; curseur: number };

/** Fusionne un état distant dans l'état local sans jamais écraser l'existant. */
export function fusionnerEtat(
  local: Etat,
  distant: Partial<Etat>,
): { etat: Etat; ajoutes: number } {
  const transactions = fusionner(local.transactions, distant.transactions, assainirTransaction);
  const transferts = fusionner(local.transferts, distant.transferts, assainirTransfert);
  const enveloppes = fusionner(local.enveloppes, distant.enveloppes, assainirEnveloppe);
  const categories = fusionner(local.categories, distant.categories, assainirCategorie);
  const budgets = fusionner(local.budgets, distant.budgets, assainirBudget);
  const dettes = fusionner(local.dettes, distant.dettes, assainirDette);
  const comptes = fusionnerNoms(local.comptes, distant.comptes);
  const refuses =
    transactions.refuses +
    transferts.refuses +
    enveloppes.refuses +
    categories.refuses +
    budgets.refuses +
    dettes.refuses;
  if (refuses > 0) {
    journaliser(
      "avertissement",
      "application",
      `${refuses} élément(s) reçus ont été refusés : données invalides ou altérées.`,
    );
  }
  return {
    etat: {
      ...local,
      transactions: transactions.liste,
      transferts: transferts.liste,
      enveloppes: enveloppes.liste,
      categories: categories.liste,
      budgets: budgets.liste,
      dettes: dettes.liste,
      comptes,
    },
    ajoutes:
      transactions.ajoutes +
      transferts.ajoutes +
      enveloppes.ajoutes +
      categories.ajoutes +
      budgets.ajoutes +
      dettes.ajoutes,
  };
}

/** Récupère les dépôts de l'autre appareil et les fusionne dans l'état local. */
export async function recevoir(local: Etat, r: ReglagesAuto): Promise<ResultatFusion> {
  const salon = await calculerSalon(r.phrase);
  const { data, error } = await supabase.rpc("sync_lire", {
    p_salon: salon,
    p_appareil: r.appareil,
    p_depuis: r.curseur,
  });
  if (error) throw new Error(error.message);
  const lignes = (data ?? []) as { id: number; contenu: string }[];
  let etat = local;
  let ajoutes = 0;
  let curseur = r.curseur;
  for (const ligne of lignes) {
    curseur = Math.max(curseur, Number(ligne.id));
    try {
      const enveloppe = JSON.parse(ligne.contenu) as EnveloppeChiffree;
      const distant = await dechiffrer<Partial<Etat>>(enveloppe, r.phrase);
      const fusion = fusionnerEtat(etat, distant);
      etat = fusion.etat;
      ajoutes += fusion.ajoutes;
    } catch {
      journaliser(
        "avertissement",
        "application",
        "Un dépôt reçu n'a pas pu être déchiffré (phrase secrète différente ?).",
      );
    }
  }
  return { etat, ajoutes, curseur };
}
