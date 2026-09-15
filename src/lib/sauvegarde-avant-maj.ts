/**
 * Filet de sécurité avant une mise à jour.
 *
 * Pourquoi : une mise à jour installée par-dessus l'application conserve
 * normalement les données. Mais si Android doit désinstaller l'ancienne
 * version (signature différente, refus de l'installateur, désinstallation
 * manuelle), tout le dossier privé de l'application disparaît — donc les
 * données locales aussi. Avant de lancer l'installateur, on écrit donc une
 * copie CHIFFRÉE dans le dossier « Documents » du téléphone, qui survit à une
 * réinstallation, et on envoie la même copie par e-mail.
 */

import {
  chiffrerCinqFois,
  dechiffrerCinqFois,
  ecrireFile,
  ecrireReglagesMail,
  lirePhrase,
  lireReglagesMail,
  preparerColis,
} from "./sauvegarde-email";
import { envoyerColisSauvegarde } from "./sauvegarde-email.functions";

const DOSSIER = "SUPER-APP-SAUVEGARDES";
export const CLE_DERNIERE_PROTECTION = "superapp:sauvegarde-avant-maj:v1";

export type ResultatProtection = {
  /** Chemin du fichier écrit sur le téléphone, si l'écriture a réussi. */
  fichier: string | null;
  /** État de l'envoi par e-mail. */
  email: "envoye" | "en-attente" | "non-configure";
  /** Messages d'avertissement destinés à l'utilisateur. */
  avertissements: string[];
};

function estNatif(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function horodatage(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Écrit le colis chiffré dans un dossier du téléphone qui survit à une réinstallation. */
async function ecrireFichierTelephone(contenu: string): Promise<string | null> {
  if (!estNatif()) return null;
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const nom = `${DOSSIER}/sauvegarde-${horodatage()}.sam5`;
    for (const dossier of [Directory.Documents, Directory.External]) {
      try {
        await Filesystem.mkdir({ path: DOSSIER, directory: dossier, recursive: true }).catch(
          () => undefined,
        );
        await Filesystem.writeFile({
          path: nom,
          directory: dossier,
          data: contenu,
          encoding: Encoding.UTF8,
          recursive: true,
        });
        const uri = await Filesystem.getUri({ path: nom, directory: dossier });
        return uri.uri;
      } catch {
        /* dossier refusé : on tente le suivant */
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Prépare et met à l'abri une copie chiffrée de toutes les données avant
 * l'installation d'une nouvelle version.
 */
export async function protegerAvantMiseAJour(instantane: unknown): Promise<ResultatProtection> {
  const avertissements: string[] = [];
  const phrase = await lirePhrase();
  if (!phrase) {
    return {
      fichier: null,
      email: "non-configure",
      avertissements: [
        "Aucune phrase de récupération n'est enregistrée : la copie de secours n'a pas pu être créée. Configurez la sauvegarde dans la page Sauvegarde.",
      ],
    };
  }

  const colis = await preparerColis(instantane, phrase);
  const fichier = await ecrireFichierTelephone(colis.contenu);
  if (!fichier) {
    avertissements.push(
      "La copie n'a pas pu être écrite dans les Documents du téléphone (autorisation refusée).",
    );
  }

  const reglages = lireReglagesMail();
  let email: ResultatProtection["email"] = "non-configure";
  if (reglages.email) {
    ecrireFile(colis);
    email = "en-attente";
    try {
      const resultat = await envoyerColisSauvegarde({
        data: {
          email: reglages.email,
          appareil: reglages.appareil,
          colis: colis.contenu,
          creeLe: new Date(colis.creeLe).toLocaleString("fr-FR"),
        },
      });
      if (resultat.envoye) {
        ecrireFile(null);
        email = "envoye";
        ecrireReglagesMail({
          ...reglages,
          dernierEnvoi: new Date().toISOString(),
          derniereEmpreinte: colis.empreinte,
        });
      } else {
        avertissements.push(
          "L'envoi par e-mail n'a pas abouti : la copie repartira dès que possible.",
        );
      }
    } catch {
      avertissements.push("Envoi par e-mail impossible pour l'instant (pas de connexion).");
    }
  } else {
    avertissements.push(
      "Aucune adresse e-mail de sauvegarde enregistrée : la copie n'a pas été envoyée.",
    );
  }

  try {
    window.localStorage.setItem(
      CLE_DERNIERE_PROTECTION,
      JSON.stringify({ le: new Date().toISOString(), fichier, email }),
    );
  } catch {
    /* stockage indisponible */
  }

  return { fichier, email, avertissements };
}

export type CopieTrouvee = { chemin: string; contenu: string; date: string };

/** Cherche la copie de secours la plus récente dans les dossiers du téléphone. */
export async function chercherCopieTelephone(): Promise<CopieTrouvee | null> {
  if (!estNatif()) return null;
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    for (const dossier of [Directory.Documents, Directory.External]) {
      try {
        const liste = await Filesystem.readdir({ path: DOSSIER, directory: dossier });
        const fichiers = liste.files
          .filter((f) => f.name.endsWith(".sam5"))
          .sort((a, b) => b.name.localeCompare(a.name));
        const premier = fichiers[0];
        if (!premier) continue;
        const lu = await Filesystem.readFile({
          path: `${DOSSIER}/${premier.name}`,
          directory: dossier,
          encoding: Encoding.UTF8,
        });
        const contenu = typeof lu.data === "string" ? lu.data : "";
        if (!contenu.includes("SAM5:")) continue;
        return {
          chemin: premier.name,
          contenu: contenu.slice(contenu.indexOf("SAM5:")),
          date: premier.name.replace(/^sauvegarde-|\.sam5$/g, ""),
        };
      } catch {
        /* dossier absent : on tente le suivant */
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Déchiffre une copie trouvée sur le téléphone avec la phrase de récupération. */
export async function ouvrirCopieTelephone(contenu: string, phrase: string): Promise<unknown> {
  const brut = await dechiffrerCinqFois(contenu.replace(/\s+/g, ""), phrase.trim());
  return JSON.parse(brut) as unknown;
}

/** Rechiffre un contenu (utilitaire de test). */
export async function chiffrerPourFichier(texte: string, phrase: string): Promise<string> {
  return chiffrerCinqFois(texte, phrase);
}
