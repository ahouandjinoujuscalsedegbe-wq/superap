/**
 * Sauvegarde automatique chiffrée vers l'adresse e-mail de l'utilisateur.
 *
 * Chaîne de protection (5 couches indépendantes) :
 *   1. AES-GCM   (clé 1)
 *   2. AES-CBC   (clé 2)
 *   3. AES-GCM   (clé 3)
 *   4. AES-CBC   (clé 4)
 *   5. AES-GCM   (clé 5)
 * Les cinq clés sont dérivées séparément de la phrase secrète de récupération
 * (PBKDF2-SHA256, 300 000 itérations, sels distincts). Sans cette phrase, le
 * colis reçu par e-mail est illisible, y compris pour le fournisseur de mail.
 */

import { lireSecurise, ecrireSecurise } from "./coffre-local";

export const CLE_REGLAGES_MAIL = "superapp:sauvegarde-mail:v1";
export const CLE_PHRASE_MAIL = "superapp:sauvegarde-mail:phrase:v1";
export const CLE_FILE_MAIL = "superapp:sauvegarde-mail:file:v1";

const PREFIXE = "SAM5:";
const ITERATIONS = 300_000;
const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

export type ReglagesMail = {
  /** Adresse de destination des colis chiffrés. */
  email: string;
  /** Nom de l'appareil, pour reconnaître l'origine du colis. */
  appareil: string;
  /** Configuration terminée au premier lancement. */
  configure: boolean;
  /** Sauvegarde automatique active. */
  actif: boolean;
  dernierEnvoi?: string;
  derniereEmpreinte?: string;
  dernierEchec?: string;
};

export const REGLAGES_MAIL_INITIAUX: ReglagesMail = {
  email: "",
  appareil: "MON TÉLÉPHONE",
  configure: false,
  actif: true,
};

export type ColisEnAttente = {
  id: string;
  creeLe: string;
  empreinte: string;
  contenu: string;
  taille: number;
};

/* ------------------------------- Réglages -------------------------------- */

export function lireReglagesMail(): ReglagesMail {
  try {
    const brut = window.localStorage.getItem(CLE_REGLAGES_MAIL);
    return brut
      ? { ...REGLAGES_MAIL_INITIAUX, ...(JSON.parse(brut) as Partial<ReglagesMail>) }
      : REGLAGES_MAIL_INITIAUX;
  } catch {
    return REGLAGES_MAIL_INITIAUX;
  }
}

export function ecrireReglagesMail(r: ReglagesMail) {
  try {
    window.localStorage.setItem(CLE_REGLAGES_MAIL, JSON.stringify(r));
  } catch {
    /* stockage indisponible */
  }
}

/** La phrase de récupération est gardée dans le coffre chiffré de l'appareil. */
export async function enregistrerPhrase(phrase: string) {
  await ecrireSecurise(CLE_PHRASE_MAIL, phrase);
}

export async function lirePhrase(): Promise<string | null> {
  return lireSecurise(CLE_PHRASE_MAIL);
}

export function estEmailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/* ------------------------------ Chiffrement ------------------------------ */

function versBase64(buf: ArrayBuffer | Uint8Array): string {
  const octets = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s);
}

function depuisBase64(txt: string): Uint8Array {
  const brut = atob(txt);
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) out[i] = brut.charCodeAt(i);
  return out;
}

function aleaIv(taille: number): Uint8Array {
  const iv = new Uint8Array(taille);
  crypto.getRandomValues(iv);
  return iv;
}

const SELS = [
  "superapp-mail-couche1",
  "superapp-mail-couche2",
  "superapp-mail-couche3",
  "superapp-mail-couche4",
  "superapp-mail-couche5",
] as const;

const ALGOS = ["AES-GCM", "AES-CBC", "AES-GCM", "AES-CBC", "AES-GCM"] as const;

async function cinqCles(phrase: string): Promise<CryptoKey[]> {
  const base = await crypto.subtle.importKey("raw", encodeur.encode(phrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return Promise.all(
    SELS.map((sel, i) =>
      crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: encodeur.encode(sel) as unknown as BufferSource,
          iterations: ITERATIONS,
          hash: "SHA-256",
        },
        base,
        { name: ALGOS[i]!, length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
    ),
  );
}

/** Chiffre cinq fois de suite un contenu texte. */
export async function chiffrerCinqFois(texte: string, phrase: string): Promise<string> {
  const cles = await cinqCles(phrase);
  const ivs = ALGOS.map((a) => aleaIv(a === "AES-GCM" ? 12 : 16));
  let donnees: BufferSource = encodeur.encode(texte) as unknown as BufferSource;
  for (let i = 0; i < 5; i += 1) {
    donnees = (await crypto.subtle.encrypt(
      { name: ALGOS[i]!, iv: ivs[i]! as unknown as BufferSource },
      cles[i]!,
      donnees,
    )) as unknown as BufferSource;
  }
  return `${PREFIXE}${ivs.map((iv) => versBase64(iv)).join(":")}:${versBase64(donnees as ArrayBuffer)}`;
}

/** Déchiffre un colis produit par `chiffrerCinqFois`. */
export async function dechiffrerCinqFois(colis: string, phrase: string): Promise<string> {
  const nettoye = colis.replace(/\s+/g, "");
  if (!nettoye.startsWith(PREFIXE)) {
    throw new Error("Ce texte n'est pas un colis de sauvegarde SUPER APP.");
  }
  const parts = nettoye.slice(PREFIXE.length).split(":");
  if (parts.length !== 6) throw new Error("Colis de sauvegarde incomplet ou endommagé.");
  const cles = await cinqCles(phrase);
  try {
    let donnees: BufferSource = depuisBase64(parts[5]!) as unknown as BufferSource;
    for (let i = 4; i >= 0; i -= 1) {
      donnees = (await crypto.subtle.decrypt(
        { name: ALGOS[i]!, iv: depuisBase64(parts[i]!) as unknown as BufferSource },
        cles[i]!,
        donnees,
      )) as unknown as BufferSource;
    }
    return decodeur.decode(donnees as ArrayBuffer);
  } catch {
    throw new Error("Phrase de récupération incorrecte ou colis endommagé.");
  }
}

/** Empreinte courte d'un contenu, pour n'envoyer que ce qui a changé. */
export async function empreinte(texte: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", encodeur.encode(texte));
  return versBase64(h).slice(0, 24);
}

/* --------------------------- File d'attente ------------------------------ */

/**
 * Un seul colis est conservé : la sauvegarde la plus récente remplace la
 * précédente. Hors connexion, elle patiente ici jusqu'au retour du réseau.
 */
export function lireFile(): ColisEnAttente | null {
  try {
    const brut = window.localStorage.getItem(CLE_FILE_MAIL);
    return brut ? (JSON.parse(brut) as ColisEnAttente) : null;
  } catch {
    return null;
  }
}

export function ecrireFile(colis: ColisEnAttente | null) {
  try {
    if (!colis) window.localStorage.removeItem(CLE_FILE_MAIL);
    else window.localStorage.setItem(CLE_FILE_MAIL, JSON.stringify(colis));
  } catch {
    /* stockage indisponible */
  }
}

/** Prépare le colis chiffré à partir de l'état de l'application. */
export async function preparerColis(etat: unknown, phrase: string): Promise<ColisEnAttente> {
  const brut = JSON.stringify(etat);
  const marque = await empreinte(brut);
  const contenu = await chiffrerCinqFois(brut, phrase);
  return {
    id: crypto.randomUUID(),
    creeLe: new Date().toISOString(),
    empreinte: marque,
    contenu,
    taille: contenu.length,
  };
}
