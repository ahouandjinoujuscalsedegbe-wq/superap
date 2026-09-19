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
