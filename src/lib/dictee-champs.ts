/**
 * Analyse locale (100 % hors ligne) de phrases dictées pour remplir
 * automatiquement des formulaires : enveloppe budgétaire et objectif d'épargne.
 *
 * Aucune donnée n'est envoyée : le texte est traité dans l'appareil.
 */

import { nombreDepuisMots, sansAccents } from "@/lib/extraction";

/** Tous les montants (chiffres ou mots) trouvés dans la phrase, dans l'ordre. */
function montantsOrdonnes(texte: string): { valeur: number; index: number }[] {
  const propre = sansAccents(texte);
  const trouves: { valeur: number; index: number }[] = [];

  const regex = /\d[\d\s.]{0,12}\d|\d+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(propre))) {
    const brut = m[0].replace(/[\s.]/g, "");
    const valeur = Number(brut);
    if (!Number.isFinite(valeur) || valeur <= 0) continue;
    // « 30 mille » → 30000
    const suite = propre.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const multiplie = /^\s*(mille|milles)\b/.test(suite)
      ? valeur * 1000
      : /^\s*(million|millions)\b/.test(suite)
        ? valeur * 1_000_000
        : valeur;
    trouves.push({ valeur: Math.round(multiplie), index: m.index });
  }

  if (trouves.length === 0) {
    const parMots = nombreDepuisMots(propre);
    if (parMots) trouves.push({ valeur: parMots, index: 0 });
  }
  return trouves;
}

/** Montant qui suit immédiatement un mot-clé (« plafond 25000 »). */
function montantApres(texte: string, motsCles: string[]): number | null {
  const propre = sansAccents(texte);
  for (const mot of motsCles) {
    const i = propre.indexOf(mot);
    if (i === -1) continue;
    const morceau = propre.slice(i + mot.length, i + mot.length + 40);
    const [premier] = montantsOrdonnes(morceau);
    if (premier) return premier.valeur;
  }
  return null;
}

const MOTS_PARASITES = new Set([
  "enveloppe",
  "nouvelle",
  "nouveau",
  "creer",
  "cree",
  "cre",
  "modifier",
  "modifie",
  "objectif",
  "epargne",
  "epargner",
  "economiser",
  "economise",
  "atteindre",
  "deja",
  "cote",
  "reuni",
  "ci",
  "mettre",
  "avec",
  "de",
  "du",
  "des",
  "le",
  "la",
  "les",
  "un",
  "une",
  "pour",
  "et",
  "a",
  "au",
  "aux",
  "en",
  "dans",
  "sur",
  "plafond",
  "plafonne",
  "limite",
  "dotation",
  "somme",
  "montant",
  "budget",
  "francs",
  "franc",
  "fcfa",
  "cfa",
  "mille",
  "milles",
  "million",
  "millions",
  "mois",
  "mois-ci",
  "an",
  "ans",
  "annee",
  "annees",
  "semaine",
  "semaines",
  "jour",
  "jours",
  "avant",
  "d",
  "l",
]);

/** Mots propres au vocabulaire des comptes, à ne pas garder dans le nom. */
const MOTS_COMPTE = new Set([
  "compte",
  "comptes",
  "solde",
  "initial",
  "initiale",
  "renommer",
  "renomme",
  "appelle",
  "appeler",
  "nommer",
  "nomme",
  "contient",
  "il",
  "y",
]);

/** Retire chiffres, mots outils et unités pour ne garder que le libellé parlé. */
function libelleDepuis(texte: string): string {
  const mots = sansAccents(texte)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((mot) => !/^\d+$/.test(mot))
    .filter((mot) => !MOTS_PARASITES.has(mot));
  return mots.join(" ").trim();
}

