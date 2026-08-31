/**
 * Intelligences artificielles légères, exécutées entièrement sur le téléphone.
 *
 * Aucune connexion réseau, aucun service tiers, aucun modèle téléchargé :
 * ce sont des algorithmes d'apprentissage automatique classiques, écrits en
 * TypeScript, qui apprennent uniquement des données déjà présentes dans
 * l'application. Rien ne sort de l'appareil.
 *
 * Contenu :
 *  1. Classifieur bayésien naïf  → devine l'enveloppe d'après le libellé.
 *  2. Prévision de trésorerie    → régression linéaire + saisonnalité semaine.
 *  3. Risque de découvert        → simulation Monte-Carlo légère.
 *  4. Segmentation k-means       → profil de dépenses (petites/moyennes/grosses).
 *  5. Détection de dérive EWMA   → catégorie qui dérape.
 *  6. Budget recommandé          → plafond réaliste par quantile historique.
 */
import type { Enveloppe, Transaction } from "./store";

const JOUR_MS = 86_400_000;

function jourDe(date: string): string {
  return date.slice(0, 10);
}

function ajouterJours(base: number, jours: number): string {
  return new Date(base + jours * JOUR_MS).toISOString().slice(0, 10);
}

// ══════════════════════════ 1. Classifieur bayésien naïf ══════════════════════

export type ModeleBayes = {
  /** Nombre d'opérations apprises par enveloppe. */
  classes: Record<string, number>;
  /** Nombre d'occurrences de chaque mot dans chaque enveloppe. */
  mots: Record<string, Record<string, number>>;
  /** Vocabulaire total observé. */
  vocabulaire: number;
  total: number;
  /** Vocabulaire réel (pour rattraper les mots mal entendus par la dictée). */
  motsConnus?: string[];
};

const MOTS_VIDES = new Set([
  "le","la","les","de","des","du","un","une","et","a","au","aux","pour","en","sur","dans","par",
  "avec","chez","mon","ma","mes","ce","cette","fcfa","francs","cfa","achat","paiement",
  "jai","j'ai","cest","ete","fait","pris","donne","cette","celui","hier","aujourdhui","matin",
  "soir","francais","franc",
]);

/**
 * Synonymes du français parlé d'Afrique de l'Ouest (Bénin, Togo, Côte d'Ivoire…)
 * et variantes courantes de dictée, ramenés à un mot canonique connu du modèle.
 */
const SYNONYMES: Record<string, string> = {
  zem: "taxi", zemidjan: "taxi", zemidjean: "taxi", zemidja: "taxi", kekeno: "taxi",
  keke: "taxi", moto: "taxi", taximoto: "taxi", tricycle: "taxi", gbaka: "transport",
  woro: "transport", tro: "transport", bus: "transport", car: "transport",
  essence: "carburant", gasoil: "carburant", kpayo: "carburant", petrole: "carburant",
  bonbon: "nourriture", garba: "nourriture", attieke: "nourriture", akassa: "nourriture",
  amiwo: "nourriture", pate: "nourriture", riz: "nourriture", igname: "nourriture",
  gari: "nourriture", maggi: "nourriture", condiment: "nourriture", marche: "nourriture",
  cantine: "nourriture", restaurant: "nourriture", maquis: "nourriture", buvette: "loisirs",
  tchoukoutou: "loisirs", sodabi: "loisirs", biere: "loisirs", cinema: "loisirs",
  credit: "communication", forfait: "communication", unite: "communication",
  recharge: "communication", airtime: "communication", momo: "communication",
  mtn: "communication", moov: "communication", celtiis: "communication",
  wifi: "communication", internet: "communication", data: "communication",
  courant: "electricite", sbee: "electricite", cie: "electricite", ampoule: "electricite",
  soneb: "eau", bidon: "eau", pharmacie: "sante", medicament: "sante", clinique: "sante",
  hopital: "sante", consultation: "sante", ecolage: "scolarite", scolarite: "scolarite",
  ecole: "scolarite", cahier: "scolarite", fourniture: "scolarite", inscription: "scolarite",
  loyer: "logement", bailleur: "logement", maison: "logement",
  tontine: "epargne", njangi: "epargne", cotisation: "epargne",
};

/**
 * Code phonétique français simplifié : deux mots qui « sonnent » pareil
 * (ph/f, ss/c/s, au/o, ez/é, doublons, lettres muettes finales) donnent la
 * même clé. Cela rattrape les variations de prononciation de la dictée.
 */
