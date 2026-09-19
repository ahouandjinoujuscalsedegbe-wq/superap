/**
 * Compte utilisateur = adresse e-mail + mot de passe.
 *
 * L'adresse e-mail identifie l'espace chiffré du compte ; le mot de passe sert
 * de clé (il joue exactement le rôle de l'ancienne phrase de récupération).
 * Ni l'adresse ni le mot de passe ne quittent le téléphone : seule une
 * empreinte dérivée sert à retrouver les copies chiffrées.
 */

import type { Etat } from "@/lib/store";
import {
  dechiffrerCinqFois,
  ecrireReglagesMail,
  enregistrerPhrase,
  estEmailValide,
  lirePhrase,
  lireReglagesMail,
  preparerColis,
} from "@/lib/sauvegarde-email";
import { chercherCopiesDuCompte, deposerDansCloud } from "@/lib/coffre-cloud";

export { estEmailValide };

/** Un compte est déjà connecté sur ce téléphone. */
export function compteConnecte(): boolean {
  const r = lireReglagesMail();
  return Boolean(r.configure && r.email && estEmailValide(r.email));
}

export function emailDuCompte(): string {
  return lireReglagesMail().email || "";
}

/** Enregistre le compte sur ce téléphone (adresse + mot de passe). */
export async function memoriserCompte(email: string, motDePasse: string) {
  await enregistrerPhrase(motDePasse);
  ecrireReglagesMail({
    ...lireReglagesMail(),
    email: email.trim(),
    configure: true,
    actif: true,
  });
}

/**
 * Déconnexion : ce téléphone oublie l'adresse e-mail et le mot de passe du
 * compte. Les données déjà présentes ne sont pas touchées ; les copies
 * chiffrées restent dans l'espace du compte.
 */
export async function deconnecterCompte() {
  await enregistrerPhrase("");
  ecrireReglagesMail({
    ...lireReglagesMail(),
    email: "",
    configure: false,
    actif: false,
  });
}

export function motDePasseValide(mdp: string): boolean {
  return mdp.trim().length >= 8;
}

export type ResultatConnexion =
  | { etat: "trouve"; donnees: Partial<Etat>; motDePasse: string }
  | { etat: "vide" }
  | { etat: "erreur"; message: string };

/** Cherche les données du compte dans l'espace chiffré de l'adresse e-mail. */
export async function chercherDonneesCompte(
  email: string,
  motDePasse: string,
): Promise<ResultatConnexion> {
  let trouvees: Awaited<ReturnType<typeof chercherCopiesDuCompte>>;
  try {
    trouvees = await chercherCopiesDuCompte(email.trim(), motDePasse.trim());
  } catch {
    return { etat: "erreur", message: "Connexion impossible : vérifiez votre réseau." };
  }
  const derniere = trouvees.copies[0];
  if (!derniere) return { etat: "vide" };
  try {
    const brut = await dechiffrerCinqFois(derniere.contenu, trouvees.phrase);
    const donnees = JSON.parse(brut) as Partial<Etat>;
    if (!donnees || !Array.isArray(donnees.transactions)) {
      return { etat: "erreur", message: "La copie trouvée est illisible." };
    }
    return { etat: "trouve", donnees, motDePasse: trouvees.phrase };
  } catch {
    return {
      etat: "erreur",
      message: "Mot de passe incorrect pour ce compte : vos données restent protégées.",
    };
  }
}

/**
 * Change le mot de passe du compte : le nouveau mot de passe devient la clé
 * et une copie complète des données présentes sur ce téléphone est aussitôt
 * redéposée, chiffrée avec ce nouveau mot de passe. L'adresse e-mail ne
 * change pas ; les copies futures utiliseront le nouveau mot de passe.
 *
 * Important : les anciennes copies chiffrées avec l'ancien mot de passe ne
 * peuvent pas être réécrites (le chiffrement est irréversible sans la clé).
 * Ce changement n'est donc possible que si ce téléphone contient encore les
 * données — sinon personne ne peut les récupérer sans le mot de passe.
 */
export async function changerMotDePasse(
  etat: unknown,
  nouveauMotDePasse: string,
  appareil: string,
): Promise<{ ok: boolean; copieDeposee: boolean }> {
  const email = emailDuCompte();
  if (!email || !motDePasseValide(nouveauMotDePasse)) {
    return { ok: false, copieDeposee: false };
  }
  await memoriserCompte(email, nouveauMotDePasse);
  let copieDeposee = false;
  try {
    const colis = await preparerColis(etat, nouveauMotDePasse.trim());
    copieDeposee = await deposerDansCloud(email, nouveauMotDePasse.trim(), appareil || "MON TÉLÉPHONE", {
      contenu: colis.contenu,
      empreinte: colis.empreinte,
      taille: colis.taille,
    });
  } catch {
    copieDeposee = false;
  }
  return { ok: true, copieDeposee };
}

/** Dépose tout de suite une première copie chiffrée dans l'espace du compte. */
export async function deposerPremiereCopie(etat: unknown, appareil: string): Promise<boolean> {
  const email = emailDuCompte();
  const secret = (await lirePhrase()) || "";
  if (!email || !secret) return false;
  try {
    const colis = await preparerColis(etat, secret);
    return await deposerDansCloud(email, secret, appareil || "MON TÉLÉPHONE", {
      contenu: colis.contenu,
      empreinte: colis.empreinte,
      taille: colis.taille,
    });
  } catch {
    return false;
  }
}
