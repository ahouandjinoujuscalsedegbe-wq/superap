/**
 * Dérivation de clé à partir d'un secret humain (code PIN, phrase).
 *
 * Deux algorithmes :
 * - PBKDF2-SHA256 : standard du navigateur, historique de l'application.
 * - Argon2id : plus récent, gourmand en mémoire, donc bien plus coûteux à
 *   attaquer avec des machines spécialisées (cartes graphiques).
 */

import { argon2idAsync } from "@noble/hashes/argon2.js";

export type AlgoDerivation = "pbkdf2" | "argon2id";

const ITERATIONS_PBKDF2 = 150_000;

/** Dérive 32 octets de clé depuis un secret et un sel. */
export async function deriverOctets(
  secret: string,
  sel: Uint8Array,
  algo: AlgoDerivation,
): Promise<Uint8Array> {
  if (algo === "argon2id") {
    // 32 Mo de mémoire, 3 passes : coûteux pour un attaquant, tenable sur mobile.
    const sortie = await argon2idAsync(secret, sel, { t: 3, m: 32_768, p: 1, dkLen: 32 });
    return new Uint8Array(sortie);
  }
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: sel as unknown as BufferSource,
      iterations: ITERATIONS_PBKDF2,
      hash: "SHA-256",
    },
    base,
    256,
  );
  return new Uint8Array(bits);
}

/** Clé AES-GCM dérivée d'un secret humain. */
export async function cleAesDepuisSecret(
  secret: string,
  sel: Uint8Array,
  algo: AlgoDerivation,
): Promise<CryptoKey> {
  const octets = await deriverOctets(secret, sel, algo);
  return crypto.subtle.importKey("raw", octets as unknown as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
