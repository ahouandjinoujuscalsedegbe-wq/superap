/**
 * Deuxième coffre : une phrase distincte protège les pages sensibles
 * (objectifs, dettes, sauvegarde, journal). Le premier coffre reste ouvert
 * au quotidien ; celui-ci ne s'ouvre que sur demande, le temps d'une session.
 */

import { cleAesDepuisSecret } from "./derivation";
import { lireOptions } from "./securite-avancee";

const CLE_SCELLE = "superapp:coffre-sensible:v1";
const CLE_SESSION = "superapp:coffre-sensible:ouvert";

/** Pages protégées par la phrase du deuxième coffre. */
export const PAGES_SENSIBLES = ["/objectifs", "/dettes", "/sauvegarde", "/journal"];

function base64(o: ArrayBuffer | Uint8Array): string {
  const v = o instanceof Uint8Array ? o : new Uint8Array(o);
  let s = "";
  for (const x of v) s += String.fromCharCode(x);
  return btoa(s);
}

function deBase64(t: string): Uint8Array {
  const brut = atob(t);
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) out[i] = brut.charCodeAt(i);
  return out;
}

export function coffreSensibleConfigure(): boolean {
  try {
    return Boolean(window.localStorage.getItem(CLE_SCELLE));
  } catch {
    return false;
  }
}

export function coffreSensibleOuvert(): boolean {
  try {
    return window.sessionStorage.getItem(CLE_SESSION) === "1";
  } catch {
    return false;
  }
}

export function refermerCoffreSensible(): void {
  try {
    window.sessionStorage.removeItem(CLE_SESSION);
  } catch {
    /* stockage indisponible */
  }
}

/** Définit (ou remplace) la phrase du deuxième coffre. */
export async function definirPhraseSensible(phrase: string): Promise<void> {
  const sel = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(sel);
  crypto.getRandomValues(iv);
  const algo = lireOptions().derivationForte ? "argon2id" : "pbkdf2";
  const cle = await cleAesDepuisSecret(phrase, sel, algo);
  const temoin = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    cle,
    new TextEncoder().encode("coffre-sensible-ok"),
  );
  window.localStorage.setItem(
    CLE_SCELLE,
    JSON.stringify({ sel: base64(sel), iv: base64(iv), temoin: base64(temoin), algo }),
  );
  try {
    window.sessionStorage.setItem(CLE_SESSION, "1");
  } catch {
    /* stockage indisponible */
  }
}

/** Ouvre le deuxième coffre pour la session en cours. */
export async function ouvrirCoffreSensible(phrase: string): Promise<boolean> {
  let brut: string | null = null;
  try {
    brut = window.localStorage.getItem(CLE_SCELLE);
  } catch {
    return false;
  }
  if (!brut) return false;
  try {
    const d = JSON.parse(brut) as { sel: string; iv: string; temoin: string; algo?: string };
    const cle = await cleAesDepuisSecret(
      phrase,
      deBase64(d.sel),
      d.algo === "argon2id" ? "argon2id" : "pbkdf2",
    );
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(d.iv) as unknown as BufferSource },
      cle,
      deBase64(d.temoin) as unknown as BufferSource,
    );
    if (new TextDecoder().decode(clair) !== "coffre-sensible-ok") return false;
    window.sessionStorage.setItem(CLE_SESSION, "1");
    return true;
  } catch {
    return false;
  }
}

/** Supprime la protection du deuxième coffre (après vérification de la phrase). */
export async function retirerCoffreSensible(phrase: string): Promise<boolean> {
  if (!(await ouvrirCoffreSensible(phrase))) return false;
  try {
    window.localStorage.removeItem(CLE_SCELLE);
  } catch {
    /* stockage indisponible */
  }
  refermerCoffreSensible();
  return true;
}
