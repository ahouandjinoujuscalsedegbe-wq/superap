/**
 * Logique serveur partagée du lien de changement de mot de passe.
 *
 * Utilisée à la fois par la fonction serveur (navigateur) et par la route
 * HTTP publique (application Android installée, qui appelle depuis la
 * WebView sur une autre origine).
 */

const SENDER_DOMAIN = "notify.superappbudget.com";
const FROM_DOMAIN = "superappbudget.com";
export const DUREE_LIEN_MS = 15 * 60 * 1000;

const LIEN_APPLICATION = "superappbudget://compte";

export const adresseValide = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export async function signerLien(charge: string): Promise<string> {
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

export type ResultatDemandeLien = {
  envoye: boolean;
  message?: string;
};

/** Construit le jeton signé et envoie l'e-mail contenant le lien unique. */
export async function envoyerLienChangement(emailBrut: string): Promise<ResultatDemandeLien> {
  const email = (emailBrut || "").trim();
  if (!adresseValide(email)) {
    return { envoye: false, message: "Adresse e-mail invalide." };
  }
  if (!process.env["LOVABLE_API_KEY"]) {
    return { envoye: false, message: "L'envoi d'e-mails n'est pas encore configuré." };
  }

  const expire = Date.now() + DUREE_LIEN_MS;
  const signature = await signerLien(`${email}|${expire}`);
  const jeton = `${expire}.${signature}`;
  const lien =
    `${LIEN_APPLICATION}?email=${encodeURIComponent(email)}` +
    `&jeton=${encodeURIComponent(jeton)}`;

  const texte = `SUPER APP — changement de mot de passe

Vous avez demandé à changer le mot de passe de votre compte.

Pour choisir votre nouveau mot de passe, ouvrez ce lien sur le téléphone
Android où SUPER APP est installée et qui contient vos données :

${lien}

Ce lien est valable 15 minutes.

Si vous n'avez pas demandé ce changement, ignorez ce message : rien ne change.
`;
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1f2937">
<h2 style="margin:0 0 12px">Changement de mot de passe</h2>
<p>Vous avez demandé à changer le mot de passe de votre compte SUPER APP.</p>
<p>Pour choisir votre nouveau mot de passe, touchez ce bouton sur le téléphone Android où <strong>SUPER APP est installée et contient vos données</strong>. L'application s'ouvrira directement :</p>
<p style="margin:20px 0">
  <a href="${lien}" style="background:#0f766e;color:#ffffff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700">
    Changer mon mot de passe
  </a>
</p>
<p style="font-size:13px;color:#6b7280">Ce lien est valable 15 minutes.</p>
<p style="font-size:13px;color:#6b7280">Si vous n'avez pas demandé ce changement, ignorez ce message : rien ne change.</p>
</div>`;

  try {
    const { sendLovableEmail } = await import("@lovable.dev/email-js");
    const resultat = await sendLovableEmail(
      {
        to: email,
        from: `SUPER APP <securite@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: "Changement de mot de passe — lien de confirmation",
        text: texte,
        html,
        purpose: "transactional",
        label: "lien-mot-de-passe",
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
    return { envoye: true };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { envoye: false, message: err.code ?? err.message ?? "Envoi impossible." };
  }
}

/** Vérifie le jeton porté par le lien reçu par e-mail. */
export async function verifierJetonLien(
  emailBrut: string,
  jetonBrut: string,
): Promise<{ valide: boolean; message?: string }> {
  const email = (emailBrut || "").trim();
  const [expireBrut, signature] = (jetonBrut || "").split(".");
  const expire = Number(expireBrut);
  if (!expire || !signature) {
    return { valide: false, message: "Lien invalide." };
  }
  if (Date.now() > expire) {
    return {
      valide: false,
      message: "Ce lien a expiré : recommencez la demande pour recevoir un nouveau lien.",
    };
  }
  const attendue = await signerLien(`${email}|${expire}`);
  if (attendue.length !== signature.length) {
    return { valide: false, message: "Lien invalide." };
  }
  let ecart = 0;
  for (let i = 0; i < attendue.length; i += 1) {
    ecart |= attendue.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return ecart === 0 ? { valide: true } : { valide: false, message: "Lien invalide." };
}
