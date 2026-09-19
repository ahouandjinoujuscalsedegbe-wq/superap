/**
 * Confirmation par e-mail d'un changement de mot de passe.
 *
 * Le serveur signe un jeton (adresse + expiration, HMAC) et envoie à
 * l'adresse du compte un e-mail contenant un lien unique vers l'application.
 * C'est depuis ce lien — et seulement depuis ce lien — que l'utilisateur peut
 * choisir son nouveau mot de passe. Le jeton ne contient aucune donnée
 * budgétaire et aucun mot de passe.
 *
 * La logique est partagée avec la route HTTP publique
 * /api/public/compte/lien, utilisée par l'application Android installée.
 */

import { createServerFn } from "@tanstack/react-start";

import {
  envoyerLienChangement,
  verifierCodeConfirmation,
  verifierJetonLien,
} from "./code-confirmation.server";

export type { ResultatDemandeLien } from "./code-confirmation.server";

/** Envoie à l'adresse du compte un e-mail contenant le lien de changement. */
export const demanderLienChangement = createServerFn({ method: "POST" })
  .validator((d: { email: string; appareil?: string }) => d)
  .handler(async ({ data }) => envoyerLienChangement(data.email));

/** Vérifie le jeton porté par le lien reçu par e-mail. */
export const verifierLienChangement = createServerFn({ method: "POST" })
  .validator((d: { email: string; jeton: string }) => d)
  .handler(async ({ data }) => verifierJetonLien(data.email, data.jeton));

/** Vérifie le code à six chiffres recopié depuis l'e-mail. */
export const verifierCodeChangement = createServerFn({ method: "POST" })
  .validator((d: { email: string; code: string }) => d)
  .handler(async ({ data }) => verifierCodeConfirmation(data.email, data.code));
