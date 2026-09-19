/**
 * Sauvegarde intégrale : tout ce que l'utilisateur écrit dans l'application
 * ne vit pas seulement dans l'état principal (comptes, opérations…). Des
 * réglages, listes, notes, mots appris et historiques de saisie sont rangés
 * à part sur l'appareil. Ce module les rassemble tous pour qu'aucun détail
 * ne manque dans la copie chiffrée, et sait les remettre en place.
 */

/** Emplacements exclus : secrets, copies chiffrées et technique de mise à jour. */
const EXCLUS = [
  "superapp:pin",
  "superapp:coffre:secret:v1",
  "superapp:coffre:secret:protege:v1",
  "superapp-coffre-local-v1",
  "superapp:etat",
  "superapp:etat:v1",
  "superapp:sauvegarde-mail:phrase:v1",
  "superapp:sauvegarde-mail:file:v1",
  "superapp:sauvegarde-mail:versions:v1",
  "superapp:sauvegarde-avant-maj:v1",
  "superapp:securite:pin-jour",
  "superapp:securite:activite",
  "superapp:securite:actions-ouvertes",
  "superapp:maj:derniere",
  "superapp:maj:ignoree",
  "superapp:maj:tentative",
  "superapp:maj:token",
  "superapp:maj:url",
];

/** Un réglage démesuré ne doit pas faire gonfler la copie e-mail. */
const TAILLE_MAX_VALEUR = 400_000;

function pertinent(cle: string): boolean {
  if (EXCLUS.includes(cle)) return false;
  return cle.startsWith("superapp") || cle.startsWith("SA_") || cle.startsWith("sa:");
}

/** Rassemble tous les réglages et listes personnelles de l'appareil. */
export function collecterReglages(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const sortie: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const cle = localStorage.key(i);
    if (!cle || !pertinent(cle)) continue;
    const valeur = localStorage.getItem(cle);
    if (valeur === null || valeur.length > TAILLE_MAX_VALEUR) continue;
    sortie[cle] = valeur;
  }
  return sortie;
}

/** Remet en place les réglages d'une copie restaurée. */
export function appliquerReglages(reglages: unknown): void {
  if (typeof localStorage === "undefined") return;
  if (!reglages || typeof reglages !== "object") return;
  for (const [cle, valeur] of Object.entries(reglages as Record<string, unknown>)) {
    if (typeof valeur !== "string" || !pertinent(cle)) continue;
    try {
      localStorage.setItem(cle, valeur);
    } catch {
      // Espace saturé : le reste des réglages est tout de même restauré.
    }
  }
}
