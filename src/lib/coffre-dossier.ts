/**
 * Coffre local nommé par l'utilisateur.
 *
 * À la première utilisation sur un téléphone, l'utilisateur crée lui-même son
 * dossier de coffre (il choisit le nom). Chaque saisie y est ensuite déposée
 * DÉJÀ CHIFFRÉE (même colis SAM5 que la copie distante), en plus du dépôt dans
 * l'espace rattaché à l'adresse e-mail.
 *
 * Emplacement : espace privé de l'application (Directory.Data sur Android),
 * jamais les Documents ni la mémoire partagée : un autre logiciel ou une
 * personne qui explore le téléphone ne peut pas y accéder. En navigateur, le
 * dossier est simulé dans le stockage local, lui-même chiffré.
 */

import { chiffrerLocal, dechiffrerLocal } from "./coffre-local";

const CLE_DOSSIER = "superapp:coffre:dossier:v1";
const CLE_COPIES = "superapp:coffre:dossier:copies:v1";
/** Nombre de copies conservées dans le dossier (les plus anciennes partent). */
const MAX_COPIES = 12;

export type DossierCoffre = {
  /** Nom choisi par l'utilisateur. */
  nom: string;
  /** Chemin réel utilisé sur l'appareil. */
  chemin: string;
  /** « appareil » = dossier privé réel, « navigateur » = coffre simulé. */
  support: "appareil" | "navigateur";
  creeLe: string;
};

export type CopieLocale = {
  empreinte: string;
  fichier: string;
  taille: number;
  creeLe: string;
  classement?: string;
};

/** Nom de dossier accepté : lettres, chiffres, espaces, tiret et souligné. */
export function nomDossierValide(nom: string): boolean {
  const propre = nom.trim();
  return propre.length >= 3 && propre.length <= 40 && /^[\p{L}\p{N} _-]+$/u.test(propre);
}