export function clePhonetique(mot: string): string {
  let s = mot;
  s = s.replace(/(.)\1+/g, "$1");
  s = s
    .replace(/ph/g, "f")
    .replace(/qu|q|ck|k/g, "k")
    .replace(/ch|sh/g, "x")
    .replace(/gu(?=[eiy])/g, "g")
    .replace(/g(?=[eiy])/g, "j")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/(ai|ei|e[iy])/g, "e")
    .replace(/(au|eau|o)/g, "o")
    .replace(/(ou|w)/g, "u")
    .replace(/(in|im|ain|ein|un)/g, "1")
    .replace(/(an|am|en|em)/g, "2")
    .replace(/(on|om)/g, "3")
    .replace(/z/g, "s")
    .replace(/y/g, "i")
    .replace(/h/g, "");
  s = s.replace(/[edtsxz]+$/g, "");
  s = s.replace(/(.)\1+/g, "$1");
  return s || mot;
}

/** Distance de Levenshtein bornée, pour rattraper une syllabe mal entendue. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let precedent = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const courant = [i];
    for (let j = 1; j <= b.length; j += 1) {
      courant[j] = Math.min(
        (precedent[j] ?? 0) + 1,
        (courant[j - 1] ?? 0) + 1,
        (precedent[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    precedent = courant;
  }
  return precedent[b.length] ?? 9;
}

/** Découpe un libellé en mots utiles (minuscules, sans accents ni mots vides). */
export function jetons(texte: string): string[] {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m));
}

/**
 * Caractéristiques d'un libellé : chaque mot utile produit sa forme canonique
 * (synonyme francophone éventuel) plus sa clé phonétique. Le modèle apprend et
 * prédit sur ces deux niveaux, ce qui le rend tolérant à la prononciation.
 */
export function caracteristiques(texte: string, motsConnus?: string[]): string[] {
  const sortie: string[] = [];
  for (const brut of jetons(texte)) {
    let mot = SYNONYMES[brut] ?? brut;
    if (motsConnus && motsConnus.length > 0 && !motsConnus.includes(mot)) {
      // Mot inconnu : on cherche le plus proche du vocabulaire appris.
      const cle = clePhonetique(mot);
      const proche =
        motsConnus.find((m) => clePhonetique(m) === cle) ??
        motsConnus
          .map((m) => ({ m, d: distance(mot, m) }))
          .filter((c) => c.d <= (mot.length > 6 ? 2 : 1))
          .sort((a, b) => a.d - b.d)[0]?.m;
      if (proche) mot = proche;
    }
    sortie.push(mot, `~${clePhonetique(mot)}`);
  }
  return sortie;
}

/** Entraîne le classifieur sur l'historique des dépenses (quelques millisecondes). */
export function entrainerBayes(transactions: Transaction[]): ModeleBayes {
  const modele: ModeleBayes = { classes: {}, mots: {}, vocabulaire: 0, total: 0 };
  const vocabulaire = new Set<string>();
  const reels = new Set<string>();

  for (const t of transactions) {
    if (t.type !== "depense" || !t.categorie) continue;
    const mots = caracteristiques(t.libelle);
    if (mots.length === 0) continue;
    modele.classes[t.categorie] = (modele.classes[t.categorie] ?? 0) + 1;
    modele.total += 1;
    const table = (modele.mots[t.categorie] ??= {});
    for (const m of mots) {
      table[m] = (table[m] ?? 0) + 1;
      vocabulaire.add(m);
      if (!m.startsWith("~")) reels.add(m);
    }
  }

  modele.vocabulaire = vocabulaire.size;
  modele.motsConnus = [...reels];
  return modele;
}

export type PredictionBayes = { enveloppe: string; confiance: number };

/**
 * Prédit l'enveloppe la plus probable pour un libellé (lissage de Laplace).
 * `confiance` va de 0 à 1 ; en dessous de 0,55 il vaut mieux ne rien suggérer.
 */
