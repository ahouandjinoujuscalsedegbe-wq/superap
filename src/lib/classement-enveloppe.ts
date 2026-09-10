/**
 * Reconnaissance automatique de l'enveloppe d'une dépense.
 *
 * Tout est calculé localement, sans réseau. Trois sources sont combinées :
 *  1. l'historique des dépenses déjà classées (le plus fiable) ;
 *  2. le nom, la catégorie et la sous-catégorie des enveloppes existantes ;
 *  3. un lexique local du quotidien (zem, taxi, marché, SBEE, écolage…).
 *
 * La comparaison tolère les fautes de frappe grâce à `ressemble`.
 */
import { motsPorteurs, normaliserQuestion, ressemble } from "@/lib/comprehension";
import type { Enveloppe, Transaction } from "@/lib/store";

export type ClassementEnveloppe = {
  /** Identifiant de l'enveloppe reconnue. */
  enveloppe: string;
  /** Confiance de 0 à 100. */
  confiance: number;
  /** Explication lisible pour l'utilisateur. */
  raison: string;
  /** Origine de la reconnaissance. */
  source: "historique" | "nom" | "lexique";
};

/** Lexique local : mot du quotidien → familles d'enveloppes probables. */
const LEXIQUE: Record<string, string[]> = {
  transport: [
    "zem",
    "zemidjan",
    "taxi",
    "moto",
    "bus",
    "essence",
    "carburant",
    "station",
    "peage",
    "transport",
    "course",
    "trajet",
    "vtc",
    "ticket",
  ],
  alimentation: [
    "marche",
    "riz",
    "mais",
    "tomate",
    "poisson",
    "viande",
    "poulet",
    "pain",
    "lait",
    "huile",
    "sucre",
    "boutique",
    "supermarche",
    "epicerie",
    "provision",
    "nourriture",
    "repas",
    "restaurant",
    "maquis",
    "cantine",
    "manger",
    "petit dejeuner",
  ],
  logement: ["loyer", "maison", "bail", "caution", "logement", "chambre"],
  factures: [
    "sbee",
    "soneb",
    "electricite",
    "courant",
    "eau",
    "facture",
    "internet",
    "wifi",
    "abonnement",
    "canal",
    "moov",
    "mtn",
    "credit",
    "forfait",
    "recharge",
    "airtime",
  ],
  sante: [
    "pharmacie",
    "medicament",
    "hopital",
    "clinique",
    "docteur",
    "consultation",
    "ordonnance",
    "sante",
    "analyse",
    "laboratoire",
  ],
  education: [
    "ecole",
    "ecolage",
    "scolarite",
    "cahier",
    "livre",
    "fourniture",
    "inscription",
    "cours",
    "universite",
    "examen",
    "uniforme",
  ],
  habillement: ["habit", "vetement", "pagne", "tissu", "couture", "chaussure", "sac", "tailleur"],
  loisirs: ["cinema", "sortie", "fete", "jeu", "abonnement sport", "salle de sport", "loisir"],
  famille: ["cadeau", "ceremonie", "mariage", "bapteme", "funeraille", "don", "aide", "famille"],
  maison: ["savon", "detergent", "menage", "gaz", "charbon", "reparation", "bricolage", "meuble"],
};

function texteEnveloppe(e: Enveloppe): string {
  return normaliserQuestion(`${e.nom} ${e.categorie ?? ""} ${e.sousCategorie ?? ""}`);
}

/** Correspondance tolérante d'un mot dans un texte déjà normalisé. */
function contientMot(texte: string, mot: string): boolean {
  if (!mot) return false;
  if (texte.includes(mot)) return true;
  return texte.split(" ").some((t) => t.length >= 4 && ressemble(t, mot));
}

/** 1. Historique : quelle enveloppe l'utilisateur a-t-il déjà choisie pour ce libellé ? */
function parHistorique(mots: string[], transactions: Transaction[]): ClassementEnveloppe | null {
  if (mots.length === 0) return null;
  const scores = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "depense" || !t.categorie) continue;
    const cible = normaliserQuestion(t.libelle);
    let score = 0;
    for (const m of mots) if (contientMot(cible, m)) score += 1;
    if (score === 0) continue;
    // Les dépenses récentes pèsent un peu plus.
    scores.set(t.categorie, (scores.get(t.categorie) ?? 0) + score);
    total += score;
  }
  if (total === 0) return null;
  const meilleur = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!meilleur) return null;
  const confiance = Math.round((meilleur[1] / total) * 100);
  if (confiance < 50) return null;
  return {
    enveloppe: meilleur[0],
    confiance: Math.min(98, confiance),
    raison: `Vous classez habituellement « ${mots[0]} » dans cette enveloppe.`,
    source: "historique",
  };
}

/** 2. Nom, catégorie ou sous-catégorie de l'enveloppe. */
function parNom(mots: string[], enveloppes: Enveloppe[]): ClassementEnveloppe | null {
  let meilleur: { id: string; score: number } | null = null;
  for (const e of enveloppes) {
    const texte = texteEnveloppe(e);
    let score = 0;
    for (const m of mots) if (contientMot(texte, m)) score += 1;
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { id: e.id, score };
  }
  if (!meilleur) return null;
  const env = enveloppes.find((e) => e.id === meilleur.id);
  return {
    enveloppe: meilleur.id,
    confiance: Math.min(90, 55 + meilleur.score * 15),
    raison: `Le libellé correspond au nom de l'enveloppe « ${env?.nom ?? ""} ».`,
    source: "nom",
  };
}

