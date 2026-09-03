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

import { lireCoffre, publierCoffre } from "@/lib/coffre-sync.functions";
import { chiffrer, dechiffrer, type EnveloppeChiffree } from "./sauvegarde";
import { journaliser } from "./journal";
import type { Etat } from "./store";
import {
  assainirBudget,
  assainirCategorie,
  assainirComptes,
  assainirDette,
  assainirElementCorbeille,
  assainirEnveloppe,
  assainirMembres,
  assainirObjectif,
  assainirRemplissage,
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
  const { id } = await publierCoffre({
    data: { salon, appareil: r.appareil, contenu: JSON.stringify(enveloppe) },
  });
  // Ce qui vient d'être envoyé devient la référence commune aux deux
  // téléphones : c'est elle qui permettra de reconnaître, au retour, une
  // modification faite par l'autre appareil.
  ecrireBase(etat);
  return id;
}

/* ------------------------------------------------------------------ */
/* Réception et fusion sans écrasement                                 */
/* ------------------------------------------------------------------ */

type AvecId = { id: string };

/* ------------------------------------------------------------------ */
/* Référence commune (fusion à trois côtés)                            */
/* ------------------------------------------------------------------ */

/**
 * Dernier état connu des DEUX téléphones (le dernier dépôt envoyé ou reçu).
 *
 * Sans cette référence, une modification faite sur un téléphone ne pouvait
 * jamais rejoindre l'autre : la fusion ignorait tout élément déjà connu.
 * Avec elle, on sait distinguer « l'autre a modifié » de « j'ai modifié »,
 * donc on peut propager les modifications sans jamais écraser une saisie
 * locale plus récente.
 */
export const CLE_SYNC_BASE = "superapp:sync-auto:base:v1";

export function lireBase(): Partial<Etat> | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_SYNC_BASE);
    return brut ? (JSON.parse(brut) as Partial<Etat>) : null;
  } catch {
    return null;
  }
}

export function ecrireBase(etat: Etat) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_SYNC_BASE, JSON.stringify(etat));
  } catch {
    /* espace saturé : la fusion restera simplement additive */
  }
}

/** Empreinte d'un élément, pour comparer deux versions sans ambiguïté. */
function empreinteElement(x: unknown): string {
  try {
    return JSON.stringify(x);
  } catch {
    return "";
  }
}

/**
 * Fusionne une liste distante dans la liste locale.
 *
 * Chaque élément entrant passe OBLIGATOIREMENT par son assainisseur : un dépôt
 * forgé ou corrompu ne peut donc pas injecter de montant négatif, de NaN ou de
 * date impossible dans les comptes du foyer. Les éléments refusés sont comptés
 * et signalés dans le journal.
 *
 * Éléments déjà connus : la version distante est adoptée UNIQUEMENT si notre
 * copie locale est restée identique à la référence commune. Si nous avons nous
 * aussi modifié l'élément depuis, notre saisie est conservée (aucune perte).
 */
function fusionner<T extends AvecId>(
  actuel: T[],
  entrant: unknown,
  assainir: (x: unknown) => T | null,
  base?: unknown,
): { liste: T[]; ajoutes: number; modifies: number; refuses: number } {
  const parId = new Map(actuel.filter(Boolean).map((x) => [x.id, x] as const));
  const empreintesBase = new Map<string, string>();
  for (const b of Array.isArray(base) ? base : []) {
    const id = (b as Partial<AvecId>)?.id;
    if (typeof id === "string") empreintesBase.set(id, empreinteElement(b));
  }

  const nouveaux: T[] = [];
  let refuses = 0;
  let modifies = 0;

  for (const brut of Array.isArray(entrant) ? entrant : []) {
    const propre = assainir(brut);
    if (!propre) {
      refuses += 1;
      continue;
    }
    const local = parId.get(propre.id);
    if (!local) {
      parId.set(propre.id, propre);
      nouveaux.push(propre);
      continue;
    }
    const empreinteLocale = empreinteElement(local);
    if (empreinteLocale === empreinteElement(propre)) continue;
    // Modification venue de l'autre téléphone : on l'adopte seulement si notre
    // copie n'a pas bougé depuis la dernière synchronisation.
    if (empreintesBase.get(propre.id) === empreinteLocale) {
      parId.set(propre.id, propre);
      modifies += 1;
    }
  }

  const liste = [...nouveaux, ...actuel.map((x) => (x ? (parId.get(x.id) ?? x) : x))];
  return { liste, ajoutes: nouveaux.length, modifies, refuses };
}