export function predireEnveloppe(
  libelle: string,
  modele: ModeleBayes,
): PredictionBayes | undefined {
  const mots = caracteristiques(libelle, modele.motsConnus);
  if (mots.length === 0 || modele.total === 0) return undefined;

  const scores: { enveloppe: string; log: number }[] = [];
  for (const [classe, occurrences] of Object.entries(modele.classes)) {
    const table = modele.mots[classe] ?? {};
    const totalMots = Object.values(table).reduce((s, v) => s + v, 0);
    let log = Math.log(occurrences / modele.total);
    for (const m of mots) {
      log += Math.log(((table[m] ?? 0) + 1) / (totalMots + modele.vocabulaire + 1));
    }
    scores.push({ enveloppe: classe, log });
  }
  if (scores.length === 0) return undefined;

  scores.sort((a, b) => b.log - a.log);
  const max = scores[0]!.log;
  const exponentielles = scores.map((s) => Math.exp(s.log - max));
  const somme = exponentielles.reduce((s, v) => s + v, 0);
  return {
    enveloppe: scores[0]!.enveloppe,
    confiance: somme > 0 ? (exponentielles[0] ?? 0) / somme : 0,
  };

}

// ═════════════════════════ 2. Prévision de trésorerie ═════════════════════════

export type PointPrevision = { date: string; solde: number; depenseEstimee: number };

/** Régression linéaire simple : retourne la pente et l'ordonnée à l'origine. */
function regressionLineaire(valeurs: number[]): { pente: number; origine: number } {
  const n = valeurs.length;
  if (n < 2) return { pente: 0, origine: valeurs[0] ?? 0 };
  const moyenneX = (n - 1) / 2;
  const moyenneY = valeurs.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  valeurs.forEach((y, x) => {
    num += (x - moyenneX) * (y - moyenneY);
    den += (x - moyenneX) ** 2;
  });
  const pente = den === 0 ? 0 : num / den;
  return { pente, origine: moyenneY - pente * moyenneX };
}

/** Dépenses quotidiennes des `jours` derniers jours, du plus ancien au plus récent. */
function seriesQuotidiennes(transactions: Transaction[], jours: number): number[] {
  const base = Date.now();
  const serie = new Array<number>(jours).fill(0);
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const index =
      jours - 1 - Math.floor((base - new Date(`${jourDe(t.date)}T00:00:00`).getTime()) / JOUR_MS);
    if (index >= 0 && index < jours) serie[index] = (serie[index] ?? 0) + t.montant;
  }
  return serie;
}

/**
 * Prévoit le solde jour par jour sur `horizon` jours en combinant la tendance
 * (régression linéaire) et la saisonnalité hebdomadaire (coefficient par jour
 * de la semaine), apprises sur les 60 derniers jours.
 */
export function previsionTresorerie(
  transactions: Transaction[],
  soldeActuel: number,
  horizon = 30,
): PointPrevision[] {
  const historique = 60;
  const serie = seriesQuotidiennes(transactions, historique);
  const { pente, origine } = regressionLineaire(serie);

  // Coefficient de saisonnalité par jour de la semaine (0 = dimanche).
  const base = Date.now();
  const sommes = new Array<number>(7).fill(0);
  const comptes = new Array<number>(7).fill(0);
  serie.forEach((valeur, i) => {
    const jour = new Date(base - (historique - 1 - i) * JOUR_MS).getDay();
    sommes[jour] = (sommes[jour] ?? 0) + valeur;
    comptes[jour] = (comptes[jour] ?? 0) + 1;
  });
  const moyenneGlobale = serie.reduce((s, v) => s + v, 0) / historique || 1;
  const coefficients = sommes.map((s, i) =>
    comptes[i] ? s / (comptes[i] as number) / moyenneGlobale : 1,
  );

  // Revenus moyens quotidiens, ajoutés au solde prévu.
  const revenus = transactions
    .filter((t) => t.type === "revenu" && jourDe(t.date) >= ajouterJours(base, -historique))
    .reduce((s, t) => s + t.montant, 0);
  const revenuJour = revenus / historique;

  const points: PointPrevision[] = [];
  let solde = soldeActuel;
  for (let i = 1; i <= horizon; i += 1) {
    const tendance = Math.max(0, origine + pente * (historique - 1 + i));
    const jourSemaine = new Date(base + i * JOUR_MS).getDay();
    const depenseEstimee = Math.round(tendance * (coefficients[jourSemaine] ?? 1));
    solde += revenuJour - depenseEstimee;
    points.push({ date: ajouterJours(base, i), solde: Math.round(solde), depenseEstimee });
  }
  return points;
}

// ══════════════════════════ 3. Risque de découvert ════════════════════════════

