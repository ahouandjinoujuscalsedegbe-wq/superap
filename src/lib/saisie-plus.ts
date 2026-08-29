/**
 * Extensions du module Saisie intelligente :
 * prétraitement d'image, mémoire commerçant → enveloppe, historique et galerie
 * de tickets, détection de doublons et d'opérations récurrentes, découpage de
 * plusieurs opérations dictées, commandes vocales de navigation et lecture
 * vocale du résumé. Fonctions pures ou isolées, sans dépendance à React.
 */

import { analyserTexte, sansAccents, type OperationExtraite } from "@/lib/extraction";

/* ------------------------------------------------------------------ */
/* 1. Prétraitement d'image (contraste, niveaux de gris, redimension)  */
/* ------------------------------------------------------------------ */

export type ImagePreparee = { blob: Blob; apercu: string };

function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = url;
  });
}

/**
 * Convertit la photo en niveaux de gris contrastés et la redimensionne pour
 * accélérer et fiabiliser l'OCR. Retourne aussi une vignette pour la galerie.
 */
export async function preparerImage(fichier: File, largeurMax = 1400): Promise<ImagePreparee> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(url);
    const ratio = Math.min(1, largeurMax / (img.naturalWidth || largeurMax));
    const largeur = Math.max(1, Math.round((img.naturalWidth || largeurMax) * ratio));
    const hauteur = Math.max(1, Math.round((img.naturalHeight || largeurMax) * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: fichier, apercu: await enDataUrl(fichier) };
    ctx.drawImage(img, 0, 0, largeur, hauteur);

    const data = ctx.getImageData(0, 0, largeur, hauteur);
    const px = data.data;
    // Moyenne de luminance pour un seuillage adaptatif doux.
    let somme = 0;
    for (let i = 0; i < px.length; i += 4) {
      somme += 0.299 * (px[i] ?? 0) + 0.587 * (px[i + 1] ?? 0) + 0.114 * (px[i + 2] ?? 0);
    }
    const moyenne = somme / (px.length / 4);
    const contraste = 1.35;
    for (let i = 0; i < px.length; i += 4) {
      const gris = 0.299 * (px[i] ?? 0) + 0.587 * (px[i + 1] ?? 0) + 0.114 * (px[i + 2] ?? 0);
      const ajuste = Math.max(0, Math.min(255, (gris - moyenne) * contraste + moyenne));
      px[i] = ajuste;
      px[i + 1] = ajuste;
      px[i + 2] = ajuste;
    }
    ctx.putImageData(data, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    const apercu = miniature(canvas);
    return { blob: blob ?? fichier, apercu };
  } catch {
    return { blob: fichier, apercu: await enDataUrl(fichier) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function miniature(canvas: HTMLCanvasElement, largeur = 160): string {
  const petit = document.createElement("canvas");
  const ratio = largeur / canvas.width;
  petit.width = largeur;
  petit.height = Math.max(1, Math.round(canvas.height * ratio));
  const ctx = petit.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(canvas, 0, 0, petit.width, petit.height);
  return petit.toDataURL("image/jpeg", 0.6);
}

function enDataUrl(fichier: Blob): Promise<string> {
  return new Promise((resolve) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result ?? ""));
    lecteur.onerror = () => resolve("");
    lecteur.readAsDataURL(fichier);
  });
}

/* ------------------------------------------------------------------ */
/* 2. Mémoire commerçant → enveloppe                                    */
/* ------------------------------------------------------------------ */

const CLE_MEMOIRE = "superapp:saisie:memoire:v1";

export type Memoire = Record<string, { enveloppe: string; occurrences: number }>;

export function cleCommercant(libelle: string): string {
  return sansAccents(libelle)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export function lireMemoire(): Memoire {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.localStorage.getItem(CLE_MEMOIRE);
    return brut ? (JSON.parse(brut) as Memoire) : {};
  } catch {
    return {};
  }
}

export function apprendreEnveloppe(libelle: string, enveloppe: string): void {
  if (typeof window === "undefined") return;
  const cle = cleCommercant(libelle);
  if (!cle || !enveloppe) return;
  const memoire = lireMemoire();
  const existant = memoire[cle];
  memoire[cle] =
    existant && existant.enveloppe === enveloppe
      ? { enveloppe, occurrences: existant.occurrences + 1 }
      : { enveloppe, occurrences: 1 };
  try {
    window.localStorage.setItem(CLE_MEMOIRE, JSON.stringify(memoire));
  } catch {
    /* quota dépassé : la mémoire reste optionnelle */
  }
}

export function oublierEnveloppe(cle: string): void {
  if (typeof window === "undefined") return;
  const memoire = lireMemoire();
  delete memoire[cle];
  try {
    window.localStorage.setItem(CLE_MEMOIRE, JSON.stringify(memoire));
  } catch {
    /* ignoré */
  }
}