function majusculeInitiale(texte: string): string {
  if (!texte) return "";
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export type EnveloppeDictee = {
  /** Nom deviné de l'enveloppe (vide si non compris). */
  nom: string;
  /** Somme réellement placée dans l'enveloppe. */
  dotation: number | null;
  /** Plafond de dépenses à ne pas dépasser (toujours ≤ dotation). */
  plafond: number | null;
};

/**
 * « Enveloppe transport avec 30000 francs, plafond 25000 »
 *  → { nom: "Transport", dotation: 30000, plafond: 25000 }
 *
 * Sans plafond dicté, il est déduit à 80 % de la dotation (arrondi au 500).
 */
export function analyserEnveloppeDictee(texte: string): EnveloppeDictee {
  const plafondDit = montantApres(texte, ["plafond", "plafonne a", "limite de", "limite", "maximum", "max"]);
  const dotationDit = montantApres(texte, [
    "dotation",
    "somme de",
    "somme",
    "avec",
    "montant de",
    "montant",
    "budget de",
    "budget",
    "je mets",
    "met",
  ]);

  const tous = montantsOrdonnes(texte).map((m) => m.valeur);
  let dotation = dotationDit;
  let plafond = plafondDit;

  if (dotation === null && plafond === null) {
    // Ordre naturel : la première somme est la dotation, la seconde le plafond.
    dotation = tous[0] ?? null;
    plafond = tous[1] ?? null;
  } else if (dotation === null) {
    dotation = tous.find((v) => v !== plafond) ?? plafond;
  } else if (plafond === null) {
    const autre = tous.find((v) => v !== dotation);
    plafond = autre !== undefined ? autre : Math.round((dotation * 0.8) / 500) * 500;
  }

  // Le plafond ne peut jamais dépasser la somme réellement placée.
  if (dotation !== null && plafond !== null && plafond > dotation) {
    const echange = plafond;
    plafond = dotation;
    dotation = echange;
  }

  return {
    nom: majusculeInitiale(libelleDepuis(texte)),
    dotation: dotation && dotation > 0 ? dotation : null,
    plafond: plafond && plafond > 0 ? plafond : null,
  };
}

const MOIS_NOMS = [
  "janvier",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "decembre",
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Traduit un délai parlé (« dans 6 mois », « en décembre ») en date ISO. */
export function dateDepuisDelai(texte: string, aujourdHui = new Date()): string | null {
  const propre = sansAccents(texte);

  const relatif = propre.match(
    /\b(?:dans|d ici|dici|en|sous)\s+(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|dix-huit|vingt|vingt-quatre)\s*(jour|jours|semaine|semaines|mois|an|ans|annee|annees)\b/,
  );
  if (relatif) {
    const brut = relatif[1] ?? "";
    const quantite = /^\d+$/.test(brut) ? Number(brut) : (nombreDepuisMots(brut) ?? 1);
    const unite = relatif[2] ?? "";
    const d = new Date(aujourdHui.getTime());
    if (unite.startsWith("jour")) d.setDate(d.getDate() + quantite);
    else if (unite.startsWith("semaine")) d.setDate(d.getDate() + quantite * 7);
    else if (unite === "mois") d.setMonth(d.getMonth() + quantite);
    else d.setFullYear(d.getFullYear() + quantite);
    return iso(d);
  }

  const nomMois = MOIS_NOMS.findIndex((m) => propre.includes(m));
  if (nomMois >= 0) {
    const anneeDite = propre.match(/\b(20\d{2})\b/);
    const annee = anneeDite ? Number(anneeDite[1]) : aujourdHui.getFullYear();
    const jourDit = propre.match(/\b([12]?\d|3[01])\s+(?:de\s+)?[a-z]+/);
    const jour = jourDit ? Number(jourDit[1]) : 28;
    const d = new Date(Date.UTC(annee, nomMois, Math.min(jour, 28)));
    if (!anneeDite && d.getTime() <= aujourdHui.getTime()) d.setUTCFullYear(annee + 1);
    return iso(d);
  }

  return null;
}

export type ObjectifDictee = {
  libelle: string;
  cible: number | null;
  deja: number | null;
  dateCible: string | null;
};

/**
 * « Épargner 500000 francs pour une moto dans 6 mois, j'ai déjà 50000 »
 *  → { libelle: "Moto", cible: 500000, deja: 50000, dateCible: "…" }
 */
export function analyserObjectifDicte(texte: string, aujourdHui = new Date()): ObjectifDictee {
  const deja = montantApres(texte, ["deja", "j ai deja", "de cote", "cote", "reuni", "epargne deja"]);
  const tous = montantsOrdonnes(texte).map((m) => m.valeur);
  const cible = montantApres(texte, ["objectif de", "economiser", "epargner", "atteindre", "cible de"]) ??
    tous.find((v) => v !== deja) ??
    tous[0] ??
    null;

  // Les nombres du délai (« 6 mois ») ne sont pas des montants.
  const delaiNombres = new Set(
    (sansAccents(texte).match(/\b(\d+)\s*(jour|jours|semaine|semaines|mois|an|ans)\b/g) ?? []).map(
      (s) => Number(s.replace(/\D/g, "")),
    ),
  );

  const cibleValide = cible !== null && !delaiNombres.has(cible) && cible > 0 ? cible : null;
  const dejaValide = deja !== null && !delaiNombres.has(deja) && deja > 0 ? deja : null;

  return {
    libelle: majusculeInitiale(libelleDepuis(texte)),
    cible: cibleValide,
    deja: dejaValide,
    dateCible: dateDepuisDelai(texte, aujourdHui),
  };
}

export type CompteDicte = {
  /** Nom deviné du compte (vide si non compris). */
  nom: string;
  /** Solde initial dicté, s'il a été compris. */
  soldeInitial: number | null;
};

/**
 * « Compte Mobile Money avec un solde initial de 25000 francs »
 *  → { nom: "Mobile money", soldeInitial: 25000 }
 */
export function analyserCompteDicte(texte: string): CompteDicte {
  const solde =
    montantApres(texte, [
      "solde initial de",
      "solde initial",
      "solde de",
      "solde",
      "avec",
      "contient",
      "montant de",
      "montant",
      "il y a",
    ]) ??
    montantsOrdonnes(texte)[0]?.valeur ??
    null;

  const mots = sansAccents(texte)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((mot) => !/^\d+$/.test(mot))
    .filter((mot) => !MOTS_PARASITES.has(mot))
    .filter((mot) => !MOTS_COMPTE.has(mot));

  return {
    nom: majusculeInitiale(mots.join(" ").trim()),
    soldeInitial: solde && solde > 0 ? solde : null,
  };
}
