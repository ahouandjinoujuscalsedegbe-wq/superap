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

/**
 * Dans l'application installée (Android), la page est servie depuis le
 * téléphone : il faut viser le serveur public. Dans un navigateur, on reste
 * sur la même adresse que la page.
 */
function adresseCoffre(): string {
  if (typeof window === "undefined") return `${RELAIS_MAJ}/api/public/coffre`;
  const pont = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const embarquee =
    !window.location.protocol.startsWith("http") || pont?.isNativePlatform?.() === true;
  const base = embarquee ? RELAIS_MAJ : window.location.origin;
  return `${base}/api/public/coffre`;
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

/**
 * Anciennes versions de l'application mettaient tous les champs en
 * majuscules, y compris la phrase de récupération. On essaie donc la phrase
 * telle qu'elle est saisie, puis ses variantes, pour que personne ne perde
 * l'accès à ses copies.
 */
export function variantesPhrase(phrase: string): string[] {
  const propre = phrase.trim();
  const liste = [propre, propre.toLocaleUpperCase("fr-FR"), propre.toLocaleLowerCase("fr-FR")];
  return liste.filter((v, i) => v.length > 0 && liste.indexOf(v) === i);
}

/** Cherche les copies du compte en acceptant les variantes de la phrase. */
export async function chercherCopiesDuCompte(
  email: string,
  phrase: string,
): Promise<{ copies: CopieCloud[]; phrase: string }> {
  for (const essai of variantesPhrase(phrase)) {
    const copies = await lireDepuisCloud(email, essai);
    if (copies.length > 0) return { copies, phrase: essai };
  }
  return { copies: [], phrase: phrase.trim() };
}
