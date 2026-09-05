/**
 * Lecture automatique des messages de transaction (Mobile Money, banques).
 *
 * Moteur 100 % local : aucun message n'est envoyé en ligne. Chaque SMS est
 * analysé pour reconnaître le sens (revenu ou dépense), le montant, le
 * correspondant, la date et la référence. L'application mémorise les
 * corrections de l'utilisateur pour s'améliorer à chaque validation.
 */

import { sansAccents } from "@/lib/extraction";

export type MessageBrut = {
  id: string;
  expediteur: string;
  texte: string;
  /** Millisecondes depuis 1970. */
  recuLe: number;
};

export type TransactionSms = {
  /** Identifiant stable, calculé à partir du contenu du message. */
  cle: string;
  messageId: string;
  expediteur: string;
  texte: string;
  type: "revenu" | "depense";
  montant: number;
  frais: number;
  libelle: string;
  date: string; // ISO
  reference?: string;
  /** Confiance de 0 à 1. En dessous de 0,88 une confirmation est demandée. */
  confiance: number;
};

/* ------------------------------------------------------------------ */
/* Expéditeurs reconnus                                                 */
/* ------------------------------------------------------------------ */

const EXPEDITEURS_CONNUS = [
  "mtn",
  "momo",
  "mtnmomo",
  "moov",
  "moovmoney",
  "flooz",
  "celtiis",
  "celtiiscash",
  "wave",
  "orange",
  "orangemoney",
  "ecobank",
  "uba",
  "boa",
  "bank of africa",
  "sgb",
  "societe generale",
  "nsia",
  "coris",
  "bsic",
  "diamond",
  "fedapay",
  "kkiapay",
];

export function expediteurReconnu(expediteur: string): boolean {
  const e = sansAccents(expediteur).replace(/[^a-z0-9 ]/g, "");
  return EXPEDITEURS_CONNUS.some((connu) => e.includes(connu));
}

/* ------------------------------------------------------------------ */
/* Détection du sens                                                    */
/* ------------------------------------------------------------------ */

const MOTS_DEPENSE = [
  "debit",
  "debite",
  "retrait",
  "paiement",
  "paye",
  "achat",
  "envoye",
  "transfert de",
  "vous avez envoye",
  "vous avez transfere",
  "vous avez paye",
  "vous avez retire",
  "prelevement",
  "facture",
  "souscription",
  "abonnement",
];

const MOTS_REVENU = [
  "credit",
  "credite",
  "recu",
  "vous avez recu",
  "depot",
  "versement",
  "remboursement recu",
  "paiement recu",
  "salaire",
  "virement recu",
];

function detecterSens(t: string): { type: "revenu" | "depense"; certitude: number } {
  const depense = MOTS_DEPENSE.filter((m) => t.includes(m)).length;
  const revenu = MOTS_REVENU.filter((m) => t.includes(m)).length;
  if (revenu > depense) return { type: "revenu", certitude: revenu >= 2 ? 1 : 0.85 };
  if (depense > revenu) return { type: "depense", certitude: depense >= 2 ? 1 : 0.85 };
  return { type: "depense", certitude: 0.4 };
}

/* ------------------------------------------------------------------ */
/* Extraction du montant                                                */
/* ------------------------------------------------------------------ */

