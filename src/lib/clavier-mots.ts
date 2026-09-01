/**
 * Dictionnaire local du clavier interne.
 *
 * Il apprend les mots réellement saisis par l'utilisateur (100 % hors ligne,
 * stockage local) et propose des suggestions et corrections comme le clavier
 * d'Android 16.
 */

const CLE = "superapp.clavier.mots";

/** Vocabulaire de base, orienté budget familial en FCFA. */
const BASE = [
  "MARCHÉ",
  "TRANSPORT",
  "CARBURANT",
  "TAXI",
  "LOYER",
  "ÉLECTRICITÉ",
  "EAU",
  "SANTÉ",
  "PHARMACIE",
  "ÉCOLE",
  "SCOLARITÉ",
  "NOURRITURE",
  "ALIMENTATION",
  "COURSES",
  "SALAIRE",
  "PRIME",
  "ÉPARGNE",
  "DETTE",
  "REMBOURSEMENT",
  "TÉLÉPHONE",
  "INTERNET",
  "CRÉDIT",
  "FAMILLE",
  "ENFANTS",
  "MAISON",
  "CUISINE",
  "LOISIRS",
  "VOYAGE",
  "CADEAU",
  "IMPRÉVU",
  "URGENCE",
  "ENVELOPPE",
  "COMPTE",
  "REVENU",
  "DÉPENSE",
  "VIREMENT",
  "MOBILE",
  "MONEY",
  "BANQUE",
  "ESSENCE",
  "MOTO",
  "ENTRETIEN",
  "VÊTEMENTS",
  "COIFFURE",
  "RESTAURANT",
];

type Freq = Record<string, number>;

let memoire: Freq | null = null;

function charger(): Freq {
  if (memoire) return memoire;
  let stocke: Freq = {};
  try {
    const brut = typeof window !== "undefined" ? window.localStorage.getItem(CLE) : null;
    if (brut) stocke = JSON.parse(brut) as Freq;
  } catch {
    stocke = {};
  }
  const base: Freq = {};
  for (const mot of BASE) base[mot] = 1;
  memoire = { ...base, ...stocke };
  return memoire;
}

function enregistrer() {
  if (!memoire) return;
  try {
    // On ne garde que les 400 mots les plus fréquents.
    const trie = Object.entries(memoire)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 400);
    window.localStorage.setItem(CLE, JSON.stringify(Object.fromEntries(trie)));
  } catch {
    /* stockage indisponible */
  }
}

/** Mémorise un mot saisi par l'utilisateur. */
export function apprendreMot(mot: string) {
  const propre = mot.trim().toLocaleUpperCase("fr-FR");
  if (propre.length < 3 || /\d/.test(propre)) return;
  const dico = charger();
  dico[propre] = (dico[propre] ?? 0) + 2;
  enregistrer();
}

/** Mémorise tous les mots d'une phrase validée. */
export function apprendrePhrase(texte: string) {
  for (const mot of texte.split(/[^\p{L}'-]+/u)) apprendreMot(mot);
}

/** Retire les accents pour comparer des mots tapés sans accent. */
function sansAccent(mot: string) {
  return mot.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Distance d'édition bornée, pour la correction automatique. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i]![0] = i;
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cout);
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Suggestions pour le mot en cours de frappe :
 * complétion par préfixe d'abord, puis corrections proches.
 */
export function suggerer(prefixe: string, limite = 3): string[] {
  const mot = prefixe.trim().toLocaleUpperCase("fr-FR");
  if (mot.length < 2) return [];
  const dico = charger();
  const nu = sansAccent(mot);
  const entrees = Object.entries(dico);

  const debuts = entrees
    .filter(([m]) => sansAccent(m).startsWith(nu) && sansAccent(m) !== nu)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([m]) => m);

  const proches = entrees
    .filter(([m]) => !debuts.includes(m) && distance(sansAccent(m), nu) <= (nu.length > 5 ? 2 : 1))
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);

  return [...debuts, ...proches].slice(0, limite);
}
