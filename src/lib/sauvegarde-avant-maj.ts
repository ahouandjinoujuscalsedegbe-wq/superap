/**
 * Filet de sécurité avant une mise à jour.
 *
 * Pourquoi : une mise à jour installée par-dessus l'application conserve
 * normalement les données. Mais si Android doit remplacer l'ancienne version
 * (signature différente, refus de l'installateur, désinstallation manuelle),
 * tout le dossier privé de l'application disparaît — donc les données locales
 * aussi. Avant de lancer l'installateur, on envoie donc une copie CHIFFRÉE par
 * e-mail.
 *
 * Choix volontaire : AUCUN fichier n'est écrit dans les Documents ou la
 * mémoire partagée du téléphone. Un fichier visible pourrait être copié par
 * une autre application ou par une personne malveillante ayant le téléphone
 * en main. La seule copie qui sort de l'application part chiffrée par e-mail.
 */

import {
  ecrireFile,
  ecrireReglagesMail,
  lirePhrase,
  lireReglagesMail,
  preparerColis,
} from "./sauvegarde-email";
import { envoyerColisSauvegarde } from "./sauvegarde-email.functions";
import { ajouterVersion, lireVersions } from "./versions-sauvegarde";

const DOSSIER = "SUPER-APP-SAUVEGARDES";
export const CLE_DERNIERE_PROTECTION = "superapp:sauvegarde-avant-maj:v1";

export type ResultatProtection = {
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

/**
 * Efface les anciens fichiers de secours qu'une version précédente avait pu
 * écrire dans les dossiers visibles du téléphone : ils ne doivent plus exister.
 */
export async function effacerAnciennesCopiesTelephone(): Promise<void> {
  if (!estNatif()) return;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    for (const dossier of [Directory.Documents, Directory.External]) {
      await Filesystem.rmdir({ path: DOSSIER, directory: dossier, recursive: true }).catch(
        () => undefined,
      );
    }
  } catch {
    /* rien à effacer */
  }
}

/**
 * Prépare et met à l'abri une copie chiffrée de toutes les données avant
 * l'installation d'une nouvelle version. La copie part uniquement par e-mail.
 */
export async function protegerAvantMiseAJour(instantane: unknown): Promise<ResultatProtection> {
  const avertissements: string[] = [];
  await effacerAnciennesCopiesTelephone();

  const phrase = await lirePhrase();
  if (!phrase) {
    return {
      email: "non-configure",
      avertissements: [
        "Aucune phrase de récupération n'est enregistrée : la copie de secours n'a pas pu être créée. Configurez la sauvegarde dans la page Sauvegarde.",
      ],
    };
  }

  const colis = await preparerColis(instantane, phrase);
  const reglages = lireReglagesMail();
  let email: ResultatProtection["email"] = "non-configure";
  // Sauvegarde silencieuse dans le coffre de versions de l'appareil : aucun
  // e-mail n'est envoyé quand tout se passe bien.
  let locale = true;
  try {
    ecrireFile(colis);
    ajouterVersion(colis, reglages.appareil, false);
    locale = lireVersions().some((v) => v.empreinte === colis.empreinte);
  } catch {
    locale = false;
  }
  if (locale) {
    ecrireReglagesMail({ ...reglages, derniereEmpreinte: colis.empreinte });
  } else if (reglages.email) {
    // Filet de sécurité : la copie ne tient pas sur l'appareil, elle part donc
    // par e-mail et l'utilisateur en est averti.
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
          "La copie n'a pas pu être gardée sur l'appareil et l'envoi par e-mail n'a pas abouti : elle repartira dès que possible.",
        );
      }
    } catch {
      avertissements.push(
        "La copie n'a pas pu être gardée sur l'appareil et l'envoi par e-mail est impossible pour l'instant (pas de connexion).",
      );
    }
  } else {
    avertissements.push(
      "La copie n'a pas pu être gardée sur l'appareil et aucune adresse e-mail de secours n'est enregistrée.",
    );
  }

  try {
    window.localStorage.setItem(
      CLE_DERNIERE_PROTECTION,
      JSON.stringify({ le: new Date().toISOString(), email }),
    );
  } catch {
    /* stockage indisponible */
  }

  return { email, avertissements };
}
