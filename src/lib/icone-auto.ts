/**
 * Générateur d'icônes (emoji) 100 % local et apprenant.
 *
 * Aucun service externe, aucun modèle téléchargé : un petit lexique français
 * de départ, enrichi par apprentissage à partir des données validées par
 * l'utilisateur (enveloppes créées, opérations enregistrées, comptes ajoutés).
 */

export type Domaine = "enveloppe" | "depense" | "revenu" | "compte";

const CLE_APPRISES = "SA_ICONES_APPRISES_V1";

/** Lexique de départ : mot-clé → emoji. */
const LEXIQUE: { mots: string[]; emoji: string; domaines?: Domaine[] }[] = [
  { mots: ["nourriture", "alimentation", "manger", "repas", "marche", "cuisine"], emoji: "🍲" },
  { mots: ["riz", "mais", "pain", "farine", "cereale"], emoji: "🍚" },
  { mots: ["viande", "poulet", "boeuf", "poisson"], emoji: "🍗" },
  { mots: ["boisson", "eau", "jus", "biere"], emoji: "🥤" },
  { mots: ["transport", "taxi", "zemidjan", "bus", "voyage", "deplacement"], emoji: "🚌" },
  { mots: ["carburant", "essence", "gasoil", "station"], emoji: "⛽" },
  { mots: ["voiture", "moto", "vehicule", "garage", "entretien"], emoji: "🚗" },
  { mots: ["loyer", "maison", "logement", "bail"], emoji: "🏠" },
  { mots: ["electricite", "sbee", "courant", "lumiere"], emoji: "💡" },
  { mots: ["eaux", "soneb", "robinet"], emoji: "🚰" },
  {
    mots: ["internet", "wifi", "connexion", "forfait", "credit", "telephone", "airtime"],
    emoji: "📶",
  },
  { mots: ["sante", "hopital", "clinique", "medicament", "pharmacie", "medecin"], emoji: "🏥" },
  { mots: ["ecole", "scolarite", "education", "universite", "cours", "fourniture"], emoji: "🎓" },
  { mots: ["enfant", "bebe", "couche", "lait"], emoji: "🍼" },
  { mots: ["vetement", "habit", "chaussure", "tissu", "couture"], emoji: "👗" },
  { mots: ["beaute", "coiffure", "salon", "cosmetique"], emoji: "💇" },
  { mots: ["loisir", "sortie", "cinema", "fete", "cadeau", "anniversaire"], emoji: "🎉" },
  { mots: ["eglise", "mosquee", "dime", "offrande", "priere"], emoji: "🙏" },
  { mots: ["epargne", "economie", "reserve", "tontine"], emoji: "🐖" },
  { mots: ["investissement", "business", "commerce", "boutique", "stock"], emoji: "📈" },
  { mots: ["dette", "pret", "emprunt", "remboursement", "credit"], emoji: "🤝" },
  { mots: ["impot", "taxe", "amende", "administration", "papier"], emoji: "🧾" },
  { mots: ["assurance", "securite", "protection"], emoji: "🛡️" },
  { mots: ["salaire", "paie", "traitement", "prime"], emoji: "💼", domaines: ["revenu", "compte"] },
  { mots: ["vente", "recette", "client", "commande"], emoji: "🧺", domaines: ["revenu"] },
  { mots: ["don", "aide", "soutien", "famille"], emoji: "🎁" },
  {
    mots: ["banque", "compte", "bancaire", "ecobank", "uba", "boa"],
    emoji: "🏦",
    domaines: ["compte"],
  },
  { mots: ["momo", "mtn", "moov", "wave", "mobile", "celtiis"], emoji: "📱", domaines: ["compte"] },
  { mots: ["especes", "cash", "liquide", "caisse"], emoji: "💵", domaines: ["compte"] },
  { mots: ["carte", "visa", "virtuelle"], emoji: "💳", domaines: ["compte"] },
];

const DEFAUTS: Record<Domaine, string> = {
  enveloppe: "💡",
  depense: "🧾",
  revenu: "💰",
  compte: "👛",
};

/** Découpe un libellé en mots normalisés (sans accents, sans ponctuation). */
export function motsCles(texte: string): string[] {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((m) => m.trim())
    .filter((m) => m.length >= 3);
}

type Appris = Record<string, Record<string, number>>;

function lireApprises(): Appris {
  if (typeof localStorage === "undefined") return {};
  try {
    const brut = localStorage.getItem(CLE_APPRISES);
    const objet: unknown = brut ? JSON.parse(brut) : {};
    return objet && typeof objet === "object" ? (objet as Appris) : {};
  } catch {
    return {};
  }
}

