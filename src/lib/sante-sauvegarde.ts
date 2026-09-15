/**
 * Santé de la sauvegarde par e-mail : permet d'avertir l'utilisateur AVANT une
 * perte de données, plutôt que de découvrir le problème le jour du changement
 * de téléphone.
 */

import { lireReglagesMail, type ReglagesMail } from "./sauvegarde-email";

export type NiveauSante = "ok" | "attention" | "alerte";

export type SanteSauvegarde = {
  niveau: NiveauSante;
  /** Jours écoulés depuis le dernier envoi réussi (null si aucun envoi). */
  jours: number | null;
  titre: string;
  message: string;
  /** Vrai si une action de l'utilisateur est nécessaire. */
  action: boolean;
};

/** Au-delà de ce délai sans envoi réussi, on alerte. */
export const SEUIL_ATTENTION_JOURS = 3;
export const SEUIL_ALERTE_JOURS = 7;
/** Au-delà de cette taille, la copie risque d'être refusée par la messagerie. */
export const TAILLE_MAX_OCTETS = 6_000_000;

export function joursDepuis(iso: string | undefined, maintenant = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.floor((maintenant.getTime() - d) / 86_400_000));
}

export function evaluerSante(r: ReglagesMail, maintenant = new Date()): SanteSauvegarde {
  if (!r.configure || !r.email) {
    return {
      niveau: "alerte",
      jours: null,
      titre: "Sauvegarde non configurée",
      message: "Indiquez votre adresse e-mail pour protéger vos données.",
      action: true,
    };
  }
  if (!r.actif) {
    return {
      niveau: "attention",
      jours: joursDepuis(r.dernierEnvoi, maintenant),
      titre: "Sauvegarde en pause",
      message: "Vos données ne partent plus vers votre e-mail. Réactivez-la.",
      action: true,
    };
  }
  const jours = joursDepuis(r.dernierEnvoi, maintenant);
  if (jours === null) {
    return {
      niveau: "alerte",
      jours: null,
      titre: "Aucune copie envoyée",
      message: "Aucune sauvegarde n'est encore arrivée dans votre boîte e-mail.",
      action: true,
    };
  }
  if ((r.derniereTaille ?? 0) > TAILLE_MAX_OCTETS) {
    return {
      niveau: "attention",
      jours,
      titre: "Copie très volumineuse",
      message: "Faites aussi un export sur votre ordinateur : la copie devient lourde.",
      action: true,
    };
  }
  if (jours >= SEUIL_ALERTE_JOURS) {
    return {
      niveau: "alerte",
      jours,
      titre: `Aucune sauvegarde depuis ${jours} jours`,
      message: "Vérifiez votre connexion et votre boîte e-mail (dossier spam compris).",
      action: true,
    };
  }
  if (jours >= SEUIL_ATTENTION_JOURS || r.dernierEchec) {
    return {
      niveau: "attention",
      jours,
      titre: `Dernière sauvegarde il y a ${jours} jour${jours > 1 ? "s" : ""}`,
      message: "Ouvrez la page Sauvegarde pour lancer une copie tout de suite.",
      action: true,
    };
  }
  return {
    niveau: "ok",
    jours,
    titre: "Sauvegarde à jour",
    message: jours === 0 ? "Une copie est partie aujourd'hui." : "Une copie est partie hier.",
    action: false,
  };
}

export function santeActuelle(maintenant = new Date()): SanteSauvegarde {
  return evaluerSante(lireReglagesMail(), maintenant);
}
