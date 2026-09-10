/**
 * Compréhension des questions du conseiller, renforcée.
 *
 * Auparavant, le conseiller ne comprenait qu'une liste de mots-clés exacts :
 * « objectif » était compris, « objctif » ou « mon projet » ne l'étaient pas.
 * Ce module ajoute deux capacités, toujours hors ligne :
 *
 *  1. Un lexique de synonymes par domaine (ex. « projet », « mettre de côté »
 *     et « tontine » mènent tous aux objectifs).
 *  2. Une tolérance aux fautes de frappe : chaque mot de la question est
 *     comparé aux termes du lexique avec une distance d'édition bornée, donc
 *     « kombien », « epargnne » ou « rembourssement » restent compris.
 *
 * Le score d'un domaine est la somme des poids des termes reconnus ; le
 * domaine le mieux noté l'emporte s'il dépasse le seuil. Aucune donnée ne
 * quitte l'appareil.
 */

export type DomaineClasse = { id: string; score: number };

/** Terme du lexique : forme normalisée, sans accents, et son poids. */
type Terme = { texte: string; poids: number };

const LEXIQUE: { id: string; termes: Terme[] }[] = [
  {
    id: "capacites",
    termes: t({
      "que sais tu": 3,
      "que peux tu": 3,
      capacites: 3,
      possibilites: 2,
      "aide moi": 2,
      "comment tu marches": 2,
      "comment ca marche": 2,
      fonctionnement: 2,
      "tu sais quoi": 2,
      "sais faire": 2,
      "peux faire": 2,
    }),
  },
  {
    id: "limites",
    termes: t({
      limite: 3,
      limites: 3,
      faiblesse: 3,
      faiblesses: 3,
      defaut: 2,
      defauts: 2,
      fiabilite: 3,
      fiable: 2,
      "tu te trompes": 2,
      erreur: 1,
      confiance: 2,
      "ne sais pas": 2,
      incapable: 2,
      "marge d erreur": 2,
      precision: 1,
      precis: 1,
    }),
  },
  {
    id: "apprentissage",
    termes: t({
      apprentissage: 3,
      appris: 3,
      apprends: 3,
      intelligence: 2,
      memoire: 2,
      habitude: 2,
      habitudes: 2,
      "tu me connais": 3,
      "tu apprends": 3,
      maturite: 2,
      progresse: 1,
    }),
  },
  {
    id: "comptes",
    termes: t({
      compte: 3,
      comptes: 3,
      solde: 3,
      soldes: 3,
      banque: 2,
      momo: 3,
      moov: 3,
      wave: 3,
      especes: 2,
      caisse: 2,
      disponible: 2,
      "il me reste": 2,
      "reste combien": 2,
      orange: 1,
      mtn: 1,
      depot: 1,
      retrait: 1,
      argent: 1,
    }),
  },
  {
    id: "dettes",
    termes: t({
      dette: 3,
      dettes: 3,
      creance: 3,
      creances: 3,
      "je dois": 3,
      "on me doit": 3,
      rembourser: 3,
      remboursement: 3,
      rembourse: 2,
      prete: 2,
      pret: 2,
      emprunt: 2,
      emprunte: 2,
      "rendre l argent": 2,
      "me doit": 2,
      credit: 1,
    }),
  },
  {
    id: "objectifs",
    termes: t({
      objectif: 3,
      objectifs: 3,
      epargne: 3,
      epargner: 3,
      economiser: 3,
      projet: 2,
      projets: 2,
      achat: 2,
      acheter: 2,
      tontine: 3,
      "mettre de cote": 3,
      "de cote": 2,
      cagnotte: 2,
      cotisation: 2,
    }),
  },
  {
    id: "planifie",
    termes: t({
      planifie: 3,
      planifiee: 3,
      planification: 2,
      prevu: 3,
      prevue: 3,
      previsionnel: 2,
      suivi: 2,
      compare: 2,
      comparaison: 2,
      ecart: 3,
      ecarts: 3,
      reel: 2,
      reelle: 2,
      respecte: 1,
      "respecte mon budget": 3,
    }),
  },
  {
    id: "previsions",
    termes: t({
      prevision: 3,
      previsions: 3,
      projection: 3,
      "fin du mois": 3,
      "prochain mois": 2,
      futur: 2,
      tiendrai: 3,
      "je vais tenir": 2,
      rythme: 2,
      depenserai: 2,
      "vais depenser": 2,
      "d ici la fin": 2,
      prevoir: 2,
      estime: 1,
      estimation: 1,
    }),
  },
  {
    id: "alertes",
    termes: t({
      alerte: 3,
      alertes: 3,
      probleme: 3,
      problemes: 3,
      risque: 3,
      risques: 3,
      danger: 3,
      attention: 2,
      vigilance: 3,
      depassement: 2,
      depasse: 2,
      "ca va pas": 2,
      inquietant: 1,
    }),
  },
  {
    id: "conseils",
    termes: t({
      conseil: 3,
      conseils: 3,
      economie: 2,
      economies: 2,
      "depense inutile": 3,
      inutile: 2,
      inutiles: 2,
      fuite: 3,
      fuites: 3,
      inhabituel: 3,
      inhabituelle: 3,
      anormal: 3,
      anormale: 3,
      reduire: 3,
      diminuer: 2,
      rogner: 2,
      optimiser: 2,
      ameliorer: 1,
      "faire mieux": 2,
      "mieux gerer": 2,
      gaspillage: 3,
      gaspiller: 2,
    }),
  },
  {
    id: "resume",
    termes: t({
      resume: 3,
      "point global": 3,
      "situation generale": 3,
      "ou en est": 3,
      "comment ca va": 2,
      "bilan general": 3,
      bilan: 2,
      situation: 2,
      general: 1,
      globale: 1,
      apercu: 2,
      "vue d ensemble": 2,
      "fais le point": 2,
    }),
  },
];

