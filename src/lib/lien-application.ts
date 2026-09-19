/** Lien privé reçu depuis l'e-mail et transmis à l'application Android. */
export type LienApplication = { email: string; jeton: string };

export const EVENEMENT_LIEN_APPLICATION = "superapp:lien-changement";

let lienEnAttente: LienApplication | null = null;

/** Accepte uniquement le lien privé réservé au changement de mot de passe. */
export function recevoirLienApplication(urlBrute: string): boolean {
  try {
    const url = new URL(urlBrute);
    if (url.protocol !== "superappbudget:" || url.hostname !== "compte") return false;
    const email = url.searchParams.get("email")?.trim() ?? "";
    const jeton = url.searchParams.get("jeton") ?? "";
    if (!email || !jeton) return false;
    lienEnAttente = { email, jeton };
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<LienApplication>(EVENEMENT_LIEN_APPLICATION, {
          detail: lienEnAttente,
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}

/** Remet une seule fois le lien reçu à l'écran du compte. */
export function prendreLienApplication(): LienApplication | null {
  const lien = lienEnAttente;
  lienEnAttente = null;
  return lien;
}