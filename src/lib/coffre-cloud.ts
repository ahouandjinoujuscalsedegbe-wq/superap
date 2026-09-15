/**
 * Coffre en ligne rattaché à l'adresse e-mail de l'utilisateur, SANS aucun
 * e-mail envoyé. Les copies sont déjà chiffrées cinq fois avant de partir, et
 * la clé d'accès est une empreinte dérivée de l'adresse + la phrase de
 * récupération : ni l'adresse ni la phrase ne quittent le téléphone.
 *
 * L'appel passe par une route HTTP publique pour fonctionner à l'identique
 * dans le navigateur et dans l'application Android installée.
 */

import { RELAIS_MAJ } from "@/lib/version";

const ITERATIONS_CLE = 200_000;

const encodeur = new TextEncoder();

/** Dans l'APK, la page est servie localement : il faut viser le serveur. */
function adresseCoffre(): string {
  const base =
    typeof window !== "undefined" && window.location.protocol.startsWith("http")
      ? window.location.origin
      : RELAIS_MAJ;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(base);
  return `${local ? RELAIS_MAJ : base}/api/public/coffre`;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("");
}

/** Empreinte secrète du compte : adresse e-mail + phrase de récupération. */
export async function cleCompte(email: string, phrase: string): Promise<string> {
  const base = await crypto.subtle.importKey(
    "raw",
    encodeur.encode(`superapp-coffre-cloud|${phrase}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encodeur.encode(`superapp-cloud|${email.trim().toLowerCase()}`),
      iterations: ITERATIONS_CLE,
    },
    base,
    256,
  );
  return hex(bits);
}

export type ColisCloud = {
  contenu: string;
  empreinte: string;
  taille: number;
  classement?: string;
};

export type CopieCloud = {
  empreinte: string;
  contenu: string;
  appareil: string;
  taille: number;
  classement: string;
  creeLe: string;
};

async function appeler(corps: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const reponse = await fetch(adresseCoffre(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (!reponse.ok) return null;
    return (await reponse.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Dépose silencieusement une copie chiffrée dans le coffre du compte. */
export async function deposerDansCloud(
  email: string,
  phrase: string,
  appareil: string,
  colis: ColisCloud,
): Promise<boolean> {
  try {
    const cle = await cleCompte(email, phrase);
    const reponse = await appeler({
      action: "deposer",
      cle,
      empreinte: colis.empreinte,
      contenu: colis.contenu,
      appareil,
      taille: colis.taille,
      ...(colis.classement ? { classement: colis.classement } : {}),
    });
    return reponse?.["ok"] === true;
  } catch {
    return false;
  }
}

/** Récupère les copies du compte (la plus récente d'abord). */
export async function lireDepuisCloud(email: string, phrase: string): Promise<CopieCloud[]> {
  const cle = await cleCompte(email, phrase);
  const reponse = await appeler({ action: "lire", cle });
  const copies = reponse?.["copies"];
  return Array.isArray(copies) ? (copies as CopieCloud[]) : [];
}
