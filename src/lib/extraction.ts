/**
 * Analyse de texte libre (OCR de ticket ou dictée vocale) pour en extraire
 * une opération : type, montant, date et libellé. Fonctions pures, testables.
 */

export type OperationExtraite = {
  type: "revenu" | "depense";
  montant: number;
  date: string; // ISO yyyy-mm-dd
  libelle: string;
  /** Indice de confiance de 0 à 1. */
  confiance: number;
  /** Enveloppe devinée d'après les mots-clés, si trouvée. */
  indiceEnveloppe?: string;
  /** D'où vient le montant retenu (total, paiement, articles…). */
  sourceMontant?: "total" | "paiement" | "articles" | "devise" | "maximum" | "mots" | "aucun";
  /** Explication lisible du montant retenu. */
  explicationMontant?: string;
  /** Recoupement du total avec les autres indices du ticket. */
  coherence?: "verifiee" | "incoherente" | "inconnue";
};

const MOTS_REVENU = [
  "revenu",
  "salaire",
  "recu",
  "reçu de",
  "encaisse",
  "encaissement",
  "entree",
  "entrée",
  "gain",
  "prime",
  "vente",
  "credit",
  "crédit",
];

const MOTS_DEPENSE = [
  "depense",
  "dépense",
  "achat",
  "paye",
  "payé",
  "paiement",
  "facture",
  "ticket",
  "total",
  "debit",
  "débit",
  "sortie",
];

const MOIS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

/** Multiplicateurs oraux : « cinq mille » → 5000. */
const NOMBRES: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
  cents: 100,
};

export function sansAccents(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Convertit une expression orale simple en nombre : « cinq mille deux cents ». */
export function nombreDepuisMots(texte: string): number | null {
  const mots = sansAccents(texte)
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let total = 0;
  let courant = 0;
  let trouve = false;
  for (const mot of mots) {
    if (mot === "mille" || mot === "milles") {
      total += (courant || 1) * 1000;
      courant = 0;
      trouve = true;
      continue;
    }
    if (mot === "million" || mot === "millions") {
      total += (courant || 1) * 1_000_000;
      courant = 0;
      trouve = true;
      continue;
    }
    const valeur = NOMBRES[mot];
    if (valeur === undefined) continue;
    trouve = true;
    if (valeur === 100) courant = (courant || 1) * 100;
    else courant += valeur;
  }
  if (!trouve) return null;
  const somme = total + courant;
  return somme > 0 ? somme : null;
}

/** Lignes à ne jamais confondre avec le total payé. */
const LIGNES_EXCLUES =
  /\b(rendu|monnaie|espece|especes|cash|recu client|a rendu|tva|t\.v\.a|taxe|remise|reduction|ristourne|quantite|qte|tel|telephone|rccm|ifu|nif|carte|reference|ref|caisse|heure|code|solde de points|fidelite)\b/;

/** Lignes qui désignent explicitement la somme à payer. */
const LIGNES_TOTAL =
  /\b(total\s*(ttc|general|a\s*payer|net)?|net\s*a\s*payer|montant\s*(total|du|a\s*payer)?|somme\s*a?\s*payer|ttc|a\s*payer)\b/;

/**
 * Convertit un nombre écrit sur un ticket en valeur numérique.
 * Gère « 12 500 », « 1.250.000 », « 1 234,56 » et « 12,500.50 ».
 */
export function parseMontant(brut: string): number | null {
  const nettoye = brut.replace(/\s/g, "").replace(/[^\d.,]/g, "");
  if (!nettoye) return null;
  const dernierPoint = nettoye.lastIndexOf(".");
  const derniereVirgule = nettoye.lastIndexOf(",");
  const sep = Math.max(dernierPoint, derniereVirgule);
  let valeur: number;
  if (sep === -1) {
    valeur = Number(nettoye);
  } else {
    const decimales = nettoye.length - sep - 1;
    const groupes = nettoye.slice(0, sep).split(/[.,]/);
    const separateurMillier =
      decimales === 3 && groupes.every((g, idx) => idx === 0 || g.length === 3);
    if (separateurMillier) {
      valeur = Number(nettoye.replace(/[.,]/g, ""));
    } else {
      const entier = nettoye.slice(0, sep).replace(/[.,]/g, "");
      valeur = Number(`${entier}.${nettoye.slice(sep + 1)}`);
    }
  }
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return Math.round(valeur);
}

/**
 * Corrige les confusions classiques de l'OCR à l'intérieur des nombres :
 * O/o → 0, l/I → 1, S → 5, B → 8, G → 6, Z → 2. La correction n'est appliquée
 * qu'entre des chiffres ou en bordure d'un groupe de chiffres, jamais dans un mot.
 */
export function corrigerConfusionsOcr(ligne: string): string {
  const table: Record<string, string> = {
    o: "0",
    O: "0",
    l: "1",
    I: "1",
    "|": "1",
    S: "5",
    B: "8",
    G: "6",
    Z: "2",
  };
  return ligne.replace(/[\dOolI|SBGZ]{2,}/g, (bloc) => {
    const converti = bloc.replace(/[OolI|SBGZ]/g, (c) => table[c] ?? c);
    // On ne garde la conversion que si le bloc contient déjà un chiffre et
    // devient entièrement numérique : « 1OOO » → « 1000 », « Boulangerie » reste.
    const chiffres = (bloc.match(/\d/g) ?? []).length;
    return chiffres >= 1 && /^\d+$/.test(converti) ? converti : bloc;
  });
}

/** Tous les nombres monétaires plausibles d'une ligne. */
export function montantsDeLigne(ligne: string): number[] {
  const sansDates = corrigerConfusionsOcr(ligne)
    .replace(/\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, " ")
    .replace(/\d{1,2}\s*[h:]\s*\d{2}/g, " ")
    // Codes-barres, références longues et numéros de téléphone : pas des montants.
    .replace(/\b\d{9,}\b/g, " ");
  const trouves: number[] = [];
  const regex = /\d[\d\s.,]{0,15}\d|\d/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(sansDates))) {
    const valeur = parseMontant(m[0]);
    if (valeur !== null) trouves.push(valeur);
  }
  return trouves;
}