export type RisqueDecouvert = {
  /** Probabilité (0-100) de passer sous zéro dans l'horizon. */
  probabilite: number;
  /** Jour médian estimé du découvert, null si improbable. */
  jourMedian: number | null;
  /** Solde médian simulé à la fin de l'horizon. */
  soldeMedian: number;
  niveau: "bon" | "attention" | "alerte";
};

/**
 * Simulation de Monte-Carlo (400 scénarios) sur le solde futur, à partir de la
 * moyenne et de l'écart-type des dépenses quotidiennes observées.
 */
export function risqueDecouvert(
  transactions: Transaction[],
  soldeActuel: number,
  horizon = 30,
  scenarios = 400,
): RisqueDecouvert {
  const historique = 60;
  const serie = seriesQuotidiennes(transactions, historique);
  const moyenne = serie.reduce((s, v) => s + v, 0) / historique;
  const variance = serie.reduce((s, v) => s + (v - moyenne) ** 2, 0) / historique;
  const ecartType = Math.sqrt(variance);

  const revenus = transactions
    .filter((t) => t.type === "revenu" && jourDe(t.date) >= ajouterJours(Date.now(), -historique))
    .reduce((s, t) => s + t.montant, 0);
  const revenuJour = revenus / historique;

  const soldesFinaux: number[] = [];
  const joursDecouvert: number[] = [];
  let echecs = 0;

  for (let s = 0; s < scenarios; s += 1) {
    let solde = soldeActuel;
    let premierJour: number | null = null;
    for (let j = 1; j <= horizon; j += 1) {
      // Bruit gaussien approché (somme de deux tirages uniformes).
      const bruit = (Math.random() + Math.random() - 1) * ecartType;
      solde += revenuJour - Math.max(0, moyenne + bruit);
      if (solde < 0 && premierJour === null) premierJour = j;
    }
    soldesFinaux.push(solde);
    if (premierJour !== null) {
      echecs += 1;
      joursDecouvert.push(premierJour);
    }
  }

  soldesFinaux.sort((a, b) => a - b);
  joursDecouvert.sort((a, b) => a - b);
  const probabilite = Math.round((echecs / scenarios) * 100);

  return {
    probabilite,
    jourMedian: joursDecouvert.length
      ? (joursDecouvert[Math.floor(joursDecouvert.length / 2)] ?? null)
      : null,
    soldeMedian: Math.round(soldesFinaux[Math.floor(soldesFinaux.length / 2)] ?? soldeActuel),
    niveau: probabilite >= 50 ? "alerte" : probabilite >= 20 ? "attention" : "bon",
  };
}

// ═══════════════════════ 4. Segmentation k-means ══════════════════════════════

export type Segment = {
  nom: string;
  centre: number;
  operations: number;
  total: number;
  part: number;
};

/**
 * Regroupe les dépenses en 3 familles (petites, moyennes, grosses) par k-means
 * 1-D avec initialisation par quantiles : profil de comportement de dépense.
 */
export function segmenterDepenses(transactions: Transaction[], k = 3): Segment[] {
  const montants = transactions
    .filter((t) => t.type === "depense" && t.montant > 0)
    .map((t) => t.montant)
    .sort((a, b) => a - b);
  if (montants.length < k) return [];

  let centres = Array.from(
    { length: k },
    (_, i) => montants[Math.floor(((i + 0.5) / k) * montants.length)] ?? 0,
  );

  let affectations = new Array<number>(montants.length).fill(0);
  for (let iteration = 0; iteration < 20; iteration += 1) {
    let change = false;
    affectations = montants.map((m, i) => {
      let meilleur = 0;
      let distance = Infinity;
      centres.forEach((c, j) => {
        const d = Math.abs(m - c);
        if (d < distance) {
          distance = d;
          meilleur = j;
        }
      });
      if (affectations[i] !== meilleur) change = true;
      return meilleur;
    });
    const nouveaux = centres.map((c, j) => {
      const groupe = montants.filter((_, i) => affectations[i] === j);
      return groupe.length ? groupe.reduce((s, v) => s + v, 0) / groupe.length : c;
    });
    centres = nouveaux;
    if (!change) break;
  }

  const noms = k === 3 ? ["Petites dépenses", "Dépenses moyennes", "Grosses dépenses"] : [];
  const totalGeneral = montants.reduce((s, v) => s + v, 0) || 1;

  return centres
    .map((centre, j) => {
      const groupe = montants.filter((_, i) => affectations[i] === j);
      const total = groupe.reduce((s, v) => s + v, 0);
      return {
        nom: noms[j] ?? `Groupe ${j + 1}`,
        centre: Math.round(centre),
        operations: groupe.length,
        total,
        part: Math.round((total / totalGeneral) * 100),
      };
    })
    .filter((s) => s.operations > 0)
    .sort((a, b) => a.centre - b.centre);
}

