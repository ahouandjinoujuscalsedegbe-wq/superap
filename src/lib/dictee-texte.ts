/**
 * Mise au propre du texte dicté (100 % hors ligne).
 *
 * La reconnaissance vocale renvoie une phrase brute, souvent mal orthographiée
 * sur le vocabulaire du budget (« en veloppe », « conseille », « budgé »…).
 * Ce module remet la phrase au propre : vocabulaire de l'application corrigé,
 * nombres écrits en chiffres, ponctuation dictée, hésitations retirées.
 */

/** Retire les accents et met en minuscules, pour comparer les mots. */
export function sansAccent(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ------------------------------------------------------------------ */
/* Vocabulaire de l'application                                        */
/* ------------------------------------------------------------------ */

/** Corrections mot à mot : forme entendue (sans accent) → forme correcte. */
const VOCABULAIRE: Record<string, string> = {
  // Budget
  budge: "budget", budgé: "budget", budjet: "budget", budgets: "budget",
  bidget: "budget", budgé_t: "budget", budgetaire: "budgétaire",
  budgetisation: "budgétisation", budgetiser: "budgétiser",
  // Enveloppe
  enveloppes: "enveloppes", envelope: "enveloppe", envelopes: "enveloppes",
  enveloppement: "enveloppe", "en veloppe": "enveloppe", anveloppe: "enveloppe",
  enveloppa: "enveloppe", enveloppee: "enveloppe",
  // Conseil
  conseille: "conseil", conseils: "conseils", conseiller: "conseiller",
  consseil: "conseil", conseille_moi: "conseille-moi", conseilles: "conseil",
  konseil: "conseil",
  // Argent
  depense: "dépense", depenses: "dépenses", depenser: "dépenser",
  revenu: "revenu", revenus: "revenus", rev: "revenu",
  epargne: "épargne", epargner: "épargner", eparnge: "épargne",
  solde: "solde", soldes: "soldes", compte: "compte", comptes: "comptes",
  dette: "dette", dettes: "dettes", objectif: "objectif", objectifs: "objectifs",
  virement: "virement", transfert: "transfert", plafond: "plafond",
  categorie: "catégorie", categories: "catégories",
  renouvellement: "renouvellement", echeance: "échéance", echeances: "échéances",
  // Monnaie
  cfa: "FCFA", fcfa: "FCFA", "f cfa": "FCFA", franc: "francs", francs: "francs",
  balle: "francs", balles: "francs",
};

/** Expressions entendues de travers → expression correcte. */
const EXPRESSIONS: [RegExp, string][] = [
  [/\ben\s+veloppe?s?\b/gi, "enveloppe"],
  [/\bmon\s+conseill?[ée]?r?\b/gi, "mon conseiller"],
  [/\bcombien\s+il\s+me\s+reste\b/gi, "combien me reste-t-il"],
  [/\bfrancs?\s+c\.?\s*f\.?\s*a\.?\b/gi, "FCFA"],
  [/\bf\s*\.?\s*c\s*\.?\s*f\s*\.?\s*a\b/gi, "FCFA"],
  [/\bpour\s*cent\b/gi, "%"],
];

/** Hésitations à supprimer. */
const HESITATIONS = /\b(euh+|heu+|hum+|hein|bah|ben|ba+f)\b/gi;

/** Ponctuation dictée à haute voix. */
const PONCTUATION: [RegExp, string][] = [
  [/\bpoint d'interrogation\b/gi, "?"],
  [/\bpoint d'exclamation\b/gi, "!"],
  [/\bdeux points\b/gi, ":"],
  [/\bpoint virgule\b/gi, ";"],
  [/\bvirgule\b/gi, ","],
  [/\bnouvelle ligne\b|\bà la ligne\b|\ba la ligne\b/gi, "\n"],
  [/\bpoint\b(?!\s*\d)/gi, "."],
];

/* ------------------------------------------------------------------ */
/* Nombres dictés                                                      */
/* ------------------------------------------------------------------ */

const UNITES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
  sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40,
  cinquante: 50, soixante: 60, "quatre-vingt": 80, "quatre-vingts": 80,
  cent: 100, cents: 100,
};

const MOTS_LIAISON = new Set(["et", "-"]);

/** Convertit une suite de mots-nombres français en valeur numérique. */
function valeurNombre(mots: string[]): number | null {
  let total = 0;
  let courant = 0;
  let vu = false;
  for (const mot of mots) {
    if (MOTS_LIAISON.has(mot)) continue;
    if (mot === "mille" || mot === "milles") {
      total += (courant === 0 ? 1 : courant) * 1000;
      courant = 0;
      vu = true;
      continue;
    }
    if (mot === "million" || mot === "millions") {
      total = (total + (courant === 0 ? 1 : courant)) * 1_000_000;
      courant = 0;
      vu = true;
      continue;
    }
    if (mot === "cent" || mot === "cents") {
      courant = (courant === 0 ? 1 : courant) * 100;
      vu = true;
      continue;
    }
    const v = UNITES[mot];
    if (v === undefined) return null;
    courant += v;
    vu = true;
  }
  if (!vu) return null;
  return total + courant;
}

const MOTS_NOMBRE = new Set([
  ...Object.keys(UNITES),
  "mille", "milles", "million", "millions", "et",
]);

/** Remplace les nombres dictés en toutes lettres par des chiffres. */
export function chiffrerNombres(texte: string): string {
  const jetons = texte.split(/(\s+)/);
  const sortie: string[] = [];
  let tampon: string[] = [];

  const vider = () => {
    if (tampon.length === 0) return;
    const mots = tampon.map((m) => sansAccent(m).replace(/[.,;:!?]/g, ""));
    // « un »/« une » seuls restent des articles, pas le chiffre 1.
    if (mots.length === 1 && (mots[0] === "un" || mots[0] === "une")) {
      sortie.push(tampon.join(" "));
      tampon = [];
      return;
    }
    const valeur = valeurNombre(mots);
    sortie.push(valeur === null ? tampon.join(" ") : String(valeur));
    tampon = [];
  };

  for (const jeton of jetons) {
    if (/^\s+$/.test(jeton)) {
      if (tampon.length === 0) sortie.push(jeton);
      continue;
    }
    const nu = sansAccent(jeton).replace(/[.,;:!?]/g, "");
    if (MOTS_NOMBRE.has(nu)) {
      // « et » n'est un mot-nombre que s'il suit déjà un nombre.
      if (nu === "et" && tampon.length === 0) {
        sortie.push(jeton);
        continue;
      }
      tampon.push(jeton);
      continue;
    }
    vider();
    if (sortie.length > 0 && !/\s$/.test(sortie[sortie.length - 1] ?? "")) sortie.push(" ");
    sortie.push(jeton);
  }
  vider();
  return sortie.join("").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/* Nettoyage complet                                                   */
/* ------------------------------------------------------------------ */

/**
 * Transforme une phrase dictée en texte clair : vocabulaire du budget corrigé,
 * nombres en chiffres, ponctuation appliquée, première lettre en majuscule.
 */
export function nettoyerDictee(brut: string): string {
  if (!brut) return "";
  let t = brut.replace(/\s+/g, " ").trim();

  for (const [motif, remplacement] of EXPRESSIONS) t = t.replace(motif, remplacement);
  t = t.replace(HESITATIONS, " ");
  for (const [motif, remplacement] of PONCTUATION) t = t.replace(motif, remplacement);

  t = chiffrerNombres(t);

  t = t
    .split(" ")
    .map((mot) => {
      const signes = mot.match(/[.,;:!?]+$/)?.[0] ?? "";
      const nu = mot.slice(0, mot.length - signes.length);
      const cle = sansAccent(nu);
      const correction = VOCABULAIRE[cle];
      return (correction ?? nu) + signes;
    })
    .join(" ");

  t = t
    .replace(/\s+([.,;:!?%])/g, "$1")
    .replace(/([.,;:!?])(?=[^\s.,;:!?])/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!t) return "";
  return t.charAt(0).toLocaleUpperCase("fr-FR") + t.slice(1);
}