/** Vrai si la ligne cite explicitement la devise (fcfa, xof, f cfa, francs). */
export function ligneAvecDevise(ligne: string): boolean {
  return /\b(fcfa|xof|cfa|francs?|f\s*cfa)\b/.test(sansAccents(ligne));
}

/** Structure décodée d'un ticket : lignes d'articles, total annoncé, TVA. */
export type StructureTicket = {
  lignes: string[];
  articles: { libelle: string; montant: number }[];
  totalAnnonce: number | null;
  tva: number | null;
  sousTotal: number | null;
  especes: number | null;
  rendu: number | null;
  /** Cohérence entre le total annoncé et les autres indices du ticket. */
  coherence: "verifiee" | "incoherente" | "inconnue";
  /** Explication courte du montant retenu, affichable à l'utilisateur. */
  explication?: string;
};

export function structurerTicket(texte: string): StructureTicket {
  const lignes = sansAccents(texte)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const articles: { libelle: string; montant: number }[] = [];
  let totalAnnonce: number | null = null;
  let tva: number | null = null;
  let sousTotal: number | null = null;
  let especes: number | null = null;
  let rendu: number | null = null;

  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i] as string;
    const montants = montantsDeLigne(ligne);
    let dernier = montants.length > 0 ? (montants[montants.length - 1] as number) : null;

    // Étiquette seule sur sa ligne (« TOTAL A PAYER ») : le montant est sur la suivante.
    if (dernier === null && LIGNES_TOTAL.test(ligne) && !LIGNES_EXCLUES.test(ligne)) {
      const suite = montantsDeLigne(lignes[i + 1] ?? "");
      dernier = suite.length > 0 ? (suite[suite.length - 1] as number) : null;
      if (dernier !== null) i += 1;
    }
    if (dernier === null) continue;

    if (/\b(tva|t\.v\.a|taxe)\b/.test(ligne)) {
      tva = tva ?? dernier;
      continue;
    }
    if (/\b(sous[- ]?total|total\s*ht|montant\s*ht)\b/.test(ligne)) {
      sousTotal = sousTotal ?? dernier;
      continue;
    }
    if (/\b(espece|especes|cash|recu client|regle|paye en)\b/.test(ligne)) {
      especes = especes ?? dernier;
      continue;
    }
    if (/\b(rendu|monnaie)\b/.test(ligne)) {
      rendu = rendu ?? dernier;
      continue;
    }
    if (LIGNES_TOTAL.test(ligne) && !LIGNES_EXCLUES.test(ligne)) {
      totalAnnonce = Math.max(totalAnnonce ?? 0, dernier) || dernier;
      continue;
    }
    if (LIGNES_EXCLUES.test(ligne)) continue;
    // Ligne d'article : du texte suivi d'un montant.
    if (/[a-z]{3,}/.test(ligne) && dernier >= 10) {
      articles.push({ libelle: ligne.replace(/[\d\s.,]+$/, "").trim(), montant: dernier });
    }
  }

  // Recoupement : total annoncé ↔ somme des articles ↔ espèces − monnaie rendue.
  const sommeArticles = articles.reduce((s, a) => s + a.montant, 0);
  const paiement = especes !== null && rendu !== null ? especes - rendu : null;
  let coherence: StructureTicket["coherence"] = "inconnue";
  if (totalAnnonce !== null) {
    const references = [
      articles.length >= 2 ? sommeArticles : null,
      paiement,
      sousTotal !== null && tva !== null ? sousTotal + tva : null,
    ].filter((v): v is number => v !== null && v > 0);
    if (references.length > 0) {
      const proche = references.some((r) => Math.abs(r - totalAnnonce) <= Math.max(2, r * 0.02));
      coherence = proche ? "verifiee" : "incoherente";
    }
  }

  return { lignes, articles, totalAnnonce, tva, sousTotal, especes, rendu, coherence };
}