const MOTIF_MONTANT =
  /(\d{1,3}(?:[ .,\u00a0]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:f\s?cfa|fcfa|xof|cfa|f\b)/gi;

function nombre(entier: string, decimales?: string): number {
  const propre = entier.replace(/[ .,\u00a0]/g, "");
  const valeur = Number(propre) + (decimales ? Number(`0.${decimales}`) : 0);
  return Number.isFinite(valeur) ? Math.round(valeur) : 0;
}

/** Tous les montants trouvés dans le texte, dans l'ordre d'apparition. */
export function montantsDuTexte(texte: string): number[] {
  const trouves: number[] = [];
  MOTIF_MONTANT.lastIndex = 0;
  let m = MOTIF_MONTANT.exec(texte);
  while (m) {
    const valeur = nombre(m[1] ?? "", m[2]);
    if (valeur > 0) trouves.push(valeur);
    m = MOTIF_MONTANT.exec(texte);
  }
  return trouves;
}

function extraireFrais(texte: string): number {
  const m = /frais\D{0,20}?(\d{1,3}(?:[ .,\u00a0]\d{3})*|\d+)/i.exec(sansAccents(texte));
  return m ? nombre(m[1] ?? "") : 0;
}

/* ------------------------------------------------------------------ */
/* Correspondant et référence                                           */
/* ------------------------------------------------------------------ */

function extraireCorrespondant(texte: string, expediteur: string): string {
  const motifs = [
    /(?:de|from)\s+([A-Za-zÀ-ÿ' -]{3,40})(?:\s*\(|,|\.|$)/i,
    /(?:a|à|to|vers|chez)\s+([A-Za-zÀ-ÿ' -]{3,40})(?:\s*\(|,|\.|$)/i,
    /(?:marchand|merchant|beneficiaire|bénéficiaire)\s*:?\s*([A-Za-zÀ-ÿ0-9' -]{3,40})/i,
  ];
  for (const motif of motifs) {
    const m = motif.exec(texte);
    const nom = m?.[1]?.trim();
    if (nom && nom.length >= 3 && !/^\d+$/.test(nom)) return nom.replace(/\s{2,}/g, " ");
  }
  const numero = /(\+?\d[\d ]{7,15})/.exec(texte)?.[1]?.trim();
  if (numero) return `Transaction ${numero}`;
  return expediteur || "Transaction";
}

function extraireReference(texte: string): string | undefined {
  const m = /(?:ref|reference|référence|id|transaction)\s*[:.n°]*\s*([A-Za-z0-9.-]{5,30})/i.exec(
    texte,
  );
  return m?.[1];
}

/* ------------------------------------------------------------------ */
/* Analyse d'un message                                                 */
/* ------------------------------------------------------------------ */

export function cleMessage(message: MessageBrut): string {
  const base = `${message.expediteur}|${message.texte}`.replace(/\s+/g, " ").trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < base.length; i += 1) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
  return `sms-${h.toString(36)}-${base.length}`;
}

/**
 * Analyse un SMS. Renvoie `undefined` si ce n'est visiblement pas une
 * transaction (pas de montant reconnaissable).
 */
export function analyserMessage(
  message: MessageBrut,
  apprentissage = lireApprentissage(),
): TransactionSms | undefined {
  const texte = message.texte ?? "";
  const t = sansAccents(texte);
  const montants = montantsDuTexte(texte);
  if (montants.length === 0) return undefined;

  const frais = extraireFrais(texte);
  const montant = montants.find((v) => v !== frais) ?? montants[0] ?? 0;
  if (montant <= 0) return undefined;

  const sens = detecterSens(t);
  const signature = signatureExpediteur(message.expediteur);
  const memorise = apprentissage.expediteurs[signature];

  let type = sens.type;
  let confiance = sens.certitude;
  if (memorise) {
    if (memorise.type && memorise.corrections >= 1) {
      // L'utilisateur a déjà corrigé le sens pour cet expéditeur.
      if (sens.certitude < 0.9) type = memorise.type;
    }
    confiance = Math.min(1, confiance + Math.min(0.3, memorise.validations * 0.05));
  }
  if (expediteurReconnu(message.expediteur)) confiance = Math.min(1, confiance + 0.1);
  if (frais > 0) confiance = Math.min(1, confiance + 0.03);

  return {
    cle: cleMessage(message),
    messageId: message.id,
    expediteur: message.expediteur,
    texte,
    type,
    montant,
    frais,
    libelle: extraireCorrespondant(texte, message.expediteur),
    date: new Date(message.recuLe || Date.now()).toISOString(),
    ...(extraireReference(texte) ? { reference: extraireReference(texte) } : {}),
    confiance: Number(confiance.toFixed(2)),
  };
}

/** Analyse une liste de messages en écartant les doublons. */
export function analyserMessages(messages: MessageBrut[]): TransactionSms[] {
  const apprentissage = lireApprentissage();
  const vues = new Set<string>();
  const resultats: TransactionSms[] = [];
  for (const message of messages) {
    const analyse = analyserMessage(message, apprentissage);
    if (!analyse) continue;
    if (vues.has(analyse.cle)) continue;
    vues.add(analyse.cle);
    resultats.push(analyse);
  }
  return resultats.sort((a, b) => b.date.localeCompare(a.date));
}

export const SEUIL_CONFIANCE = 0.88;

/* ------------------------------------------------------------------ */
/* Mémoire : messages déjà traités                                      */
/* ------------------------------------------------------------------ */

const CLE_TRAITES = "superapp:sms:traites:v1";
const MAX_TRAITES = 600;

export function lireTraites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_TRAITES);
    const liste = brut ? (JSON.parse(brut) as string[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

export function marquerTraite(cle: string): void {
  if (typeof window === "undefined") return;
  const liste = [cle, ...lireTraites().filter((c) => c !== cle)].slice(0, MAX_TRAITES);
  try {
    window.localStorage.setItem(CLE_TRAITES, JSON.stringify(liste));
  } catch {
    /* quota : la mémoire reste optionnelle */
  }
}

export function estTraite(cle: string, traites = lireTraites()): boolean {
  return traites.includes(cle);
}

/* ------------------------------------------------------------------ */
/* Apprentissage local                                                  */
/* ------------------------------------------------------------------ */

const CLE_APPRENTISSAGE = "superapp:sms:apprentissage:v1";

export type Apprentissage = {
  expediteurs: Record<
    string,
    {
      type?: "revenu" | "depense";
      enveloppe?: string;
      compte?: string;
      validations: number;
      corrections: number;
    }
  >;
  totalValides: number;
  totalCorriges: number;
};

const VIDE: Apprentissage = { expediteurs: {}, totalValides: 0, totalCorriges: 0 };

export function signatureExpediteur(expediteur: string): string {
  return sansAccents(expediteur)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 24);
}

export function lireApprentissage(): Apprentissage {
  if (typeof window === "undefined") return VIDE;
  try {
    const brut = window.localStorage.getItem(CLE_APPRENTISSAGE);
    const valeur = brut ? (JSON.parse(brut) as Apprentissage) : VIDE;
    return valeur && typeof valeur === "object" && valeur.expediteurs ? valeur : VIDE;
  } catch {
    return VIDE;
  }
}

function ecrireApprentissage(valeur: Apprentissage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_APPRENTISSAGE, JSON.stringify(valeur));
  } catch {
    /* ignoré */
  }
}

/** Mémorise la validation (ou la correction) d'une transaction détectée. */
export function apprendre(
  transaction: TransactionSms,
  choix: { type: "revenu" | "depense"; enveloppe?: string; compte?: string },
): Apprentissage {
  const memoire = lireApprentissage();
  const signature = signatureExpediteur(transaction.expediteur);
  const actuel = memoire.expediteurs[signature] ?? { validations: 0, corrections: 0 };
  const corrige = choix.type !== transaction.type;
  memoire.expediteurs[signature] = {
    ...actuel,
    type: choix.type,
    ...(choix.enveloppe ? { enveloppe: choix.enveloppe } : {}),
    ...(choix.compte ? { compte: choix.compte } : {}),
    validations: actuel.validations + 1,
    corrections: actuel.corrections + (corrige ? 1 : 0),
  };
  memoire.totalValides += 1;
  if (corrige) memoire.totalCorriges += 1;
  ecrireApprentissage(memoire);
  return memoire;
}

/** Fiabilité observée du moteur, en pourcentage. */
export function fiabilite(memoire = lireApprentissage()): number {
  if (memoire.totalValides === 0) return 0;
  return Math.round(((memoire.totalValides - memoire.totalCorriges) / memoire.totalValides) * 100);
}

/** Enveloppe et compte déjà appris pour cet expéditeur. */
export function suggestionApprise(expediteur: string): {
  enveloppe?: string;
  compte?: string;
} {
  const memorise = lireApprentissage().expediteurs[signatureExpediteur(expediteur)];
  return {
    ...(memorise?.enveloppe ? { enveloppe: memorise.enveloppe } : {}),
    ...(memorise?.compte ? { compte: memorise.compte } : {}),
  };
}