/** Suggère une enveloppe déjà apprise pour ce libellé (correspondance partielle). */
export function suggererEnveloppe(libelle: string, memoire = lireMemoire()): string | undefined {
  const cle = cleCommercant(libelle);
  if (!cle) return undefined;
  if (memoire[cle]) return memoire[cle].enveloppe;
  let meilleur: { enveloppe: string; score: number } | undefined;
  for (const [connu, valeur] of Object.entries(memoire)) {
    if (connu.length < 4) continue;
    if (cle.includes(connu) || connu.includes(cle)) {
      const score = connu.length + valeur.occurrences;
      if (!meilleur || score > meilleur.score) meilleur = { enveloppe: valeur.enveloppe, score };
    }
  }
  return meilleur?.enveloppe;
}

/* ------------------------------------------------------------------ */
/* 3. Historique des saisies + galerie de tickets                       */
/* ------------------------------------------------------------------ */

const CLE_HISTORIQUE = "superapp:saisie:historique:v1";
const MAX_HISTORIQUE = 40;

export type SaisieHistorique = {
  id: string;
  date: string; // ISO complet de l'enregistrement
  source: "ocr" | "dictee" | "manuel";
  type: "revenu" | "depense";
  montant: number;
  libelle: string;
  dateOperation: string;
  enveloppe?: string;
  compte: string;
  texte: string;
  vignette?: string;
};

export function lireHistoriqueSaisies(): SaisieHistorique[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_HISTORIQUE);
    const liste = brut ? (JSON.parse(brut) as SaisieHistorique[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrireHistorique(liste: SaisieHistorique[]): SaisieHistorique[] {
  if (typeof window === "undefined") return liste;
  try {
    window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(liste));
  } catch {
    // Quota dépassé : on retente sans les vignettes, plus lourdes.
    const allege = liste.map(({ vignette: _v, ...reste }) => reste);
    try {
      window.localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(allege));
      return allege;
    } catch {
      /* ignoré */
    }
  }
  return liste;
}

export function ajouterHistoriqueSaisie(
  entree: Omit<SaisieHistorique, "id" | "date">,
): SaisieHistorique[] {
  const liste = [
    {
      ...entree,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    },
    ...lireHistoriqueSaisies(),
  ].slice(0, MAX_HISTORIQUE);
  return ecrireHistorique(liste);
}

export function supprimerHistoriqueSaisie(id: string): SaisieHistorique[] {
  return ecrireHistorique(lireHistoriqueSaisies().filter((s) => s.id !== id));
}

export function viderHistoriqueSaisies(): SaisieHistorique[] {
  return ecrireHistorique([]);
}

/* ------------------------------------------------------------------ */
/* 4. Doublons et récurrences                                           */
/* ------------------------------------------------------------------ */

export type OperationSimple = {
  id: string;
  type: "revenu" | "depense";
  montant: number;
  libelle: string;
  date: string;
};

const JOUR = 86_400_000;

function joursEntre(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(da - db) / JOUR;
}

/** Détecte une opération déjà enregistrée : même montant, libellé proche, ≤ 3 jours. */
export function detecterDoublon(
  operations: OperationSimple[],
  candidate: { type: "revenu" | "depense"; montant: number; libelle: string; date: string },
  toleranceJours = 3,
): OperationSimple | undefined {
  const cle = cleCommercant(candidate.libelle);
  return operations.find((o) => {
    if (o.type !== candidate.type) return false;
    if (Math.abs(o.montant - candidate.montant) > 1) return false;
    if (joursEntre(o.date, candidate.date) > toleranceJours) return false;
    const autre = cleCommercant(o.libelle);
    if (!cle || !autre) return true;
    return cle === autre || cle.includes(autre) || autre.includes(cle);
  });
}

export type Recurrence = {
  occurrences: number;
  intervalleMoyen: number; // en jours
  montantMoyen: number;
  prochaineDate: string;
  libelle: string;
};

