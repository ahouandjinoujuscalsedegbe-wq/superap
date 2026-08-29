/**
 * Synchronisation chiffrée par e-mail.
 *
 * Principe : l'appareil produit un « colis » chiffré (AES-GCM, clé dérivée de
 * la phrase secrète de synchronisation) encodé en texte. Ce texte est envoyé
 * par e-mail (ou partagé), puis collé sur l'autre appareil qui le déchiffre et
 * fusionne les données. Aucun serveur n'intervient.
 */

import { chiffrer, dechiffrer, type EnveloppeChiffree } from "./sauvegarde";

export const CLE_SYNC = "superapp:sync:v1";
const MARQUE_DEBUT = "-----DEBUT COLIS SUPER APP-----";
const MARQUE_FIN = "-----FIN COLIS SUPER APP-----";

export type ReglagesSync = {
  email: string;
  appareil: string;
  dernierEnvoi?: string;
  dernierImport?: string;
  historique: EntreeSync[];
};

export type EntreeSync = {
  id: string;
  sens: "envoi" | "import";
  date: string;
  appareil: string;
  elements: number;
  detail: string;
};

export type ColisSync = {
  appareil: string;
  creeLe: string;
  transactions: unknown[];
  transferts: unknown[];
  enveloppes: unknown[];
  categories: unknown[];
  comptes: string[];
  budgets: unknown[];
  dettes: unknown[];
};

export const REGLAGES_SYNC_INITIAUX: ReglagesSync = {
  email: "",
  appareil: "MON TÉLÉPHONE",
  historique: [],
};

export function lireReglagesSync(): ReglagesSync {
  try {
    const brut = window.localStorage.getItem(CLE_SYNC);
    return brut
      ? { ...REGLAGES_SYNC_INITIAUX, ...(JSON.parse(brut) as Partial<ReglagesSync>) }
      : REGLAGES_SYNC_INITIAUX;
  } catch {
    return REGLAGES_SYNC_INITIAUX;
  }
}

export function ecrireReglagesSync(r: ReglagesSync) {
  try {
    window.localStorage.setItem(
      CLE_SYNC,
      JSON.stringify({ ...r, historique: r.historique.slice(0, 30) }),
    );
  } catch {
    /* stockage indisponible */
  }
}

/** Fabrique le texte du colis chiffré à coller dans l'e-mail. */
export async function fabriquerColis(colis: ColisSync, phrase: string): Promise<string> {
  const enveloppe = await chiffrer(colis, phrase);
  const corps = btoa(JSON.stringify(enveloppe)).replace(/(.{76})/g, "$1\n");
  return `${MARQUE_DEBUT}\n${corps}\n${MARQUE_FIN}`;
}

/** Lit un colis collé (avec ou sans les marques) et le déchiffre. */
export async function ouvrirColis(texte: string, phrase: string): Promise<ColisSync> {
  const nettoye = texte
    .replace(MARQUE_DEBUT, "")
    .replace(MARQUE_FIN, "")
    .replace(/\s+/g, "")
    .trim();
  if (!nettoye) throw new Error("Le colis de synchronisation est vide.");
  let enveloppe: EnveloppeChiffree;
  try {
    enveloppe = JSON.parse(atob(nettoye)) as EnveloppeChiffree;
  } catch {
    throw new Error("Ce texte n'est pas un colis de synchronisation SUPER APP.");
  }
  return dechiffrer<ColisSync>(enveloppe, phrase);
}

/** Lien mailto prêt à l'emploi (le colis est joint dans le corps du message). */
export function lienEmail(email: string, appareil: string, colis: string): string {
  const sujet = `SUPER APP — colis de synchronisation (${appareil})`;
  const corps = `Colis chiffré généré le ${new Date().toLocaleString("fr-FR")}.\nCollez ce bloc dans la page Synchronisation de l'autre appareil.\n\n${colis}\n`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

type AvecId = { id: string };

/** Fusion sans doublon : les éléments déjà présents (même id) sont conservés. */
export function fusionnerParId<T extends AvecId>(actuel: T[], entrant: T[]): {
  liste: T[];
  ajoutes: number;
} {
  const connus = new Set(actuel.map((x) => x.id));
  const nouveaux = entrant.filter((x) => x && x.id && !connus.has(x.id));
  return { liste: [...nouveaux, ...actuel], ajoutes: nouveaux.length };
}

export function fusionnerNoms(actuel: string[], entrant: string[]): {
  liste: string[];
  ajoutes: number;
} {
  const nouveaux = entrant.filter((x) => typeof x === "string" && !actuel.includes(x));
  return { liste: [...actuel, ...nouveaux], ajoutes: nouveaux.length };
}
