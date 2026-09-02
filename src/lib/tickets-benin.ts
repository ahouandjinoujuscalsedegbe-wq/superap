/**
 * Connaissance des tickets, reçus et factures réellement utilisés au Bénin
 * et en Afrique de l'Ouest (zone franc CFA).
 *
 * Ce module ne contient que du savoir local : vocabulaire des reçus manuscrits
 * de boutique et de marché, enseignes et services courants (Mobile Money,
 * SBEE, SONEB, stations-service, pharmacies, écoles, zémidjan…), écriture des
 * montants en francs CFA. Il sert à guider la lecture automatique des photos.
 */

export type ServiceLocal =
  | "mobile_money"
  | "carburant"
  | "electricite"
  | "eau"
  | "telephonie"
  | "alimentation"
  | "marche"
  | "pharmacie"
  | "sante"
  | "transport"
  | "scolarite"
  | "quincaillerie"
  | "restauration"
  | "banque";

export type ContexteBenin = {
  /** Enseigne ou service reconnu sur le document. */
  enseigne?: string;
  service?: ServiceLocal;
  /** Mot-clé d'enveloppe conseillé (à rapprocher des enveloppes de l'utilisateur). */
  categorie?: string;
  /** Sens probable de l'opération vu le vocabulaire du reçu. */
  sens?: "revenu" | "depense";
  /** Frais de service repérés (Mobile Money, retrait, transfert…). */
  frais?: number;
  /** Indices lisibles, affichables à l'utilisateur. */
  indices: string[];
};

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Libellés de total réellement imprimés ou écrits à la main sur les reçus
 * de la sous-région, en plus des libellés français classiques.
 */
export const LIBELLES_TOTAL_LOCAUX = [
  "net a payer",
  "total a payer",
  "total general",
  "montant total",
  "montant du",
  "montant paye",
  "montant percu",
  "somme a payer",
  "somme percue",
  "somme versee",
  "prix total",
  "tout compris",
  "reste a payer",
  "a payer",
  "total ttc",
  "total facture",
  "arrete la presente facture a la somme de",
  "arretee a la somme de",
  "recu la somme de",
  "la somme de",
];

/** Écritures de la devise rencontrées localement. */
export const DEVISES_LOCALES = ["fcfa", "f cfa", "cfa", "xof", "franc", "francs", "frs", "fr cfa"];

type Signature = {
  service: ServiceLocal;
  categorie: string;
  enseigne: string;
  mots: string[];
};

/**
 * Enseignes, opérateurs et services couramment rencontrés au Bénin
 * (et largement présents en Afrique de l'Ouest).
 */
const SIGNATURES: Signature[] = [
  {
    service: "mobile_money",
    categorie: "transfert",
    enseigne: "MTN MoMo",
    mots: ["mtn momo", "momo", "mtn mobile money", "mobile money"],
  },
  {
    service: "mobile_money",
    categorie: "transfert",
    enseigne: "Moov Flooz",
    mots: ["flooz", "moov money", "moov africa"],
  },
  {
    service: "mobile_money",
    categorie: "transfert",
    enseigne: "Celtiis Cash",
    mots: ["celtiis cash", "celtiis"],
  },
  {
    service: "mobile_money",
    categorie: "transfert",
    enseigne: "Wave",
    mots: ["wave", "orange money", "wizall"],
  },
  {
    service: "electricite",
    categorie: "electricite",
    enseigne: "SBEE",
    mots: ["sbee", "societe beninoise d energie", "prepaye", "recharge compteur", "kwh"],
  },
  { service: "eau", categorie: "eau", enseigne: "SONEB", mots: ["soneb", "facture d eau", "m3"] },
  {
    service: "carburant",
    categorie: "transport",
    enseigne: "Station-service",
    mots: [
      "sonacop",
      "oryx",
      "total energies",
      "totalenergies",
      "puma energy",
      "petrolia",
      "jns petro",
      "carburant",
      "essence",
      "gasoil",
      "super sans plomb",
      "kpayo",
    ],
  },
  {
    service: "telephonie",
    categorie: "communication",
    enseigne: "Crédit téléphonique",
    mots: ["credit de communication", "recharge airtime", "forfait internet", "pass internet"],
  },
  {
    service: "alimentation",
    categorie: "alimentation",
    enseigne: "Supermarché",
    mots: [
      "erevan",
      "super u",
      "mahi market",
      "casa del papa",
      "supermarche",
      "alimentation generale",
      "boutique",
      "epicerie",
      "boulangerie",
    ],
  },
  {
    service: "marche",
    categorie: "alimentation",
    enseigne: "Marché",
    mots: [
      "dantokpa",
      "tokpa",
      "marche de",
      "vendeuse",
      "gari",
      "igname",
      "manioc",
      "tomate",
      "piment",
      "poisson",
      "riz local",
      "huile rouge",
    ],
  },
  {
    service: "pharmacie",
    categorie: "sante",
    enseigne: "Pharmacie",
    mots: ["pharmacie", "officine", "ordonnance"],
  },
  {
    service: "sante",
    categorie: "sante",
    enseigne: "Centre de santé",
    mots: ["clinique", "centre de sante", "hopital", "chu", "consultation", "laboratoire"],
  },
  {
    service: "transport",
    categorie: "transport",
    enseigne: "Transport",
    mots: ["zemidjan", "zem", "taxi moto", "taxi", "tricycle", "gare routiere", "bus", "baobab"],
  },
  {
    service: "scolarite",
    categorie: "scolarite",
    enseigne: "École",
    mots: [
      "ecolage",
      "scolarite",
      "frais d inscription",
      "college",
      "lycee",
      "universite",
      "cours du soir",
      "contribution scolaire",
    ],
  },
  {
    service: "quincaillerie",
    categorie: "maison",
    enseigne: "Quincaillerie",
    mots: ["quincaillerie", "ciment", "fer a beton", "tole", "sac de ciment", "materiaux"],
  },
  {
    service: "restauration",
    categorie: "restauration",
    enseigne: "Restauration",
    mots: ["buvette", "maquis", "restaurant", "cafeteria", "tchoukoutou", "gateau", "akassa"],
  },
  {
    service: "banque",
    categorie: "banque",
    enseigne: "Banque / microfinance",
    mots: [
      "ecobank",
      "boa ",
      "bank of africa",
      "uba",
      "nsia banque",
      "orabank",
      "coris",
      "fececam",
      "microfinance",
      "tontine",
      "retrait guichet",
    ],
  },
];