function fusionnerNoms(actuel: string[], entrant: unknown): string[] {
  const propres = assainirComptes(entrant);
  const nouveaux = propres.filter((x) => !actuel.includes(x));
  return [...actuel, ...nouveaux];
}

export type ResultatFusion = { etat: Etat; ajoutes: number; curseur: number };

/**
 * Fusionne un état distant dans l'état local.
 *
 * Toutes les collections du foyer sont couvertes : opérations, virements,
 * enveloppes, catégories, budgets, dettes, objectifs, remplissages, corbeille,
 * comptes et membres. Aucune saisie locale n'est perdue.
 */
export function fusionnerEtat(
  local: Etat,
  distant: Partial<Etat>,
  base?: Partial<Etat> | null,
): { etat: Etat; ajoutes: number } {
  const b = base ?? {};
  const transactions = fusionner(
    local.transactions,
    distant.transactions,
    assainirTransaction,
    b.transactions,
  );
  const transferts = fusionner(
    local.transferts,
    distant.transferts,
    assainirTransfert,
    b.transferts,
  );
  const enveloppes = fusionner(
    local.enveloppes,
    distant.enveloppes,
    assainirEnveloppe,
    b.enveloppes,
  );
  const categories = fusionner(
    local.categories,
    distant.categories,
    assainirCategorie,
    b.categories,
  );
  const budgets = fusionner(local.budgets, distant.budgets, assainirBudget, b.budgets);
  const dettes = fusionner(local.dettes, distant.dettes, assainirDette, b.dettes);
  const objectifs = fusionner(local.objectifs, distant.objectifs, assainirObjectif, b.objectifs);
  const remplissages = fusionner(
    local.remplissages,
    distant.remplissages,
    assainirRemplissage,
    b.remplissages,
  );
  const corbeille = fusionner(
    local.corbeille,
    distant.corbeille,
    assainirElementCorbeille,
    b.corbeille,
  );
  const comptes = fusionnerNoms(local.comptes, distant.comptes);
  const comptesExclus = fusionnerNoms(local.comptesExclus, distant.comptesExclus).filter((c) =>
    comptes.includes(c),
  );
  const membresDistants = assainirMembres(distant.membres);
  const membres = [...local.membres, ...membresDistants.filter((m) => !local.membres.includes(m))];

  const parts = [
    transactions,
    transferts,
    enveloppes,
    categories,
    budgets,
    dettes,
    objectifs,
    remplissages,
    corbeille,
  ];
  const refuses = parts.reduce((s, p) => s + p.refuses, 0);
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
      objectifs: objectifs.liste,
      remplissages: remplissages.liste,
      corbeille: corbeille.liste,
      comptes,
      comptesExclus,
      membres,
    },
    ajoutes: parts.reduce((s, p) => s + p.ajoutes + p.modifies, 0),
  };
}

/** Récupère les dépôts de l'autre appareil et les fusionne dans l'état local. */
export async function recevoir(local: Etat, r: ReglagesAuto): Promise<ResultatFusion> {
  const salon = await calculerSalon(r.phrase);
  const { lignes } = await lireCoffre({
    data: { salon, appareil: r.appareil, depuis: r.curseur },
  });
  let etat = local;
  let ajoutes = 0;
  let curseur = r.curseur;
  let base = lireBase();
  for (const ligne of lignes) {
    curseur = Math.max(curseur, Number(ligne.id));
    try {
      const enveloppe = JSON.parse(ligne.contenu) as EnveloppeChiffree;
      const distant = await dechiffrer<Partial<Etat>>(enveloppe, r.phrase);
      const fusion = fusionnerEtat(etat, distant, base);
      etat = fusion.etat;
      // Le dépôt qui vient d'être intégré devient la nouvelle référence
      // commune : la prochaine modification distante sera donc reconnue.
      base = { ...base, ...distant };
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
