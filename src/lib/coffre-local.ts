/**
 * Coffre local : chiffrement des données AVANT écriture dans le stockage local.
 *
 * Objectif : rien n'est jamais écrit en clair sur le téléphone. Les données
 * sont chiffrées en AES-GCM 256 bits avec une clé dérivée (PBKDF2-SHA256)
 * d'un secret aléatoire propre à l'installation, généré au premier lancement.
 * Seule l'application peut donc relire le contenu ; un explorateur de fichiers,
 * une sauvegarde système ou un autre logiciel ne voit que du binaire illisible.
 */

const PREFIXE = "SAC1:";
const CLE_SECRET_APPAREIL = "superapp:coffre:secret:v1";
const ITERATIONS = 150_000;

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

let clePromesse: Promise<CryptoKey> | null = null;

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

/** Secret aléatoire propre à cette installation (créé une seule fois). */
function secretAppareil(): string {
  let secret = window.localStorage.getItem(CLE_SECRET_APPAREIL);
  if (!secret) {
    const alea = new Uint8Array(32);
    crypto.getRandomValues(alea);
    secret = versBase64(alea);
    window.localStorage.setItem(CLE_SECRET_APPAREIL, secret);
  }
  return secret;
}

async function cleCoffre(): Promise<CryptoKey> {
  if (!clePromesse) {
    clePromesse = (async () => {
      const base = await crypto.subtle.importKey(
        "raw",
        encodeur.encode(secretAppareil()),
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      return crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: encodeur.encode("superapp-coffre-local-v1") as unknown as BufferSource,
          iterations: ITERATIONS,
          hash: "SHA-256",
        },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
  }
  return clePromesse;
}

export function estChiffre(valeur: string): boolean {
  return valeur.startsWith(PREFIXE);
}

/** Chiffre un texte pour le stockage local. */
export async function chiffrerLocal(texte: string): Promise<string> {
  const cle = await cleCoffre();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const scelle = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    cle,
    encodeur.encode(texte),
  );
  return `${PREFIXE}${versBase64(iv)}:${versBase64(scelle)}`;
}

/** Déchiffre un texte lu depuis le stockage local. */
export async function dechiffrerLocal(valeur: string): Promise<string | null> {
  if (!estChiffre(valeur)) return valeur; // ancienne donnée en clair : migrée à la prochaine écriture
  const morceaux = valeur.slice(PREFIXE.length).split(":");
  if (morceaux.length !== 2) return null;
  try {
    const cle = await cleCoffre();
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: depuisBase64(morceaux[0]!) as unknown as BufferSource },
      cle,
      depuisBase64(morceaux[1]!) as unknown as BufferSource,
    );
    return decodeur.decode(clair);
  } catch {
    return null;
  }
}

/** Lit une valeur chiffrée du stockage local (accepte l'ancien format en clair). */
export async function lireSecurise(cle: string): Promise<string | null> {
  try {
    const brut = window.localStorage.getItem(cle);
    if (!brut) return null;
    return await dechiffrerLocal(brut);
  } catch {
    return null;
  }
}

/** Écrit une valeur dans le stockage local, toujours chiffrée. */
export async function ecrireSecurise(cle: string, valeur: string): Promise<void> {
  try {
    window.localStorage.setItem(cle, await chiffrerLocal(valeur));
  } catch {
    /* stockage indisponible */
  }
}
