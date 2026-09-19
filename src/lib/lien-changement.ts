/**
 * Demande et vérification du lien de changement de mot de passe, utilisables
 * partout : dans le navigateur on passe par la fonction serveur ; dans
 * l'application Android installée (WebView, autre origine) on appelle la
 * route HTTP publique équivalente sur le serveur public.
 */

import { RELAIS_MAJ } from "@/lib/version";
import {
  demanderLienChangement,
  verifierLienChangement,
} from "@/lib/code-confirmation.functions";

function estEmbarquee(): boolean {
  if (typeof window === "undefined") return false;
  const pont = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !window.location.protocol.startsWith("http") || pont?.isNativePlatform?.() === true;
}

async function appelerHttp(corps: Record<string, unknown>): Promise<{ ok: boolean; message?: string } | null> {
  try {
    const reponse = await fetch(`${RELAIS_MAJ}/api/public/compte/lien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    if (!reponse.ok) {
      const texte = await reponse.text().catch(() => "");
      let message = "";
      try {
        message = String(JSON.parse(texte).message ?? "");
      } catch {
        message = "";
      }
      return { ok: false, message: message || "Envoi impossible pour le moment." };
    }
    return (await reponse.json()) as { ok: boolean; message?: string };
  } catch {
    return null;
  }
}

export type ResultatLien = { envoye: boolean; message?: string | undefined };

/** Envoie à l'adresse du compte l'e-mail contenant le lien de changement. */
export async function demanderLien(email: string): Promise<ResultatLien> {
  if (estEmbarquee()) {
    const r = await appelerHttp({ action: "demander", email });
    if (r === null) return { envoye: false, message: "Connexion impossible : vérifiez votre réseau." };
    return { envoye: r.ok, message: r.message };
  }
  try {
    const r = await demanderLienChangement({ data: { email } });
    return { envoye: r.envoye, message: r.message };
  } catch {
    return { envoye: false, message: "Connexion impossible : vérifiez votre réseau." };
  }
}

/** Vérifie le jeton porté par le lien reçu par e-mail. */
export async function verifierLien(email: string, jeton: string): Promise<{ valide: boolean; message?: string | undefined }> {
  if (estEmbarquee()) {
    const r = await appelerHttp({ action: "verifier", email, jeton });
    if (r === null) return { valide: false, message: "Connexion impossible : vérifiez votre réseau." };
    return { valide: r.ok, message: r.message };
  }
  try {
    const r = await verifierLienChangement({ data: { email, jeton } });
    return { valide: r.valide, message: r.message };
  } catch {
    return { valide: false, message: "Connexion impossible : vérifiez votre réseau." };
  }
}