function t(entrées: Record<string, number>): Terme[] {
  return Object.entries(entrées).map(([texte, poids]) => ({ texte, poids }));
}

/** Normalisation commune : minuscules, sans accents, espaces stabilisés. */
export function normaliserQuestion(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MOTS_VIDES = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "au",
  "aux",
  "en",
  "et",
  "ou",
  "a",
  "est",
  "sont",
  "je",
  "tu",
  "il",
  "on",
  "me",
  "te",
  "se",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "ce",
  "cet",
  "cette",
  "que",
  "qui",
  "quoi",
  "dans",
  "sur",
  "pour",
  "avec",
  "sans",
  "plus",
  "moins",
  "tres",
  "bien",
  "combien",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "comment",
  "pourquoi",
  "fais",
  "dis",
  "moi",
  "ca",
  "y",
  "il y a",
  "as",
  "ai",
  "es",
  "avons",
  "peux",
  "peut",
  "veux",
  "veut",
  "savoir",
  "voir",
  "donne",
  "donner",
]);

/** Mots porteurs de sens d'une question, prêts pour la comparaison. */
export function motsPorteurs(question: string): string[] {
  return normaliserQuestion(question)
    .split(" ")
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
}

/**
 * Distance d'édition bornée : renvoie la distance de Levenshtein si elle est
 * inférieure ou égale à `maxi`, sinon `maxi + 1`. La borne permet de couper
 * tôt les calculs sur les longs mots.
 */
export function distanceMots(a: string, b: string, maxi = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxi) return maxi + 1;
  let precedent = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const courant = [i];
    let minLigne = i;
    for (let j = 1; j <= lb; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(
        (precedent[j] ?? 0) + 1,
        (courant[j - 1] ?? 0) + 1,
        (precedent[j - 1] ?? 0) + cout,
      );
      courant[j] = v;
      if (v < minLigne) minLigne = v;
    }
    if (minLigne > maxi) return maxi + 1;
    precedent = courant;
  }
  return precedent[lb] ?? maxi + 1;
}

/**
 * Un mot de la question « ressemble » à un terme du lexique quand il est
 * identique, préfixe (pour les racines : « rembourser » / « remboursement »),
 * ou à une faute de frappe près (1 erreur dès 5 lettres, 2 dès 9 lettres).
 */
export function ressemble(mot: string, terme: string): boolean {
  if (mot === terme) return true;
  if (terme.length >= 5 && (mot.startsWith(terme) || terme.startsWith(mot)) && mot.length >= 4)
    return true;
  const tolerance = terme.length >= 9 ? 2 : terme.length >= 5 ? 1 : 0;
  if (tolerance === 0) return false;
  return distanceMots(mot, terme, tolerance) <= tolerance;
}

/**
 * Classe une question dans le domaine le plus probable.
 * Les expressions de plusieurs mots sont testées sur la phrase entière, les
 * mots simples avec tolérance aux fautes. Renvoie null sous le seuil, ce qui
 * laisse la main aux autres intelligences puis à la réponse par défaut.
 */
export function classerQuestion(question: string, seuil = 2): DomaineClasse | null {
  const phrase = normaliserQuestion(question);
  if (!phrase) return null;
  const mots = phrase.split(" ").filter((m) => m.length >= 2);

  let meilleur: DomaineClasse | null = null;
  for (const domaine of LEXIQUE) {
    let score = 0;
    for (const terme of domaine.termes) {
      if (terme.texte.includes(" ")) {
        // Expression : sous-chaîne exacte, ou chaque mot reconnu de près.
        if (phrase.includes(terme.texte)) {
          score += terme.poids;
          continue;
        }
        const motsTerme = terme.texte.split(" ");
        const reconnus = motsTerme.filter((mt) =>
          mots.some((m) => m.length >= 4 && ressemble(m, mt)),
        );
        if (reconnus.length === motsTerme.length) score += Math.max(1, terme.poids - 1);
      } else {
        if (mots.some((m) => ressemble(m, terme.texte))) score += terme.poids;
      }
    }
    if (score >= seuil && (!meilleur || score > meilleur.score)) {
      meilleur = { id: domaine.id, score };
    }
  }
  return meilleur;
}

/** Domaines que le lexique sait reconnaître, pour les messages d'aide. */
export function domainesReconnus(): string[] {
  return LEXIQUE.map((d) => d.id);
}