function nomTechnique(nom: string): string {
  return nom
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

export function lireDossier(): DossierCoffre | null {
  try {
    const brut = window.localStorage.getItem(CLE_DOSSIER);
    if (!brut) return null;
    const v = JSON.parse(brut) as Partial<DossierCoffre>;
    if (!v || typeof v.nom !== "string" || typeof v.chemin !== "string") return null;
    return {
      nom: v.nom,
      chemin: v.chemin,
      support: v.support === "appareil" ? "appareil" : "navigateur",
      creeLe: typeof v.creeLe === "string" ? v.creeLe : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Vrai lorsque le dossier de coffre reste à créer sur ce téléphone. */
export function dossierAcreer(): boolean {
  return lireDossier() === null;
}

async function fichiers(): Promise<
  | { Filesystem: typeof import("@capacitor/filesystem").Filesystem; dossier: string }
  | null
> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    return { Filesystem, dossier: Directory.Data };
  } catch {
    return null;
  }
}

/**
 * Crée le dossier choisi par l'utilisateur. Renvoie le dossier enregistré, ou
 * `null` si le nom est refusé ou si l'appareil empêche l'écriture.
 */
export async function creerDossier(nom: string): Promise<DossierCoffre | null> {
  if (!nomDossierValide(nom)) return null;
  const chemin = `coffre-${nomTechnique(nom) || "prive"}`;
  let support: DossierCoffre["support"] = "navigateur";
  const natif = await fichiers();
  if (natif) {
    try {
      await natif.Filesystem.mkdir({
        path: chemin,
        directory: natif.dossier as never,
        recursive: true,
      }).catch((e: unknown) => {
        // Un dossier déjà présent n'est pas une erreur.
        if (!String((e as { message?: string })?.message ?? "").includes("exist")) throw e;
      });
      support = "appareil";
    } catch {
      support = "navigateur";
    }
  }
  const dossier: DossierCoffre = {
    nom: nom.trim(),
    chemin,
    support,
    creeLe: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CLE_DOSSIER, JSON.stringify(dossier));
  } catch {
    return null;
  }
  return dossier;
}

function lireIndex(): CopieLocale[] {
  try {
    const brut = window.localStorage.getItem(CLE_COPIES);
    if (!brut) return [];
    const v = JSON.parse(brut) as CopieLocale[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function ecrireIndex(liste: CopieLocale[]): boolean {
  try {
    window.localStorage.setItem(CLE_COPIES, JSON.stringify(liste));
    return true;
  } catch {
    return false;
  }
}

function cleContenu(fichier: string): string {
  return `superapp:coffre:dossier:contenu:${fichier}`;
}

async function supprimerCopie(copie: CopieLocale, dossier: DossierCoffre): Promise<void> {
  if (dossier.support === "appareil") {
    const natif = await fichiers();
    if (natif) {
      await natif.Filesystem.deleteFile({
        path: `${dossier.chemin}/${copie.fichier}`,
        directory: natif.dossier as never,
      }).catch(() => undefined);
    }
  }
  try {
    window.localStorage.removeItem(cleContenu(copie.fichier));
  } catch {
    /* rien à retirer */
  }
}

/**
 * Dépose une copie déjà chiffrée dans le dossier du coffre.
 * Le contenu reçu est le colis SAM5 (chiffré cinq fois) : rien de lisible
 * n'est écrit, même dans l'espace privé de l'application.
 */
export async function deposerDansDossier(colis: {
  contenu: string;
  empreinte: string;
  taille: number;
  classement?: string;
}): Promise<boolean> {
  const dossier = lireDossier();
  if (!dossier) return false;
  const index = lireIndex();
  if (index.some((c) => c.empreinte === colis.empreinte)) return true;

  const mois = new Date().toISOString().slice(0, 7);
  const fichier = `${mois}-${colis.empreinte.slice(0, 16)}.sam5`;
  let ecrit = false;

  if (dossier.support === "appareil") {
    const natif = await fichiers();
    if (natif) {
      try {
        await natif.Filesystem.writeFile({
          path: `${dossier.chemin}/${fichier}`,
          directory: natif.dossier as never,
          data: colis.contenu,
          encoding: "utf8" as never,
          recursive: true,
        });
        ecrit = true;
      } catch {
        ecrit = false;
      }
    }
  }

  if (!ecrit) {
    // Repli : le colis est conservé dans le stockage local, chiffré une
    // couche de plus par le coffre de l'appareil.
    try {
      window.localStorage.setItem(cleContenu(fichier), await chiffrerLocal(colis.contenu));
      ecrit = true;
    } catch {
      return false;
    }
  }

  const suivant: CopieLocale[] = [
    {
      empreinte: colis.empreinte,
      fichier,
      taille: colis.taille,
      creeLe: new Date().toISOString(),
      ...(colis.classement ? { classement: colis.classement } : {}),
    },
    ...index,
  ];
  const gardees = suivant.slice(0, MAX_COPIES);
  for (const trop of suivant.slice(MAX_COPIES)) await supprimerCopie(trop, dossier);
  return ecrireIndex(gardees);
}

/** Liste des copies présentes dans le dossier, de la plus récente à la plus ancienne. */
export function listerCopiesDossier(): CopieLocale[] {
  return lireIndex();
}

/** Relit le colis chiffré d'une copie du dossier (pour restauration). */
export async function lireCopieDossier(empreinte: string): Promise<string | null> {
  const dossier = lireDossier();
  if (!dossier) return null;
  const copie = lireIndex().find((c) => c.empreinte === empreinte);
  if (!copie) return null;

  if (dossier.support === "appareil") {
    const natif = await fichiers();
    if (natif) {
      try {
        const r = await natif.Filesystem.readFile({
          path: `${dossier.chemin}/${copie.fichier}`,
          directory: natif.dossier as never,
          encoding: "utf8" as never,
        });
        if (typeof r.data === "string") return r.data;
      } catch {
        /* on tente le repli local */
      }
    }
  }

  try {
    const brut = window.localStorage.getItem(cleContenu(copie.fichier));
    if (!brut) return null;
    return await dechiffrerLocal(brut);
  } catch {
    return null;
  }
}
