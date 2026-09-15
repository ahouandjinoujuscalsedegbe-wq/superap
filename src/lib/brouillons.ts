/**
 * Brouillons de saisie : chaque lettre, chaque virgule tapée dans un champ
 * est conservée sur l'appareil avant même la validation du formulaire. Ainsi
 * une saisie interrompue (téléphone éteint, application fermée, mise à jour)
 * se retrouve dans la copie chiffrée envoyée au coffre e-mail.
 */

export const CLE_BROUILLONS = "superapp:brouillons:v1";
/** Nombre de champs conservés (les plus récents). */
const MAX_CHAMPS = 200;
/** Longueur maximale conservée par champ. */
const MAX_LONGUEUR = 2_000;
/** Événement interne : une frappe a été mémorisée. */
export const EVENEMENT_BROUILLON = "superapp:brouillon";

export type Brouillon = { valeur: string; le: string };

/** Champs jamais mémorisés : mots de passe, codes, phrases secrètes. */
function sensible(el: HTMLElement): boolean {
  const type = (el as HTMLInputElement).type ?? "";
  if (type === "password") return true;
  const indices = `${el.getAttribute("name") ?? ""} ${el.id} ${el.getAttribute("aria-label") ?? ""} ${
    (el as HTMLInputElement).placeholder ?? ""
  }`.toLowerCase();
  return /pass|mot de passe|code|pin|phrase|secret/.test(indices);
}

/** Identifiant stable d'un champ : page + repère du champ. */
function reperer(el: HTMLElement): string {
  const chemin = typeof location !== "undefined" ? location.pathname : "/";
  const repere =
    el.getAttribute("name") ||
    el.id ||
    el.getAttribute("aria-label") ||
    (el as HTMLInputElement).placeholder ||
    el.tagName.toLowerCase();
  return `${chemin}#${repere}`;
}

export function lireBrouillons(): Record<string, Brouillon> {
  if (typeof localStorage === "undefined") return {};
  try {
    const brut = localStorage.getItem(CLE_BROUILLONS);
    if (!brut) return {};
    const lu = JSON.parse(brut) as Record<string, Brouillon>;
    return lu && typeof lu === "object" ? lu : {};
  } catch {
    return {};
  }
}

function ecrireBrouillons(tout: Record<string, Brouillon>): void {
  const entrees = Object.entries(tout)
    .sort((a, b) => b[1].le.localeCompare(a[1].le))
    .slice(0, MAX_CHAMPS);
  try {
    localStorage.setItem(CLE_BROUILLONS, JSON.stringify(Object.fromEntries(entrees)));
  } catch {
    // Espace saturé : la sauvegarde principale reste prioritaire.
  }
}

/** Mémorise la valeur d'un champ en cours de saisie. */
export function noterBrouillon(cle: string, valeur: string): void {
  const tout = lireBrouillons();
  const propre = valeur.slice(0, MAX_LONGUEUR);
  if (propre.length === 0) {
    if (!(cle in tout)) return;
    delete tout[cle];
  } else {
    if (tout[cle]?.valeur === propre) return;
    tout[cle] = { valeur: propre, le: new Date().toISOString() };
  }
  ecrireBrouillons(tout);
  window.dispatchEvent(new Event(EVENEMENT_BROUILLON));
}

/** Oublie les brouillons d'une page (formulaire validé ou abandonné). */
export function oublierBrouillonsDe(chemin: string): void {
  const tout = lireBrouillons();
  let change = false;
  for (const cle of Object.keys(tout)) {
    if (cle.startsWith(`${chemin}#`)) {
      delete tout[cle];
      change = true;
    }
  }
  if (change) ecrireBrouillons(tout);
}

/**
 * Écoute toutes les saisies de l'application. Renvoie la fonction d'arrêt.
 */
export function suivreSaisies(): () => void {
  const surSaisie = (e: Event) => {
    const cible = e.target as HTMLElement | null;
    if (!cible) return;
    const balise = cible.tagName;
    const editable = cible.isContentEditable;
    if (!editable && balise !== "INPUT" && balise !== "TEXTAREA" && balise !== "SELECT") return;
    if (sensible(cible)) return;
    const valeur = editable
      ? (cible.textContent ?? "")
      : ((cible as HTMLInputElement).value ?? "");
    noterBrouillon(reperer(cible), valeur);
  };
  document.addEventListener("input", surSaisie, true);
  document.addEventListener("change", surSaisie, true);
  return () => {
    document.removeEventListener("input", surSaisie, true);
    document.removeEventListener("change", surSaisie, true);
  };
}