/** Vocabulaire indiquant une entrée d'argent sur un reçu local. */
const MOTS_ENTREE = [
  "recu de",
  "avez recu",
  "vous avez recu",
  "depot",
  "versement recu",
  "paiement recu",
  "credite",
  "encaissement",
  "salaire",
  "vente",
];

/** Vocabulaire indiquant une sortie d'argent. */
const MOTS_SORTIE = [
  "paye a",
  "payez",
  "retrait",
  "transfert a",
  "envoye a",
  "debite",
  "achat",
  "facture",
  "reglement",
  "decaissement",
];

/** Frais de service très fréquents sur les reçus Mobile Money. */
function fraisDeService(texte: string): number | undefined {
  const m = /\b(frais|commission|taxe de service)\b[^\d]{0,20}(\d[\d\s.,]{0,10}\d|\d)/.exec(texte);
  if (!m) return undefined;
  const valeur = Number((m[2] ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(valeur) && valeur > 0 ? valeur : undefined;
}

/** Analyse locale d'un texte de ticket : enseigne, service, sens, frais. */
export function contexteBenin(texte: string): ContexteBenin {
  const t = normaliser(texte)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
  const indices: string[] = [];
  let trouve: Signature | undefined;
  let meilleurScore = 0;

  for (const sig of SIGNATURES) {
    const score = sig.mots.filter((m) => t.includes(m)).length;
    if (score > meilleurScore) {
      meilleurScore = score;
      trouve = sig;
    }
  }

  let sens: ContexteBenin["sens"];
  if (MOTS_ENTREE.some((m) => t.includes(m))) sens = "revenu";
  if (MOTS_SORTIE.some((m) => t.includes(m))) sens = "depense";

  const frais = fraisDeService(t);
  if (trouve) indices.push(`Document reconnu : ${trouve.enseigne}.`);
  if (frais) indices.push(`Frais de service repérés : ${frais} FCFA.`);
  if (sens === "revenu") indices.push("Vocabulaire d'encaissement (reçu, dépôt).");

  return {
    ...(trouve ? { enseigne: trouve.enseigne, service: trouve.service } : {}),
    ...(trouve ? { categorie: trouve.categorie } : {}),
    ...(sens ? { sens } : {}),
    ...(frais ? { frais } : {}),
    indices,
  };
}

/**
 * Les montants en francs CFA n'ont pas de centimes : la plus petite pièce
 * courante est de 5 F. On corrige donc les décimales parasites de l'OCR et on
 * signale les valeurs qui ne tombent pas sur un multiple de 5.
 */
export function normaliserMontantCfa(valeur: number): number {
  return Math.round(valeur);
}

/** Vrai si le montant a la forme habituelle d'un prix en FCFA (multiple de 5). */
export function montantPlausibleCfa(valeur: number): boolean {
  return Number.isInteger(valeur) && valeur >= 5 && valeur % 5 === 0;
}

/** Vrai si la ligne contient un libellé de total tel qu'on l'écrit localement. */
export function ligneTotalLocale(ligne: string): boolean {
  const l = normaliser(ligne);
  return LIBELLES_TOTAL_LOCAUX.some((mot) => l.includes(mot));
}

/** Vrai si la ligne cite la devise, y compris ses écritures locales. */
export function ligneDeviseLocale(ligne: string): boolean {
  const l = normaliser(ligne);
  return DEVISES_LOCALES.some((d) => l.includes(d)) || /\b\d\s*f\b/.test(l);
}
