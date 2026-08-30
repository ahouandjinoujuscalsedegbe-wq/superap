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

/** Extrait le montant le plus probable d'un texte (chiffres ou lettres). */
export function extraireMontant(texte: string): number | null {
  const normalise = sansAccents(texte);

  // Priorité aux lignes qui contiennent « total », « montant » ou « net à payer ».
  const lignes = normalise.split(/\n+/);
  const prioritaires = lignes.filter((l) => /total|montant|net a payer|a payer|somme/.test(l));
  const candidats: number[] = [];

  const collecter = (source: string) => {
    const regex = /(\d[\d\s.,]{0,15}\d|\d)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(source))) {
      const brut = m[1] ?? "";
      // Ignore les dates du type 12/05/2026 déjà consommées ailleurs.
      const nettoye = brut.replace(/[\s.]/g, "").replace(",", ".");
      const valeur = Number(nettoye);
      if (Number.isFinite(valeur) && valeur > 0) candidats.push(Math.round(valeur));
    }
  };

  const sansDates = normalise.replace(/\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4}/g, " ");
  if (prioritaires.length > 0) prioritaires.forEach(collecter);
  if (candidats.length === 0) collecter(sansDates);

  const plausibles = candidats.filter((v) => v >= 10 && v <= 100_000_000);
  if (plausibles.length > 0) return Math.max(...plausibles);

  return nombreDepuisMots(normalise);
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
  const montant = extraireMontant(texte) ?? 0;
  const libelle = extraireLibelle(texte);
  let confiance = 0;
  if (montant > 0) confiance += 0.6;
  if (libelle.length >= 3) confiance += 0.2;
  if (/\d{1,2}[/\-.]\d{1,2}/.test(texte) || /hier/i.test(texte)) confiance += 0.2;

  const indice = devinerEnveloppe(texte, enveloppes);
  return {
    type: extraireType(texte),
    montant,
    date: extraireDate(texte, aujourdHui),
    libelle: libelle || "Opération",
    confiance: Math.min(1, Number(confiance.toFixed(2))),
    ...(indice ? { indiceEnveloppe: indice } : {}),
  };
}