/** Extrait le montant le plus probable d'un texte (chiffres ou lettres). */
export function extraireMontant(texte: string): number | null {
  return detaillerMontant(texte).montant;
}

/** Montant retenu, sa provenance et une explication lisible. */
export function detaillerMontant(texte: string): {
  montant: number | null;
  source: "total" | "paiement" | "articles" | "devise" | "maximum" | "mots" | "aucun";
  explication: string;
  coherence: StructureTicket["coherence"];
} {
  const normalise = sansAccents(texte);
  const structure = structurerTicket(texte);

  const plausible = (v: number | null): v is number => v !== null && v >= 10 && v <= 100_000_000;
  const paiement =
    structure.especes !== null && structure.rendu !== null
      ? structure.especes - structure.rendu
      : null;
  const sommeArticles = structure.articles.reduce((s, a) => s + a.montant, 0);

  if (plausible(structure.totalAnnonce)) {
    // Total illisible ou incohérent : on privilégie le recoupement par le paiement.
    if (structure.coherence === "incoherente" && plausible(paiement)) {
      return {
        montant: paiement,
        source: "paiement",
        explication: `Total lu (${structure.totalAnnonce}) incohérent : montant recoupé par espèces − monnaie rendue.`,
        coherence: structure.coherence,
      };
    }
    return {
      montant: structure.totalAnnonce,
      source: "total",
      explication:
        structure.coherence === "verifiee"
          ? "Total du ticket recoupé avec les articles ou le paiement."
          : "Total explicitement indiqué sur le ticket.",
      coherence: structure.coherence,
    };
  }

  if (plausible(paiement)) {
    return {
      montant: paiement,
      source: "paiement",
      explication: "Montant déduit des espèces remises moins la monnaie rendue.",
      coherence: structure.coherence,
    };
  }

  if (structure.articles.length >= 2 && plausible(sommeArticles)) {
    return {
      montant: sommeArticles,
      source: "articles",
      explication: `Somme des ${structure.articles.length} articles détectés.`,
      coherence: structure.coherence,
    };
  }

  // Ligne citant la devise : indice fort du montant payé.
  const avecDevise = structure.lignes
    .filter((l) => ligneAvecDevise(l) && !LIGNES_EXCLUES.test(l))
    .flatMap(montantsDeLigne)
    .filter((v) => v >= 10 && v <= 100_000_000);
  if (avecDevise.length > 0) {
    return {
      montant: Math.max(...avecDevise),
      source: "devise",
      explication: "Montant repéré à côté de la devise (FCFA).",
      coherence: structure.coherence,
    };
  }

  const candidats = structure.lignes
    .filter((l) => !LIGNES_EXCLUES.test(l))
    .flatMap(montantsDeLigne)
    .filter((v) => v >= 10 && v <= 100_000_000);
  if (candidats.length > 0) {
    return {
      montant: Math.max(...candidats),
      source: "maximum",
      explication: "Aucun total identifié : plus grand montant lisible retenu. À vérifier.",
      coherence: structure.coherence,
    };
  }

  const enMots = nombreDepuisMots(normalise);
  return enMots !== null
    ? {
        montant: enMots,
        source: "mots",
        explication: "Montant écrit en toutes lettres.",
        coherence: structure.coherence,
      }
    : {
        montant: null,
        source: "aucun",
        explication: "Aucun montant lisible.",
        coherence: structure.coherence,
      };
}

