/**
 * Sauvegarde, export et chiffrement local.
 *
 * Tout se passe dans le navigateur : la clé est dérivée d'une phrase secrète
 * (PBKDF2-SHA256) puis les données sont chiffrées en AES-GCM 256 bits.
 * Aucun service externe n'est appelé.
 */

export const VERSION_SAUVEGARDE = 1;
export const CLE_AUTO = "superapp:sauvegardes:v1";

export type EnveloppeChiffree = {
  format: "SUPERAPP-CHIFFRE";
  version: number;
  creeLe: string;
  iterations: number;
  sel: string;
  iv: string;
  donnees: string;
};

export type SauvegardeAuto = {
  id: string;
  creeLe: string;
  taille: number;
  contenu: string;
};

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();
const ITERATIONS = 210_000;

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

async function deriverCle(phrase: string, sel: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    encodeur.encode(phrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sel as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Chiffre un objet quelconque avec une phrase secrète. */
export async function chiffrer(donnees: unknown, phrase: string): Promise<EnveloppeChiffree> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cle = await deriverCle(phrase, sel);
  const clair = encodeur.encode(JSON.stringify(donnees));
  const chiffre = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    cle,
    clair as unknown as BufferSource,
  );
  return {
    format: "SUPERAPP-CHIFFRE",
    version: VERSION_SAUVEGARDE,
    creeLe: new Date().toISOString(),
    iterations: ITERATIONS,
    sel: versBase64(sel),
    iv: versBase64(iv),
    donnees: versBase64(chiffre),
  };
}

/** Déchiffre une enveloppe produite par `chiffrer`. Lève une erreur claire si la phrase est fausse. */
export async function dechiffrer<T = unknown>(
  enveloppe: EnveloppeChiffree,
  phrase: string,
): Promise<T> {
  if (enveloppe?.format !== "SUPERAPP-CHIFFRE") {
    throw new Error("Ce fichier n'est pas une sauvegarde chiffrée SUPER APP.");
  }
  const sel = depuisBase64(enveloppe.sel);
  const iv = depuisBase64(enveloppe.iv);
  const cle = await deriverCle(phrase, sel);
  try {
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      cle,
      depuisBase64(enveloppe.donnees) as unknown as BufferSource,
    );
    return JSON.parse(decodeur.decode(clair)) as T;
  } catch {
    throw new Error("Phrase secrète incorrecte ou fichier endommagé.");
  }
}

/** Analyse un texte de fichier importé : enveloppe chiffrée ou export lisible. */
export function analyserFichier(texte: string): {
  chiffre: boolean;
  enveloppe?: EnveloppeChiffree;
  donnees?: unknown;
} {
  const objet = JSON.parse(texte) as Record<string, unknown>;
  if (objet && objet["format"] === "SUPERAPP-CHIFFRE") {
    return { chiffre: true, enveloppe: objet as unknown as EnveloppeChiffree };
  }
  return { chiffre: false, donnees: objet };
}

/** Télécharge un contenu texte sous forme de fichier. */
export function telecharger(nom: string, contenu: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export function horodatageFichier(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Convertit les listes principales en CSV lisible (non sensible aux formats). */
export function versCsv(etat: {
  transactions: { date: string; type: string; libelle: string; categorie: string; compte: string; montant: number }[];
  transferts: { date: string; source: string; destination: string; montant: number; note: string }[];
}): string {
  const echapper = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lignes: string[] = ["TYPE;DATE;LIBELLE;CATEGORIE;COMPTE;MONTANT"];
  for (const t of etat.transactions) {
    lignes.push(
      [t.type, t.date, t.libelle, t.categorie, t.compte, t.montant].map(echapper).join(";"),
    );
  }
  for (const t of etat.transferts) {
    lignes.push(
      ["transfert", t.date, t.note, `${t.source} → ${t.destination}`, t.source, t.montant]
        .map(echapper)
        .join(";"),
    );
  }
  return lignes.join("\n");
}

/* ------------------------- Sauvegardes automatiques ------------------------ */

export function lireSauvegardes(): SauvegardeAuto[] {
  try {
    const brut = window.localStorage.getItem(CLE_AUTO);
    return brut ? (JSON.parse(brut) as SauvegardeAuto[]) : [];
  } catch {
    return [];
  }
}

function ecrireSauvegardes(liste: SauvegardeAuto[]) {
  try {
    window.localStorage.setItem(CLE_AUTO, JSON.stringify(liste.slice(0, 10)));
  } catch {
    /* stockage plein ou indisponible */
  }
}

/** Enregistre un point de restauration local (10 conservés au maximum). */
export function enregistrerPoint(etat: unknown): SauvegardeAuto {
  const contenu = JSON.stringify(etat);
  const point: SauvegardeAuto = {
    id: crypto.randomUUID(),
    creeLe: new Date().toISOString(),
    taille: contenu.length,
    contenu,
  };
  ecrireSauvegardes([point, ...lireSauvegardes()]);
  return point;
}

export function supprimerPoint(id: string) {
  ecrireSauvegardes(lireSauvegardes().filter((p) => p.id !== id));
}

export function viderPoints() {
  ecrireSauvegardes([]);
}
