/**
 * Extensions de la synchronisation chiffrée par e-mail :
 * appareils partenaires, colis différentiel, compression, empreinte
 * d'intégrité, fusion sélective, détection de conflits, rappels et
 * rotation de phrase secrète.
 */

import { chiffrer, dechiffrer, type EnveloppeChiffree } from "./sauvegarde";
import { journaliser } from "./journal";
import type { ColisSync } from "./sync-email";

export const CLE_SYNC_PLUS = "superapp:sync-plus:v1";

const MARQUE_DEBUT = "-----DEBUT COLIS SUPER APP-----";
const MARQUE_FIN = "-----FIN COLIS SUPER APP-----";

/* ------------------------------------------------------------------ */
/* Appareils partenaires et réglages avancés                           */
/* ------------------------------------------------------------------ */

export type Appareil = {
  id: string;
  nom: string;
  email: string;
  /** Indice de phrase secrète propre à cet appareil (jamais la phrase elle-même). */
  indicePhrase?: string;
  dernierEnvoi?: string;
  dernierImport?: string;
  creeLe: string;
};

export type FrequenceSync = "jamais" | "quotidienne" | "hebdomadaire" | "mensuelle";

export type ReglagesSyncPlus = {
  appareils: Appareil[];
  appareilActifId?: string;
  frequence: FrequenceSync;
  /** Nombre de jours sans échange avant alerte. */
  seuilRappelJours: number;
  compresser: boolean;
  differentiel: boolean;
  /** Date ISO du dernier envoi, sert de point de départ au colis différentiel. */
  dernierEnvoiGlobal?: string;
  /** Date ISO du dernier rappel affiché (évite les répétitions). */
  dernierRappel?: string;
};

export const REGLAGES_PLUS_INITIAUX: ReglagesSyncPlus = {
  appareils: [],
  frequence: "hebdomadaire",
  seuilRappelJours: 7,
  compresser: true,
  differentiel: false,
};

export function lireReglagesPlus(): ReglagesSyncPlus {
  if (typeof window === "undefined") return REGLAGES_PLUS_INITIAUX;
  try {
    const brut = window.localStorage.getItem(CLE_SYNC_PLUS);
    if (!brut) return REGLAGES_PLUS_INITIAUX;
    const lu = JSON.parse(brut) as Partial<ReglagesSyncPlus>;
    return {
      ...REGLAGES_PLUS_INITIAUX,
      ...lu,
      appareils: Array.isArray(lu.appareils) ? lu.appareils : [],
    };
  } catch {
    return REGLAGES_PLUS_INITIAUX;
  }
}

export function ecrireReglagesPlus(r: ReglagesSyncPlus) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_SYNC_PLUS, JSON.stringify(r));
  } catch {
    journaliser("avertissement", "stockage", "Réglages de synchronisation non enregistrés.");
  }
}

export function nouvelIdentifiant(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

/* ------------------------------------------------------------------ */
/* Rappels de synchronisation                                          */
/* ------------------------------------------------------------------ */

const JOUR_MS = 86_400_000;

export function joursDepuis(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / JOUR_MS);
}

export function intervalleFrequence(f: FrequenceSync): number | null {
  if (f === "quotidienne") return 1;
  if (f === "hebdomadaire") return 7;
  if (f === "mensuelle") return 30;
  return null;
}

export type EtatRappel = {
  /** Une préparation de colis est attendue selon la fréquence choisie. */
  enAttente: boolean;
  /** Aucun échange depuis trop longtemps alors qu'un partenaire existe. */
  alerteSilence: boolean;
  jours: number | null;
  message: string;
};

export function evaluerRappel(r: ReglagesSyncPlus): EtatRappel {
  const jours = joursDepuis(r.dernierEnvoiGlobal);
  const cycle = intervalleFrequence(r.frequence);
  const jamais = jours === null;
  const enAttente =
    cycle !== null && r.appareils.length > 0 && (jamais || (jours as number) >= cycle);
  const alerteSilence =
    r.appareils.length > 0 && !jamais && (jours as number) >= r.seuilRappelJours;
  let message = "Synchronisation à jour.";
  if (r.appareils.length === 0) message = "Aucun appareil partenaire enregistré.";
  else if (jamais) message = "Aucun colis envoyé pour l'instant.";
  else if (alerteSilence) message = `Aucun échange depuis ${jours} jour(s).`;
  else if (enAttente) message = `Préparation ${r.frequence} attendue (${jours} jour(s)).`;
  return { enAttente, alerteSilence, jours, message };
}

/* ------------------------------------------------------------------ */
/* Empreinte d'intégrité et compression                                */
/* ------------------------------------------------------------------ */