/** Extrait une date du texte, sinon retourne la date du jour. */
export function extraireDate(texte: string, aujourdHui = new Date()): string {
  const t = sansAccents(texte);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (/\bhier\b/.test(t)) {
    const d = new Date(aujourdHui);
    d.setDate(d.getDate() - 1);
    return iso(d);
  }
  if (/avant[- ]hier/.test(t)) {
    const d = new Date(aujourdHui);
    d.setDate(d.getDate() - 2);
    return iso(d);
  }

  const numerique = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (numerique) {
    const jour = Number(numerique[1]);
    const mois = Number(numerique[2]);
    let annee = Number(numerique[3]);
    if (annee < 100) annee += 2000;
    if (jour >= 1 && jour <= 31 && mois >= 1 && mois <= 12) {
      return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
    }
  }

  const litterale = t.match(
    /(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s*(\d{4})?/,
  );
  if (litterale) {
    const jour = Number(litterale[1]);
    const mois = MOIS[litterale[2] ?? ""] ?? 1;
    const annee = litterale[3] ? Number(litterale[3]) : aujourdHui.getFullYear();
    return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  }

  return iso(aujourdHui);
}

/** Détermine s'il s'agit d'un revenu ou d'une dépense. */
export function extraireType(texte: string): "revenu" | "depense" {
  const t = sansAccents(texte);
  const revenu = MOTS_REVENU.filter((m) => t.includes(sansAccents(m))).length;
  const depense = MOTS_DEPENSE.filter((m) => t.includes(sansAccents(m))).length;
  return revenu > depense ? "revenu" : "depense";
}

/** Devine le libellé : nom du commerçant (OCR) ou objet dicté. */
export function extraireLibelle(texte: string): string {
  const lignes = texte
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  // Dictée : une seule ligne → on retire les mots outils et le montant.
  if (lignes.length <= 1) {
    const brut = (lignes[0] ?? "").trim();
    const nettoye = brut
      .replace(/\d[\d\s.,]*/g, " ")
      .replace(
        /\b(depense|dépense|revenu|de|du|des|le|la|les|un|une|pour|francs?|fcfa|cfa|f|aujourd'hui|hier|ajoute|ajouter|note|noter)\b/gi,
        " ",
      )
      .replace(
        /\b(mille|milles|million|millions|cent|cents|zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|quarante|cinquante|soixante)\b/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    return nettoye || brut;
  }

  // Ticket : la première ligne alphabétique significative est le commerçant.
  const entete = lignes.find((l) => /[a-zA-ZÀ-ÿ]{3,}/.test(l) && !/total|facture|ticket/i.test(l));
  return (entete ?? lignes[0] ?? "").slice(0, 60).trim();
}

/** Devine l'enveloppe à partir de mots-clés du texte. */
export function devinerEnveloppe(
  texte: string,
  enveloppes: { id: string; nom: string; categorie?: string; sousCategorie?: string }[],
): string | undefined {
  const t = sansAccents(texte);
  for (const e of enveloppes) {
    const cles = [e.nom, e.categorie ?? "", e.sousCategorie ?? ""]
      .map((c) => sansAccents(c))
      .filter((c) => c.length >= 4);
    if (cles.some((c) => t.includes(c))) return e.id;
  }
  return undefined;
}

/** Analyse complète d'un texte OCR ou dicté. */
export function analyserTexte(
  texte: string,
  enveloppes: { id: string; nom: string; categorie?: string; sousCategorie?: string }[] = [],
  aujourdHui = new Date(),
): OperationExtraite {
  const detail = detaillerMontant(texte);
  const montant = detail.montant ?? 0;
  const libelle = extraireLibelle(texte);
  let confiance = 0;
  if (montant > 0) confiance += 0.5;
  if (libelle.length >= 3) confiance += 0.15;
  if (/\d{1,2}[/\-.]\d{1,2}/.test(texte) || /hier/i.test(texte)) confiance += 0.15;
  // La provenance du montant pèse plus que sa simple présence.
  if (detail.source === "total" || detail.source === "paiement") confiance += 0.15;
  if (detail.source === "articles") confiance += 0.05;
  if (detail.source === "maximum") confiance -= 0.2;
  if (detail.coherence === "verifiee") confiance += 0.1;
  if (detail.coherence === "incoherente") confiance -= 0.15;

  const indice = devinerEnveloppe(texte, enveloppes);
  return {
    type: extraireType(texte),
    montant,
    date: extraireDate(texte, aujourdHui),
    libelle: libelle || "Opération",
    confiance: Math.max(0, Math.min(1, Number(confiance.toFixed(2)))),
    sourceMontant: detail.source,
    explicationMontant: detail.explication,
    coherence: detail.coherence,
    ...(indice ? { indiceEnveloppe: indice } : {}),
  };
}
