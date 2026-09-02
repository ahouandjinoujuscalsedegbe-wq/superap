/**
 * Coffre local : chiffrement des données AVANT écriture dans le stockage local.
 *
 * Objectif : aucune donnée métier n'est écrite en clair sur le téléphone.
 * Elles sont chiffrées en AES-GCM 256 bits avec une clé dérivée (PBKDF2-SHA256)
 * d'un secret aléatoire propre à l'installation, généré au premier lancement.
 * Un explorateur de fichiers ou une sauvegarde système ne voit que du binaire.
 *
 * LIMITE ASSUMÉE : le secret d'appareil est lui-même stocké en clair dans le
 * stockage local (il faut bien amorcer le déchiffrement sans mot de passe).
 * Cette protection couvre donc l'accès au fichier de stockage, PAS un code
 * JavaScript hostile qui s'exécuterait déjà dans l'application. Pour un
 * secret réellement inviolable, il faut le verrouillage par code PIN.
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

let secretMemo: string | null = null;

/** Secret aléatoire propre à cette installation (créé une seule fois). */
function secretAppareil(): string {
  if (secretMemo) return secretMemo;
  let secret = window.localStorage.getItem(CLE_SECRET_APPAREIL);
  if (!secret) {
    const alea = new Uint8Array(32);
    crypto.getRandomValues(alea);
    secret = versBase64(alea);
    window.localStorage.setItem(CLE_SECRET_APPAREIL, secret);
    // Relecture : si un autre contexte a écrit le sien entre-temps, c'est
    // le secret réellement stocké qui fait foi, jamais celui en mémoire.
    secret = window.localStorage.getItem(CLE_SECRET_APPAREIL) ?? secret;
  }
  secretMemo = secret;
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

/**
 * Résultat détaillé d'une lecture.
 * - `vide`      : aucune donnée enregistrée (première utilisation).
 * - `ok`        : donnée lue et déchiffrée.
 * - `illisible` : une donnée EXISTE mais ne peut pas être déchiffrée
 *                 (secret d'appareil perdu ou fichier corrompu). L'appelant
 *                 ne doit surtout rien réécrire par-dessus.
 */
export type LectureCoffre =
  { statut: "vide" } | { statut: "ok"; valeur: string } | { statut: "illisible" };

/** Lit une valeur chiffrée en distinguant « rien » de « illisible ». */
export async function lireSecuriseDetail(cle: string): Promise<LectureCoffre> {
  let brut: string | null = null;
  try {
    brut = window.localStorage.getItem(cle);
  } catch {
    return { statut: "illisible" };
  }
  if (!brut) return { statut: "vide" };
  const clair = await dechiffrerLocal(brut);
  if (clair === null) return { statut: "illisible" };
  return { statut: "ok", valeur: clair };
}

/** Lit une valeur chiffrée du stockage local (accepte l'ancien format en clair). */
export async function lireSecurise(cle: string): Promise<string | null> {
  const r = await lireSecuriseDetail(cle);
  return r.statut === "ok" ? r.valeur : null;
}

/**
 * File d'attente par clé : deux écritures rapprochées sont chiffrées et
 * enregistrées dans l'ordre exact où elles ont été demandées. Sans cela, la
 * plus ancienne pouvait terminer en dernier et écraser la plus récente.
 */
const files = new Map<string, Promise<void>>();

/** Écrit une valeur dans le stockage local, toujours chiffrée, dans l'ordre. */
export function ecrireSecurise(cle: string, valeur: string): Promise<void> {
  const precedent = files.get(cle) ?? Promise.resolve();
  const suivant = precedent
    .catch(() => undefined)
    .then(async () => {
      try {
        window.localStorage.setItem(cle, await chiffrerLocal(valeur));
      } catch {
        /* stockage indisponible ou saturé */
      }
    })
    .finally(() => {
      if (files.get(cle) === suivant) files.delete(cle);
    });
  files.set(cle, suivant);
  return suivant;
}