export async function empreinte(texte: string): Promise<string> {
  const octets = new TextEncoder().encode(texte);
  const digest = await crypto.subtle.digest("SHA-256", octets);
  return Array.from(new Uint8Array(digest))
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function versBase64(octets: Uint8Array): string {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s);
}

function depuisBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function compresser(texte: string): Promise<string | null> {
  const G = (globalThis as { CompressionStream?: unknown }).CompressionStream;
  if (typeof G !== "function") return null;
  try {
    const flux = new (G as new (f: string) => TransformStream)("gzip");
    const ecrivain = flux.writable.getWriter();
    void ecrivain.write(new TextEncoder().encode(texte));
    void ecrivain.close();
    const buffer = await new Response(flux.readable).arrayBuffer();
    return versBase64(new Uint8Array(buffer));
  } catch {
    return null;
  }
}

async function decompresser(b64: string): Promise<string> {
  const G = (globalThis as { DecompressionStream?: unknown }).DecompressionStream;
  if (typeof G !== "function") {
    throw new Error("Ce colis est compressé et cet appareil ne sait pas le décompresser.");
  }
  const flux = new (G as new (f: string) => TransformStream)("gzip");
  const ecrivain = flux.writable.getWriter();
  void ecrivain.write(depuisBase64(b64));
  void ecrivain.close();
  return new Response(flux.readable).text();
}

/* ------------------------------------------------------------------ */
/* Colis version 2 : compression + empreinte                           */
/* ------------------------------------------------------------------ */

type ColisV2 = {
  v: 2;
  comp: boolean;
  emp: string;
  data: string;
};

export type InfosColis = {
  texte: string;
  empreinte: string;
  compresse: boolean;
  /** Taille du bloc final en caractères. */
  taille: number;
  /** Taille avant compression, pour afficher le gain. */
  tailleBrute: number;
};

export async function fabriquerColisPlus(
  colis: ColisSync,
  phrase: string,
  options: { compresser: boolean },
): Promise<InfosColis> {
  const enveloppe = await chiffrer(colis, phrase);
  const brut = JSON.stringify(enveloppe);
  const emp = await empreinte(brut);
  const comprime = options.compresser ? await compresser(brut) : null;
  const utilise = comprime ?? btoa(unescape(encodeURIComponent(brut)));
  const paquet: ColisV2 = { v: 2, comp: comprime !== null, emp, data: utilise };
  const corps = btoa(JSON.stringify(paquet)).replace(/(.{76})/g, "$1\n");
  const texte = `${MARQUE_DEBUT}\n${corps}\n${MARQUE_FIN}`;
  journaliser("info", "application", "Colis de synchronisation généré.", {
    compresse: comprime !== null,
    taille: texte.length,
    empreinte: emp,
  });
  return {
    texte,
    empreinte: emp,
    compresse: comprime !== null,
    taille: texte.length,
    tailleBrute: brut.length,
  };
}

export async function ouvrirColisPlus(
  texte: string,
  phrase: string,
): Promise<{ colis: ColisSync; empreinte: string; integre: boolean }> {
  const nettoye = texte
    .replace(MARQUE_DEBUT, "")
    .replace(MARQUE_FIN, "")
    .replace(/\s+/g, "")
    .trim();
  if (!nettoye) throw new Error("Le colis de synchronisation est vide.");
  let decode: string;
  try {
    decode = atob(nettoye);
  } catch {
    throw new Error("Ce texte n'est pas un colis de synchronisation SUPER APP.");
  }
  let objet: unknown;
  try {
    objet = JSON.parse(decode);
  } catch {
    throw new Error("Ce texte n'est pas un colis de synchronisation SUPER APP.");
  }
  let brut: string;
  let empAttendue = "";
  if (objet && typeof objet === "object" && (objet as ColisV2).v === 2) {
    const p = objet as ColisV2;
    brut = p.comp ? await decompresser(p.data) : decodeURIComponent(escape(atob(p.data)));
    empAttendue = p.emp;
  } else {
    // Ancien format (v1) : l'objet décodé est directement l'enveloppe chiffrée.
    brut = decode;
  }
  const empReelle = await empreinte(brut);
  const integre = empAttendue === "" || empAttendue === empReelle;
  if (!integre) {
    journaliser("erreur", "application", "Empreinte du colis invalide.", {
      attendue: empAttendue,
      obtenue: empReelle,
    });
    throw new Error(
      "L'empreinte d'intégrité ne correspond pas : le colis a été tronqué ou modifié pendant l'envoi.",
    );
  }
  let enveloppe: EnveloppeChiffree;
  try {
    enveloppe = JSON.parse(brut) as EnveloppeChiffree;
  } catch {
    throw new Error("Le contenu du colis est illisible.");
  }
  const colis = await dechiffrer<ColisSync>(enveloppe, phrase);
  journaliser("info", "application", "Colis de synchronisation ouvert.", {
    appareil: colis.appareil ?? "inconnu",
    empreinte: empReelle,
  });
  return { colis, empreinte: empReelle, integre: true };
}

