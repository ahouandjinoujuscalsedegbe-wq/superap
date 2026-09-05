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
/** Format triple couche (chiffré trois fois de suite). */
const PREFIXE_TRIPLE = "SAC3:";
const CLE_SECRET_APPAREIL = "superapp:coffre:secret:v1";
/** Secret d'appareil scellé par le code PIN (protection renforcée). */
const CLE_SECRET_PROTEGE = "superapp:coffre:secret:protege:v1";
const ITERATIONS = 150_000;

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

let clePromesse: Promise<{ c1: CryptoKey; c2: CryptoKey; c3: CryptoKey }> | null = null;

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

/** Erreur levée tant que le coffre protégé par PIN n'a pas été ouvert. */
export class CoffreVerrouille extends Error {
  constructor() {
    super("Coffre verrouillé : code PIN requis.");
    this.name = "CoffreVerrouille";
  }
}

/** Vrai lorsque le secret du coffre est scellé par le code PIN. */
export function estCoffreProtege(): boolean {
  try {
    return Boolean(window.localStorage.getItem(CLE_SECRET_PROTEGE));
  } catch {
    return false;
  }
}

/** Vrai lorsque le coffre protégé a déjà été ouvert dans cette session. */
export function coffreOuvert(): boolean {
  return !estCoffreProtege() || secretMemo !== null;
}

/** Clé AES dérivée du code PIN (sert uniquement à sceller le secret). */
async function cleDepuisPin(pin: string, sel: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encodeur.encode(pin), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: sel as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Scelle le secret du coffre avec le code PIN : il disparaît du stockage en
 * clair. Sans le PIN, même une copie complète du téléphone est illisible.
 */
export async function protegerCoffreParPin(pin: string): Promise<void> {
  const secret = secretAppareil();
  const sel = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(sel);
  crypto.getRandomValues(iv);
  const cle = await cleDepuisPin(pin, sel);
  const scelle = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    cle,
    encodeur.encode(secret),
  );
  window.localStorage.setItem(
    CLE_SECRET_PROTEGE,
    JSON.stringify({ sel: versBase64(sel), iv: versBase64(iv), contenu: versBase64(scelle) }),
  );
  window.localStorage.removeItem(CLE_SECRET_APPAREIL);
  secretMemo = secret;
}

/** Ouvre le coffre protégé avec le code PIN. */
export async function ouvrirCoffreAvecPin(pin: string): Promise<boolean> {
  let brut: string | null = null;
  try {
    brut = window.localStorage.getItem(CLE_SECRET_PROTEGE);
  } catch {
    return false;
  }
  if (!brut) return true;
  try {
    const { sel, iv, contenu } = JSON.parse(brut) as {
      sel: string;
      iv: string;
      contenu: string;
    };
    const cle = await cleDepuisPin(pin, depuisBase64(sel));
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: depuisBase64(iv) as unknown as BufferSource },
      cle,
      depuisBase64(contenu) as unknown as BufferSource,
    );
    secretMemo = decodeur.decode(clair);
    clePromesse = null;
    return true;
  } catch {
    return false;
  }
}

/** Retire la protection par PIN (le secret redevient stocké tel quel). */
export async function retirerProtectionPin(pin: string): Promise<boolean> {
  if (!estCoffreProtege()) return true;
  if (!(await ouvrirCoffreAvecPin(pin))) return false;
  if (secretMemo) window.localStorage.setItem(CLE_SECRET_APPAREIL, secretMemo);
  window.localStorage.removeItem(CLE_SECRET_PROTEGE);
  return true;
}

/** Secret aléatoire propre à cette installation (créé une seule fois). */
function secretAppareil(): string {
  if (secretMemo) return secretMemo;
  if (estCoffreProtege()) throw new CoffreVerrouille();
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

/** Dérive une clé du secret d'appareil, avec un sel et un algorithme donnés. */
async function deriver(
  sel: string,
  algo: "AES-GCM" | "AES-CBC",
  iterations: number,
): Promise<CryptoKey> {
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
      salt: encodeur.encode(sel) as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    base,
    { name: algo, length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

type Cles = { c1: CryptoKey; c2: CryptoKey; c3: CryptoKey };

/**
 * Trois clés indépendantes : le contenu est chiffré trois fois de suite
 * (AES-GCM, puis AES-CBC, puis de nouveau AES-GCM avec une autre clé).
 * Casser une couche ne donne que du binaire à nouveau chiffré.
 */
async function cleCoffre(): Promise<Cles> {
  if (!clePromesse) {
    const tentative = (async (): Promise<Cles> => {
      const [c1, c2, c3] = await Promise.all([
        deriver("superapp-coffre-local-v1", "AES-GCM", ITERATIONS),
        deriver("superapp-coffre-couche2-v3", "AES-CBC", ITERATIONS),
        deriver("superapp-coffre-couche3-v3", "AES-GCM", ITERATIONS),
      ]);
      return { c1, c2, c3 };
    })();
    // Une clé refusée (coffre verrouillé) ne doit pas rester en mémoire :
    // sinon toutes les lectures suivantes échoueraient même après le PIN.
    tentative.catch(() => {
      if (clePromesse === tentative) clePromesse = null;
    });
    clePromesse = tentative;
  }
  return clePromesse;
}

export function estChiffre(valeur: string): boolean {
  return valeur.startsWith(PREFIXE) || valeur.startsWith(PREFIXE_TRIPLE);
}

function aleaIv(taille: number): Uint8Array {
  const iv = new Uint8Array(taille);
  crypto.getRandomValues(iv);
  return iv;
}

/** Chiffre un texte pour le stockage local (triple couche). */
export async function chiffrerLocal(texte: string): Promise<string> {
  const { c1, c2, c3 } = await cleCoffre();
  const iv1 = aleaIv(12);
  const iv2 = aleaIv(16);
  const iv3 = aleaIv(12);
  const couche1 = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv1 as unknown as BufferSource },
    c1,
    encodeur.encode(texte),
  );
  const couche2 = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: iv2 as unknown as BufferSource },
    c2,
    couche1,
  );
  const couche3 = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv3 as unknown as BufferSource },
    c3,
    couche2,
  );
  return `${PREFIXE_TRIPLE}${versBase64(iv1)}:${versBase64(iv2)}:${versBase64(iv3)}:${versBase64(couche3)}`;
}

/** Déchiffre un texte lu depuis le stockage local (triple ou ancienne couche). */
export async function dechiffrerLocal(valeur: string): Promise<string | null> {
  if (!estChiffre(valeur)) return valeur; // ancienne donnée en clair : migrée à la prochaine écriture
  try {
    const { c1, c2, c3 } = await cleCoffre();
    if (valeur.startsWith(PREFIXE_TRIPLE)) {
      const m = valeur.slice(PREFIXE_TRIPLE.length).split(":");
      if (m.length !== 4) return null;
      const couche2 = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: depuisBase64(m[2]!) as unknown as BufferSource },
        c3,
        depuisBase64(m[3]!) as unknown as BufferSource,
      );
      const couche1 = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: depuisBase64(m[1]!) as unknown as BufferSource },
        c2,
        couche2,
      );
      const clair = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: depuisBase64(m[0]!) as unknown as BufferSource },
        c1,
        couche1,
      );
      return decodeur.decode(clair);
    }
    const morceaux = valeur.slice(PREFIXE.length).split(":");
    if (morceaux.length !== 2) return null;
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: depuisBase64(morceaux[0]!) as unknown as BufferSource },
      c1,
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