function ecrireApprises(a: Appris) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLE_APPRISES, JSON.stringify(a));
  } catch {
    /* stockage plein : l'apprentissage reste en mémoire pour la session */
  }
}

/**
 * Apprend l'association mot-clé → emoji à partir d'une donnée validée par
 * l'utilisateur. Plus une association est confirmée, plus elle pèse.
 */
export function apprendreIcone(texte: string, emoji: string) {
  const propre = emoji.trim();
  if (!propre) return;
  const appris = lireApprises();
  for (const mot of motsCles(texte)) {
    const scores = appris[mot] ?? {};
    scores[propre] = (scores[propre] ?? 0) + 1;
    appris[mot] = scores;
  }
  ecrireApprises(appris);
}

/** Réapprend à partir de toutes les enveloppes déjà validées. */
export function apprendreDepuisEnveloppes(enveloppes: { nom: string; emoji: string }[]) {
  for (const e of enveloppes) apprendreIcone(e.nom, e.emoji);
}

export type SuggestionIcone = { emoji: string; source: "appris" | "lexique" | "defaut" };

/** Propose une icône pour un libellé, en privilégiant ce qui a été appris. */
export function suggererIconeDetail(
  texte: string,
  domaine: Domaine = "enveloppe",
): SuggestionIcone {
  const mots = motsCles(texte);
  if (mots.length > 0) {
    const appris = lireApprises();
    const cumul = new Map<string, number>();
    for (const mot of mots) {
      for (const [emoji, score] of Object.entries(appris[mot] ?? {})) {
        cumul.set(emoji, (cumul.get(emoji) ?? 0) + score);
      }
    }
    let meilleur: { emoji: string; score: number } | null = null;
    for (const [emoji, score] of cumul) {
      if (!meilleur || score > meilleur.score) meilleur = { emoji, score };
    }
    if (meilleur && meilleur.score >= 1) return { emoji: meilleur.emoji, source: "appris" };

    for (const entree of LEXIQUE) {
      if (entree.domaines && !entree.domaines.includes(domaine)) continue;
      if (entree.mots.some((m) => mots.some((mot) => mot.includes(m) || m.includes(mot)))) {
        return { emoji: entree.emoji, source: "lexique" };
      }
    }
    // Deuxième passe, tous domaines confondus.
    for (const entree of LEXIQUE) {
      if (entree.mots.some((m) => mots.some((mot) => mot.includes(m) || m.includes(mot)))) {
        return { emoji: entree.emoji, source: "lexique" };
      }
    }
  }
  return { emoji: DEFAUTS[domaine], source: "defaut" };
}

/** Icône proposée pour un libellé donné. */
export function suggererIcone(texte: string, domaine: Domaine = "enveloppe"): string {
  return suggererIconeDetail(texte, domaine).emoji;
}

/** Palettes de secours proposées quand le lexique ne suffit pas. */
const PALETTES: Record<Domaine, string[]> = {
  enveloppe: ["💡", "🧾", "🍲", "🚌", "🏠", "🏥", "🎓", "👗", "🎉", "🐖", "📶", "🙏"],
  depense: ["🧾", "🛒", "🚕", "💊", "🍔", "⛽", "🔧", "📚"],
  revenu: ["💰", "💼", "🧺", "📈", "🎁", "🤝"],
  compte: ["👛", "🏦", "📱", "💵", "💳", "🐖", "🏧", "🧰", "💎", "🪙"],
};

/**
 * Propose plusieurs icônes pertinentes pour un libellé : d'abord ce qui a été
 * appris, puis le lexique, puis une palette du domaine. Sans doublon.
 */
export function suggererIcones(texte: string, domaine: Domaine = "enveloppe", nombre = 8): string[] {
  const sortie: string[] = [];
  const ajouter = (e: string) => {
    if (e && !sortie.includes(e) && sortie.length < nombre) sortie.push(e);
  };
  const mots = motsCles(texte);
  if (mots.length > 0) {
    ajouter(suggererIcone(texte, domaine));
    for (const entree of LEXIQUE) {
      if (entree.domaines && !entree.domaines.includes(domaine)) continue;
      if (entree.mots.some((m) => mots.some((mot) => mot.includes(m) || m.includes(mot))))
        ajouter(entree.emoji);
    }
    for (const entree of LEXIQUE) {
      if (entree.mots.some((m) => mots.some((mot) => mot.includes(m) || m.includes(mot))))
        ajouter(entree.emoji);
    }
  }
  for (const e of PALETTES[domaine]) ajouter(e);
  return sortie;
}
