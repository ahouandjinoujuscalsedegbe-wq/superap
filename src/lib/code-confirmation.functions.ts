/**
 * Confirmation par e-mail d'un changement de mot de passe.
 *
 * Un code à 6 chiffres est créé sur le serveur et envoyé à l'adresse du compte.
 * Le code ne revient jamais au téléphone : seul un jeton signé est renvoyé, et
 * la vérification recalcule la signature côté serveur. Aucune donnée
 * budgétaire ne circule ici.
 */

import { createServerFn } from "@tanstack/react-start";

const SENDER_DOMAIN = "notify.superappbudget.com";
const FROM_DOMAIN = "superappbudget.com";
const DUREE_MS = 15 * 60 * 1000;

const adresseValide = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

async function signer(charge: string): Promise<string> {
  const secret = process.env["LOVABLE_API_KEY"] ?? "super-app-secours";
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(charge));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ResultatDemandeCode = {
  envoye: boolean;
  jeton?: string;
  message?: string;
};

/** Crée un code à 6 chiffres et l'envoie à l'adresse du compte. */
export const demanderCodeConfirmation = createServerFn({ method: "POST" })
  .validator((d: { email: string; appareil?: string }) => d)
  .handler(async ({ data }): Promise<ResultatDemandeCode> => {
    const email = (data.email || "").trim();
    if (!adresseValide(email)) {
      return { envoye: false, message: "Adresse e-mail invalide." };
    }
    if (!process.env["LOVABLE_API_KEY"]) {
      return { envoye: false, message: "L'envoi d'e-mails n'est pas encore configuré." };
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const expire = Date.now() + DUREE_MS;
    const signature = await signer(`${email}|${expire}|${code}`);
    const jeton = `${expire}.${signature}`;

    const texte = `SUPER APP — confirmation du changement de mot de passe

Votre code de confirmation est : ${code}

Entrez ce code dans l'application pour valider votre nouveau mot de passe.
Il est valable 15 minutes et ne fonctionne qu'une seule fois.

Si vous n'avez pas demandé ce changement, ignorez ce message : rien ne change.
`;
    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">
<h2>Confirmation du changement de mot de passe</h2>
<p>Votre code de confirmation :</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
<p>Il est valable 15 minutes et ne fonctionne qu'une seule fois.</p>
<p>Si vous n'avez pas demandé ce changement, ignorez ce message.</p>
</div>`;

    try {
      const { sendLovableEmail } = await import("@lovable.dev/email-js");
      const resultat = await sendLovableEmail(
        {
          to: email,
          from: `SUPER APP <securite@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `Code de confirmation : ${code}`,
          text: texte,
          html,
          purpose: "transactional",
          label: "code-mot-de-passe",
          idempotency_key: crypto.randomUUID(),
        },
        { apiKey: process.env["LOVABLE_API_KEY"]! },
      );
      if (resultat && (resultat as { suppressed?: boolean }).suppressed) {
        return {
          envoye: false,
          message: "Cette adresse est bloquée pour les envois : utilisez une autre adresse.",
        };
      }
      return { envoye: true, jeton };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return { envoye: false, message: err.code ?? err.message ?? "Envoi impossible." };
    }
  });

/** Vérifie le code saisi face au jeton signé. */
export const verifierCodeConfirmation = createServerFn({ method: "POST" })
  .validator((d: { email: string; code: string; jeton: string }) => d)
  .handler(async ({ data }): Promise<{ valide: boolean; message?: string }> => {
    const email = (data.email || "").trim();
    const code = (data.code || "").trim();
    const [expireBrut, signature] = (data.jeton || "").split(".");
    const expire = Number(expireBrut);
    if (!expire || !signature || !/^\d{6}$/.test(code)) {
      return { valide: false, message: "Code invalide." };
    }
    if (Date.now() > expire) {
      return { valide: false, message: "Ce code a expiré : demandez-en un nouveau." };
    }
    const attendue = await signer(`${email}|${expire}|${code}`);
    if (attendue.length !== signature.length) {
      return { valide: false, message: "Code incorrect." };
    }
    let ecart = 0;
    for (let i = 0; i < attendue.length; i += 1) {
      ecart |= attendue.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return ecart === 0 ? { valide: true } : { valide: false, message: "Code incorrect." };
  });