/* ------------------------------------------------------------------ */
/* Colis différentiel                                                  */
/* ------------------------------------------------------------------ */

function dateElement(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  for (const cle of ["date", "creeLe", "prochaine", "debut"]) {
    const v = o[cle];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

/** Ne conserve que les éléments datés après la borne (les autres types restent complets). */
export function filtrerDepuis<T>(liste: T[], depuis?: string): T[] {
  if (!depuis) return liste;
  const borne = new Date(depuis).getTime();
  if (Number.isNaN(borne)) return liste;
  return liste.filter((x) => {
    const d = dateElement(x);
    if (!d) return true;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? true : t >= borne;
  });
}

/* ------------------------------------------------------------------ */
/* Fusion sélective et conflits                                        */
/* ------------------------------------------------------------------ */

export type TypeDonnees =
  | "transactions"
  | "transferts"
  | "enveloppes"
  | "categories"
  | "budgets"
  | "dettes"
  | "comptes";

export const TYPES_DONNEES: { id: TypeDonnees; label: string }[] = [
  { id: "transactions", label: "Opérations" },
  { id: "transferts", label: "Transferts" },
  { id: "enveloppes", label: "Enveloppes" },
  { id: "categories", label: "Catégories" },
  { id: "budgets", label: "Planifications" },
  { id: "dettes", label: "Dettes et créances" },
  { id: "comptes", label: "Comptes" },
];

export type Selection = Record<TypeDonnees, boolean>;

export const SELECTION_COMPLETE: Selection = {
  transactions: true,
  transferts: true,
  enveloppes: true,
  categories: true,
  budgets: true,
  dettes: true,
  comptes: true,
};

export type Conflit = {
  cle: string;
  type: TypeDonnees;
  id: string;
  titre: string;
  local: string;
  entrant: string;
};

type AvecId = { id: string };

function resume(x: unknown): string {
  if (!x || typeof x !== "object") return String(x);
  const o = x as Record<string, unknown>;
  const parts: string[] = [];
  for (const cle of ["nom", "libelle", "personne", "montant", "montantInitial", "plafond", "dotation", "date", "compte"]) {
    if (o[cle] !== undefined && o[cle] !== null && o[cle] !== "") {
      parts.push(`${cle} : ${String(o[cle])}`);
    }
  }
  return parts.join(" · ") || JSON.stringify(o).slice(0, 120);
}

function titre(x: unknown, id: string): string {
  if (!x || typeof x !== "object") return id;
  const o = x as Record<string, unknown>;
  return String(o["nom"] ?? o["libelle"] ?? o["personne"] ?? id);
}

/** Détecte les éléments présents des deux côtés avec un contenu différent. */
export function detecterConflits<T extends AvecId>(
  type: TypeDonnees,
  actuel: T[],
  entrant: T[],
): Conflit[] {
  const parId = new Map(actuel.map((x) => [x.id, x]));
  const conflits: Conflit[] = [];
  for (const e of entrant) {
    if (!e || !e.id) continue;
    const local = parId.get(e.id);
    if (!local) continue;
    if (JSON.stringify(local) === JSON.stringify(e)) continue;
    conflits.push({
      cle: `${type}:${e.id}`,
      type,
      id: e.id,
      titre: titre(e, e.id),
      local: resume(local),
      entrant: resume(e),
    });
  }
  return conflits;
}

export type ChoixConflit = "local" | "entrant";

/**
 * Fusion sans doublon avec résolution de conflits :
 * - les identifiants inconnus sont ajoutés ;
 * - les identifiants connus restent locaux sauf si l'utilisateur a choisi
 *   « entrant » pour ce conflit précis.
 */
export function fusionnerAvecChoix<T extends AvecId>(
  type: TypeDonnees,
  actuel: T[],
  entrant: T[],
  choix: Record<string, ChoixConflit>,
): { liste: T[]; ajoutes: number; remplaces: number } {
  const connus = new Map(actuel.map((x) => [x.id, x]));
  let remplaces = 0;
  const nouveaux: T[] = [];
  for (const e of entrant) {
    if (!e || !e.id) continue;
    if (!connus.has(e.id)) {
      nouveaux.push(e);
      connus.set(e.id, e);
      continue;
    }
    if (choix[`${type}:${e.id}`] === "entrant") {
      connus.set(e.id, e);
      remplaces += 1;
    }
  }
  const liste = [
    ...nouveaux,
    ...actuel.map((x) => connus.get(x.id) ?? x),
  ];
  return { liste, ajoutes: nouveaux.length, remplaces };
}