/** 3. Lexique du quotidien, rattaché à l'enveloppe la plus proche de la famille trouvée. */
function parLexique(mots: string[], enveloppes: Enveloppe[]): ClassementEnveloppe | null {
  const familles: string[] = [];
  for (const [famille, termes] of Object.entries(LEXIQUE)) {
    if (termes.some((terme) => mots.some((m) => contientMot(terme, m) || contientMot(m, terme)))) {
      familles.push(famille);
    }
  }
  if (familles.length === 0) return null;
  for (const famille of familles) {
    const cible = enveloppes.find((e) => contientMot(texteEnveloppe(e), famille));
    if (cible) {
      return {
        enveloppe: cible.id,
        confiance: 70,
        raison: `Dépense reconnue comme « ${famille} ».`,
        source: "lexique",
      };
    }
  }
  return null;
}

/**
 * Reconnaît automatiquement l'enveloppe correspondant à un libellé de dépense.
 * Renvoie `null` lorsque rien de sûr n'est trouvé (l'utilisateur choisit alors lui-même).
 */
export function classerDepense(
  libelle: string,
  enveloppes: Enveloppe[],
  transactions: Transaction[],
): ClassementEnveloppe | null {
  const mots = motsPorteurs(libelle).filter((m) => m.length >= 3);
  if (mots.length === 0 || enveloppes.length === 0) return null;

  const candidats = [
    parHistorique(mots, transactions),
    parNom(mots, enveloppes),
    parLexique(mots, enveloppes),
  ].filter(
    (c): c is ClassementEnveloppe => c !== null && enveloppes.some((e) => e.id === c.enveloppe),
  );

  if (candidats.length === 0) return null;
  // L'historique prime, puis la meilleure confiance.
  const ordre = { historique: 0, nom: 1, lexique: 2 } as const;
  candidats.sort((a, b) => ordre[a.source] - ordre[b.source] || b.confiance - a.confiance);
  return candidats[0] ?? null;
}

/**
 * Suggestions d'enveloppes classées par ressemblance du NOM avec le libellé saisi.
 *
 * Contrairement à `classerDepense`, cette fonction renvoie plusieurs pistes :
 * correspondance exacte du nom, début de nom, mot commun, catégorie ou
 * sous-catégorie, puis famille du lexique. Rien ne dépend du montant.
 */
export function suggererEnveloppes(
  libelle: string,
  enveloppes: Enveloppe[],
  transactions: Transaction[] = [],
  maximum = 4,
): ClassementEnveloppe[] {
  const texte = normaliserQuestion(libelle);
  const mots = motsPorteurs(libelle).filter((m) => m.length >= 3);
  if (!texte.trim() || enveloppes.length === 0) return [];

  // Enveloppes déjà utilisées pour des libellés proches : léger bonus.
  const habitudes = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "depense" || !t.categorie) continue;
    const cible = normaliserQuestion(t.libelle);
    if (mots.some((m) => contientMot(cible, m))) {
      habitudes.set(t.categorie, (habitudes.get(t.categorie) ?? 0) + 1);
    }
  }

  const resultats: ClassementEnveloppe[] = [];
  for (const e of enveloppes) {
    const nom = normaliserQuestion(e.nom);
    const cat = normaliserQuestion(e.categorie ?? "");
    const sous = normaliserQuestion(e.sousCategorie ?? "");
    let score = 0;
    let raison = "";

    if (nom && (texte === nom || texte.includes(nom) || nom.includes(texte))) {
      score = 95;
      raison = `Le nom « ${e.nom} » correspond à ce que vous avez écrit.`;
    } else if (mots.some((m) => nom.split(" ").some((n) => n.startsWith(m) || m.startsWith(n)))) {
      score = 82;
      raison = `Le nom « ${e.nom} » commence comme votre libellé.`;
    } else if (mots.some((m) => contientMot(nom, m))) {
      score = 74;
      raison = `Un mot de votre libellé ressemble au nom « ${e.nom} ».`;
    } else if (mots.some((m) => contientMot(cat, m) || contientMot(sous, m))) {
      score = 66;
      raison = `Correspond à la catégorie « ${e.sousCategorie || e.categorie} ».`;
    } else {
      // Famille du lexique du quotidien rattachée à cette enveloppe.
      const texteEnv = texteEnveloppe(e);
      const famille = Object.entries(LEXIQUE).find(
        ([nomFamille, termes]) =>
          contientMot(texteEnv, nomFamille) &&
          termes.some((terme) => mots.some((m) => contientMot(terme, m) || contientMot(m, terme))),
      );
      if (famille) {
        score = 60;
        raison = `Dépense reconnue comme « ${famille[0]} ».`;
      }
    }

    if (score === 0) continue;
    const bonus = Math.min(8, (habitudes.get(e.id) ?? 0) * 2);
    resultats.push({
      enveloppe: e.id,
      confiance: Math.min(99, score + bonus),
      raison,
      source: score >= 66 ? "nom" : "lexique",
    });
  }

  return resultats.sort((a, b) => b.confiance - a.confiance).slice(0, maximum);
}