/** Détecte une dépense récurrente à partir de l'historique du même libellé. */
export function detecterRecurrence(
  operations: OperationSimple[],
  candidate: { libelle: string; type: "revenu" | "depense"; date: string },
): Recurrence | undefined {
  const cle = cleCommercant(candidate.libelle);
  if (cle.length < 3) return undefined;
  const semblables = operations
    .filter((o) => o.type === candidate.type)
    .filter((o) => {
      const autre = cleCommercant(o.libelle);
      return autre.length >= 3 && (autre === cle || autre.includes(cle) || cle.includes(autre));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (semblables.length < 2) return undefined;

  const ecarts: number[] = [];
  for (let i = 1; i < semblables.length; i += 1) {
    const precedent = semblables[i - 1];
    const courant = semblables[i];
    if (!precedent || !courant) continue;
    ecarts.push(joursEntre(precedent.date, courant.date));
  }
  const valides = ecarts.filter((e) => Number.isFinite(e) && e > 0);
  if (valides.length === 0) return undefined;
  const intervalleMoyen = Math.round(valides.reduce((s, v) => s + v, 0) / valides.length);
  if (intervalleMoyen < 1 || intervalleMoyen > 400) return undefined;

  const montantMoyen = Math.round(
    semblables.reduce((s, o) => s + o.montant, 0) / semblables.length,
  );
  const derniere = semblables[semblables.length - 1]!;
  const prochaine = new Date(new Date(derniere.date).getTime() + intervalleMoyen * JOUR);

  return {
    occurrences: semblables.length,
    intervalleMoyen,
    montantMoyen,
    prochaineDate: prochaine.toISOString().slice(0, 10),
    libelle: derniere.libelle,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Découpage de plusieurs opérations dictées                         */
/* ------------------------------------------------------------------ */

const SEPARATEURS = /\n+|\s+(?:puis|ensuite|et aussi|également|egalement)\s+/gi;

/** Découpe un texte dicté en plusieurs opérations distinctes. */
export function decouperOperations(texte: string): string[] {
  const morceaux = texte
    .split(SEPARATEURS)
    .map((m) => m.trim())
    .filter((m) => m.length > 2);
  return morceaux.length > 0 ? morceaux : [texte.trim()].filter(Boolean);
}

/** Analyse un texte pouvant contenir plusieurs opérations. */
export function analyserPlusieurs(
  texte: string,
  enveloppes: { id: string; nom: string; categorie?: string; sousCategorie?: string }[] = [],
  aujourdHui = new Date(),
): OperationExtraite[] {
  const morceaux = decouperOperations(texte);
  const resultats = morceaux
    .map((m) => analyserTexte(m, enveloppes, aujourdHui))
    .filter((r) => r.montant > 0);
  return resultats.length > 0 ? resultats : [analyserTexte(texte, enveloppes, aujourdHui)];
}

/* ------------------------------------------------------------------ */
/* 6. Commandes vocales de navigation                                   */
/* ------------------------------------------------------------------ */

export type CommandeVocale = { chemin: string; libelle: string };

const COMMANDES: { motifs: string[]; chemin: string; libelle: string }[] = [
  { motifs: ["accueil", "page d'accueil", "tableau de bord"], chemin: "/", libelle: "Accueil" },
  { motifs: ["enveloppe", "enveloppes"], chemin: "/enveloppes", libelle: "Enveloppes" },
  { motifs: ["compte", "comptes"], chemin: "/comptes", libelle: "Comptes" },
  { motifs: ["analyse", "analyses", "conseil", "conseils"], chemin: "/analyses", libelle: "Analyses et conseils" },
  { motifs: ["outil", "outils", "simulation", "simulateur"], chemin: "/outils", libelle: "Outils et simulation" },
  { motifs: ["dette", "dettes", "creance", "creances"], chemin: "/dettes", libelle: "Dettes et créances" },
  { motifs: ["parametre", "parametres", "reglage", "reglages"], chemin: "/parametres", libelle: "Paramètres" },
  { motifs: ["aide", "assistance"], chemin: "/aide", libelle: "Aide" },
  { motifs: ["revenu", "nouveau revenu"], chemin: "/revenu", libelle: "Revenu" },
  { motifs: ["depense", "nouvelle depense"], chemin: "/depense", libelle: "Dépense" },
];

/** Reconnaît « ouvre les enveloppes », « va à l'accueil », « affiche les comptes ». */
export function reconnaitreCommande(texte: string): CommandeVocale | undefined {
  const t = sansAccents(texte).trim();
  const declencheur = /^(ouvre|ouvrir|va(?:\s+a|\s+vers)?|aller\s+a|affiche|afficher|montre|montrer|navigue\s+vers)\b/;
  if (!declencheur.test(t)) return undefined;
  const reste = t.replace(declencheur, "").replace(/\b(le|la|les|l|au|aux|a|vers|page|onglet|de|du|des)\b/g, " ");
  const mots = reste.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  if (mots.length === 0) return undefined;
  for (const commande of COMMANDES) {
    if (commande.motifs.some((m) => mots.includes(m))) {
      return { chemin: commande.chemin, libelle: commande.libelle };
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 7. Lecture vocale du résumé                                          */
/* ------------------------------------------------------------------ */

export function syntheseDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function lireAVoixHaute(texte: string): boolean {
  if (!syntheseDisponible() || !texte.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const message = new SpeechSynthesisUtterance(texte);
  message.lang = "fr-FR";
  message.rate = 0.98;
  synth.speak(message);
  return true;
}

export function arreterLecture(): void {
  if (syntheseDisponible()) window.speechSynthesis.cancel();
}