// ═════════════════════════ 5. Détection de dérive EWMA ════════════════════════

export type Derive = {
  categorie: string;
  /** Moyenne lissée récente, en FCFA par semaine. */
  recent: number;
  /** Moyenne lissée de référence. */
  reference: number;
  /** Variation en pourcentage. */
  variation: number;
  sens: "hausse" | "baisse";
};

/**
 * Moyenne mobile exponentielle par catégorie : repère les postes qui dérivent
 * nettement par rapport à leur propre habitude (seuil 25 %).
 */
export function detecterDerives(transactions: Transaction[], seuil = 25): Derive[] {
  const base = Date.now();
  const semaines = 8;
  const parCategorie = new Map<string, number[]>();

  for (const t of transactions) {
    if (t.type !== "depense" || !t.categorie) continue;
    const index =
      semaines -
      1 -
      Math.floor((base - new Date(`${jourDe(t.date)}T00:00:00`).getTime()) / (7 * JOUR_MS));
    if (index < 0 || index >= semaines) continue;
    const serie = parCategorie.get(t.categorie) ?? new Array<number>(semaines).fill(0);
    serie[index] = (serie[index] ?? 0) + t.montant;
    parCategorie.set(t.categorie, serie);
  }

  const alpha = 0.4;
  const derives: Derive[] = [];
  for (const [categorie, serie] of parCategorie) {
    if (serie.filter((v) => v > 0).length < 3) continue;
    let ewma = serie[0] ?? 0;
    let reference = ewma;
    serie.forEach((valeur, i) => {
      ewma = alpha * valeur + (1 - alpha) * ewma;
      if (i === semaines - 4) reference = ewma;
    });
    if (reference <= 0) continue;
    const variation = Math.round(((ewma - reference) / reference) * 100);
    if (Math.abs(variation) < seuil) continue;
    derives.push({
      categorie,
      recent: Math.round(ewma),
      reference: Math.round(reference),
      variation,
      sens: variation > 0 ? "hausse" : "baisse",
    });
  }

  return derives.sort((a, b) => Math.abs(b.variation) - Math.abs(a.variation));
}

// ═══════════════════════ 6. Budget recommandé ═════════════════════════════════

export type BudgetRecommande = {
  enveloppe: Enveloppe;
  plafondActuel: number;
  /** Plafond conseillé : quantile 80 % des dépenses mensuelles observées. */
  plafondConseille: number;
  ecart: number;
  conseil: "augmenter" | "reduire" | "garder";
};

/**
 * Calcule un plafond réaliste par enveloppe à partir du quantile 80 % des
 * dépenses mensuelles constatées : ni trop serré, ni trop large.
 */
export function budgetsRecommandes(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  moisAnalyses = 6,
): BudgetRecommande[] {
  const base = new Date();
  const cles: string[] = [];
  for (let i = 0; i < moisAnalyses; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    cles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return enveloppes
    .map((e) => {
      const totaux = cles.map((cle) =>
        transactions
          .filter((t) => t.type === "depense" && t.categorie === e.nom && t.date.startsWith(cle))
          .reduce((s, t) => s + t.montant, 0),
      );
      const observes = totaux.filter((v) => v > 0).sort((a, b) => a - b);
      if (observes.length < 2) return undefined;
      const index = Math.min(observes.length - 1, Math.floor(observes.length * 0.8));
      const plafondConseille = Math.round((observes[index] ?? 0) / 500) * 500;
      const ecart = plafondConseille - e.plafond;
      const relatif = e.plafond > 0 ? Math.abs(ecart) / e.plafond : 1;
      return {
        enveloppe: e,
        plafondActuel: e.plafond,
        plafondConseille,
        ecart,
        conseil: relatif < 0.15 ? "garder" : ecart > 0 ? "augmenter" : "reduire",
      } satisfies BudgetRecommande;
    })
    .filter((v): v is BudgetRecommande => v !== undefined)
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
}
