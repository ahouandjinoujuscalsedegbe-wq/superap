/**
 * Interprétation locale des réponses parlées lors d'une discussion vocale
 * guidée (l'application pose une question, l'utilisateur répond de vive voix).
 * 100 % hors ligne : aucun texte ne quitte l'appareil.
 */

import { nombreDepuisMots, sansAccents } from "@/lib/extraction";

/** Mots qui demandent de sauter la question en cours. */
export function estPassage(texte: string): boolean {
  const t = sansAccents(texte).trim();
  return /^(passe|passer|suivant|suivante|sauter|saute|rien|aucun|aucune|plus tard)\b/.test(t);
}

/** Mots qui demandent d'arrêter la discussion. */
export function estArret(texte: string): boolean {
  const t = sansAccents(texte).trim();
  return /^(stop|arrete|arreter|annule|annuler|termine|terminer|fini|c'est fini)\b/.test(t);
}

/** Mots qui demandent de répéter la question. */
export function estRepetition(texte: string): boolean {
  const t = sansAccents(texte).trim();
  return /^(repete|repeter|repetez|redis|pardon|quoi|comment)\b/.test(t);
}

/** Oui / non parlé. */
export function reponseOuiNon(texte: string): boolean | null {
  const t = sansAccents(texte).trim();
  if (/\b(oui|ouais|d'accord|daccord|bien sur|okay|ok|voila|exact|c'est ca)\b/.test(t)) return true;
  if (/\b(non|nan|pas du tout|jamais|surtout pas)\b/.test(t)) return false;
  return null;
}

/** Nombre parlé : « trente mille », « 30 000 francs », « 25 mille ». */
export function nombreParle(texte: string): number | null {
  const propre = sansAccents(texte);
  const regex = /\d[\d\s.]{0,12}\d|\d+/g;
  let m: RegExpExecArray | null;
  let meilleur: number | null = null;
  while ((m = regex.exec(propre))) {
    const brut = m[0].replace(/[\s.]/g, "");
    const valeur = Number(brut);
    if (!Number.isFinite(valeur) || valeur <= 0) continue;
    const suite = propre.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const multiplie = /^\s*(mille|milles)\b/.test(suite)
      ? valeur * 1000
      : /^\s*(million|millions)\b/.test(suite)
        ? valeur * 1_000_000
        : valeur;
    const arrondi = Math.round(multiplie);
    if (meilleur === null || arrondi > meilleur) meilleur = arrondi;
  }
  if (meilleur !== null) return meilleur;
  return nombreDepuisMots(propre);
}

/** Nettoie une réponse libre destinée à un champ texte (nom d'enveloppe…). */
export function texteParle(texte: string): string {
  return texte
    .replace(
      /^\s*(c'est|ca s'appelle|elle s'appelle|il s'appelle|le nom est|nom|appelle la|appelle le|je veux|mets|met)\s+/i,
      "",
    )
    .replace(/[.!?]+\s*$/, "")
    .trim();
}

export type OptionVocale = { valeur: string; label: string };

/** Choisit l'option la plus proche de ce qui a été dit (mots, ou « numéro 2 »). */
export function choixParle(texte: string, options: OptionVocale[]): string | null {
  const dit = sansAccents(texte).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!dit || options.length === 0) return null;

  // Réponse par position : « le premier », « numéro 3 », « 2 ».
  const positions: Record<string, number> = {
    premier: 1,
    premiere: 1,
    deuxieme: 2,
    second: 2,
    seconde: 2,
    troisieme: 3,
    quatrieme: 4,
    cinquieme: 5,
    sixieme: 6,
    septieme: 7,
    huitieme: 8,
    neuvieme: 9,
    dixieme: 10,
  };
  for (const [mot, rang] of Object.entries(positions)) {
    if (new RegExp(`\\b${mot}\\b`).test(dit) && options[rang - 1]) return options[rang - 1]!.valeur;
  }
  const numero = dit.match(/\b(?:numero|numiro|no)?\s*(\d{1,2})\b/);
  if (numero) {
    const rang = Number(numero[1]);
    if (options[rang - 1]) return options[rang - 1]!.valeur;
  }

  let meilleur: { valeur: string; score: number } | null = null;
  for (const option of options) {
    const cible = sansAccents(option.label).replace(/[^a-z0-9\s]/g, " ").trim();
    if (!cible) continue;
    let score = 0;
    if (dit === cible) score = 1000;
    else if (dit.includes(cible)) score = 500 + cible.length;
    else {
      const mots = cible.split(/\s+/).filter((m) => m.length > 2);
      const trouves = mots.filter((m) => dit.includes(m));
      if (mots.length > 0 && trouves.length > 0) {
        score = (trouves.length / mots.length) * 100 + trouves.join("").length;
      }
    }
    if (score > 0 && (!meilleur || score > meilleur.score)) {
      meilleur = { valeur: option.valeur, score };
    }
  }
  return meilleur && meilleur.score >= 20 ? meilleur.valeur : null;
}
