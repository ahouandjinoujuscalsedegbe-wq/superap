/**
 * Coffre de versions : l'adresse e-mail sert de stockage principal, et
 * l'appareil garde un catalogue des dernières copies chiffrées datées.
 *
 * Chaque sauvegarde n'écrase plus la précédente : les copies s'empilent par
 * date, ce qui permet de revenir à un jour précis (erreur de saisie,
 * suppression accidentelle) et non seulement à la copie la plus récente.
 * Les copies conservées ici sont déjà chiffrées cinq fois : sans la phrase de
 * récupération, elles restent illisibles même sur l'appareil.
 */

import { dechiffrerCinqFois, type ColisEnAttente } from "./sauvegarde-email";

export const CLE_VERSIONS = "superapp:sauvegarde-mail:versions:v1";

/** Nombre maximum de copies datées conservées sur l'appareil. */
export const VERSIONS_MAX = 10;
/** Budget total de stockage local des copies (octets de texte chiffré). */
export const VERSIONS_BUDGET_OCTETS = 8_000_000;

export type VersionSauvegarde = {
  id: string;
  creeLe: string;
  empreinte: string;
  contenu: string;
  taille: number;
  appareil: string;
  /** Vrai lorsque la copie est bien partie vers l'e-mail. */
  envoyee: boolean;
  /** Rangement de la copie : « SUPER APP / 2026-09 / DÉPENSES / « Marché » ». */
  classement?: string;
};

export function lireVersions(): VersionSauvegarde[] {
  try {
    const brut = window.localStorage.getItem(CLE_VERSIONS);
    const liste = brut ? (JSON.parse(brut) as VersionSauvegarde[]) : [];
    if (!Array.isArray(liste)) return [];
    return liste.filter((v) => v && typeof v.contenu === "string");
  } catch {
    return [];
  }
}

function ecrireVersions(liste: VersionSauvegarde[]) {
  try {
    window.localStorage.setItem(CLE_VERSIONS, JSON.stringify(liste));
  } catch {
    /* stockage saturé ou indisponible */
  }
}

/** Nettoyage : les copies les plus anciennes partent d'abord. */
export function nettoyerVersions(liste: VersionSauvegarde[]): VersionSauvegarde[] {
  const triees = [...liste].sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(0, VERSIONS_MAX);
  const gardees: VersionSauvegarde[] = [];
  let total = 0;
  for (const v of triees) {
    if (gardees.length > 0 && total + v.taille > VERSIONS_BUDGET_OCTETS) break;
    gardees.push(v);
    total += v.taille;
  }
  return gardees;
}

/**
 * Ajoute une copie datée. Une copie identique (même empreinte) n'est pas
 * dupliquée : seule sa date et son état d'envoi sont mis à jour.
 */
export function ajouterVersion(
  colis: ColisEnAttente,
  appareil: string,
  envoyee: boolean,
  classement?: string,
): VersionSauvegarde[] {
  const existantes = lireVersions();
  const deja = existantes.find((v) => v.empreinte === colis.empreinte);
  const suivant = deja
    ? existantes.map((v) =>
        v.empreinte === colis.empreinte
          ? {
              ...v,
              creeLe: colis.creeLe,
              envoyee: v.envoyee || envoyee,
              ...(classement ? { classement } : {}),
            }
          : v,
      )
    : [
        {
          id: colis.id,
          creeLe: colis.creeLe,
          empreinte: colis.empreinte,
          contenu: colis.contenu,
          taille: colis.taille,
          appareil,
          envoyee,
          ...(classement ? { classement } : {}),
        },
        ...existantes,
      ];
  const propre = nettoyerVersions(suivant);
  ecrireVersions(propre);
  return propre;
}

/** Marque comme envoyée la copie correspondant à une empreinte. */
export function marquerVersionEnvoyee(empreinte: string): VersionSauvegarde[] {
  const suivant = lireVersions().map((v) => (v.empreinte === empreinte ? { ...v, envoyee: true } : v));
  ecrireVersions(suivant);
  return suivant;
}

export function supprimerVersion(id: string): VersionSauvegarde[] {
  const suivant = lireVersions().filter((v) => v.id !== id);
  ecrireVersions(suivant);
  return suivant;
}

export function viderVersions() {
  ecrireVersions([]);
}

/** Ouvre une copie datée avec la phrase de récupération. */
export async function ouvrirVersion<T>(version: VersionSauvegarde, phrase: string): Promise<T> {
  const texte = await dechiffrerCinqFois(version.contenu, phrase);
  return JSON.parse(texte) as T;
}

/** Ouvre un colis collé depuis la boîte e-mail (copie d'une date précise). */
export async function ouvrirColisColle<T>(colis: string, phrase: string): Promise<T> {
  const texte = await dechiffrerCinqFois(colis, phrase);
  return JSON.parse(texte) as T;
}

export function tailleTotaleVersions(liste = lireVersions()): number {
  return liste.reduce((s, v) => s + v.taille, 0);
}
