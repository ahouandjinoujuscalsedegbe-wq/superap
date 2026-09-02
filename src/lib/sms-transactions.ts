/**
 * Lecture intelligente des SMS bancaires et Mobile Money.
 *
 * Chaque message reçu (MTN MoMo, Moov Money, Celtiis Cash, Wave, UBA,
 * Ecobank, BOA…) est analysé localement, sans aucun envoi sur Internet :
 * l'application reconnaît s'il s'agit d'un encaissement ou d'un décaissement,
 * en extrait le montant, les frais, la contrepartie, la référence et la date,
 * puis propose l'opération correspondante. Les corrections de l'utilisateur
 * sont mémorisées : le moteur devient de plus en plus juste avec le temps.
 */

export type MessageSms = {
  /** Identifiant stable du message (fourni par le téléphone ou calculé). */
  id: string;
  expediteur: string;
  corps: string;
  /** Horodatage en millisecondes. */
  date: number;
};

export type OperationSms = {
  /** Identifiant du message d'origine : évite tout double enregistrement. */
  id: string;
  type: "revenu" | "depense";
  montant: number;
  /** Frais facturés par l'opérateur, comptés comme dépense séparée. */
  frais: number;
  libelle: string;
  /** Nom ou numéro de la contrepartie, si le message le précise. */
  contrepartie?: string;
  /** Référence de transaction communiquée par l'opérateur. */
  reference?: string;
  /** Nouveau solde annoncé par le message, s'il est présent. */
  soldeApres?: number;
  /** Compte de l'application correspondant à l'émetteur du SMS. */
  compte: string;
  /** Date ISO (YYYY-MM-DD). */
  date: string;
  /** Enveloppe devinée grâce à l'apprentissage ou aux mots-clés. */
  enveloppeId?: string;
  /** Confiance de 0 à 1 ; en dessous de 0,8 une confirmation est demandée. */
  confiance: number;
  /** Message d'origine, conservé pour la vérification par l'utilisateur. */
  source: string;
  expediteur: string;
};

/** Contexte de l'application utilisé pour rattacher l'opération. */
export type ContexteSms = {
  comptes: string[];
  enveloppes: { id: string; nom: string; categorie?: string | undefined }[];
};

const CLE_MEMOIRE = "superapp:sms:memoire:v1";
const CLE_TRAITES = "superapp:sms:traites:v1";
const CLE_AUTO = "superapp:sms:auto:v1";
const CLE_STATS = "superapp:sms:stats:v1";
const CLE_INCONNUS = "superapp:sms:inconnus:v1";

/* ------------------------------------------------------------------ */
/* Outils de texte                                                      */
/* ------------------------------------------------------------------ */

export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Mots qui prouvent qu'un message n'est pas une opération d'argent. */
const BRUIT = [
  "code de verification",
  "code otp",
  "mot de passe",
  "promo",
  "promotion",
  "forfait internet",
  "bonus",
  "felicitations vous avez gagne",
  "abonnez-vous",
  "publicite",
  "solde de votre compte est",
];

const ENTREE = [
  "vous avez recu",
  "recu de",
  "you have received",
  "credite",
  "credit de",
  "depot de",
  "depot reussi",
  "versement",
  "salaire",
  "transfert recu",
  "a ete credite",
  "recharge de votre compte",
  "remboursement recu",
];

const SORTIE = [
  "vous avez envoye",
  "envoi de",
  "transfert de",
  "paiement de",
  "paye",
  "achat de",
  "retrait de",
  "retrait reussi",
  "debite",
  "debit de",
  "a ete debite",
  "prelevement",
  "facture",
  "abonnement",
  "you have sent",
];

/** Opérateurs connus, utilisés pour deviner le compte concerné. */
const OPERATEURS: { motifs: RegExp; nom: string }[] = [
  { motifs: /\b(mtn|momo|mobile\s?money)\b/i, nom: "MTN MoMo" },
  { motifs: /\b(moov|flooz)\b/i, nom: "Moov Money" },
  { motifs: /\b(celtiis|celtis)\b/i, nom: "Celtiis Cash" },
  { motifs: /\bwave\b/i, nom: "Wave" },
  { motifs: /\borange\s?money\b/i, nom: "Orange Money" },
  { motifs: /\b(uba|ecobank|boa|nsia|coris|sgb|societe\s?generale|bsic)\b/i, nom: "Banque" },
];

/** Mots-clés de rattachement automatique à une enveloppe. */
const INDICES: { motifs: RegExp; mots: string[] }[] = [
  { motifs: /(carburant|essence|station|total energies|shell)/i, mots: ["carburant", "transport"] },
  { motifs: /(sbee|electricite|energie)/i, mots: ["electricite", "facture", "energie"] },
  { motifs: /(soneb|eau)/i, mots: ["eau", "facture"] },
  { motifs: /(credit|forfait|internet|data|airtime)/i, mots: ["communication", "telephone"] },
  { motifs: /(ecole|scolarite|universite|inscription)/i, mots: ["scolarite", "education"] },
  { motifs: /(pharmacie|clinique|hopital|sante)/i, mots: ["sante"] },
  { motifs: /(marche|supermarche|alimentation|restaurant)/i, mots: ["nourriture", "alimentation"] },
  { motifs: /(loyer|bail)/i, mots: ["loyer", "logement"] },
];

/**
 * Extrait un montant en FCFA. Les séparateurs de milliers (espace, point,
 * virgule) sont tolérés, tout comme les décimales « ,00 ».
 */
function lireMontant(fragment: string): number | null {
  const m = fragment.match(/(\d[\d\s.,\u202f\u00a0]*)\s*(?:f\s?cfa|fcfa|xof|frs|fr|f)\b/i);
  const brut = m?.[1];
  if (!brut) return null;
  const nettoye = brut.replace(/[\s\u202f\u00a0.]/g, "").replace(/,(\d{1,2})$/, ".$1");
  const valeur = Number(nettoye.replace(/,/g, ""));
  return Number.isFinite(valeur) && valeur > 0 ? Math.round(valeur) : null;
}

function lireApres(texte: string, motif: RegExp): number | null {
  const i = texte.search(motif);
  if (i < 0) return null;
  return lireMontant(texte.slice(i, i + 80));
}

function premierMotif(texte: string, liste: string[]): string | null {
  for (const mot of liste) if (texte.includes(mot)) return mot;
  return null;
}

/* ------------------------------------------------------------------ */
/* Mémoire d'apprentissage                                              */
/* ------------------------------------------------------------------ */

export type SouvenirSms = {
  /** Signature du type de message (expéditeur + mots caractéristiques). */
  signature: string;
  type: "revenu" | "depense";
  enveloppeId?: string;
  compte?: string;
  /** Nombre de confirmations : plus il est élevé, plus la règle est sûre. */
  occurrences: number;
};

type Memoire = Record<string, SouvenirSms>;

function lireJson<T>(cle: string, defaut: T): T {
  if (typeof localStorage === "undefined") return defaut;
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrireJson(cle: string, valeur: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage plein : l'apprentissage est simplement ignoré */
  }
}

/**
 * Signature d'un message : expéditeur + mots significatifs, sans chiffres.
 * Deux SMS du même type produisent la même signature, quel que soit le montant.
 */
export function signatureSms(expediteur: string, corps: string): string {
  const mots = normaliser(corps)
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length > 3)
    .slice(0, 8)
    .sort()
    .join("-");
  return `${normaliser(expediteur)}|${mots}`;
}

/** Enregistre la décision de l'utilisateur pour améliorer les analyses suivantes. */
export function apprendreSms(
  operation: OperationSms,
  choix: { type: "revenu" | "depense"; enveloppeId?: string | undefined; compte?: string },
): void {
  const memoire = lireJson<Memoire>(CLE_MEMOIRE, {});
  const signature = signatureSms(operation.expediteur, operation.source);
  const existant = memoire[signature];
  memoire[signature] = {
    signature,
    type: choix.type,
    ...(choix.enveloppeId ? { enveloppeId: choix.enveloppeId } : {}),
    ...(choix.compte ? { compte: choix.compte } : {}),
    occurrences: (existant?.occurrences ?? 0) + 1,
  };
  ecrireJson(CLE_MEMOIRE, memoire);
}

/** Nombre de règles apprises, affiché à l'utilisateur. */
export function reglesApprises(): SouvenirSms[] {
  return Object.values(lireJson<Memoire>(CLE_MEMOIRE, {})).sort(
    (a, b) => b.occurrences - a.occurrences,
  );
}

/** Oublie une seule règle apprise (l'utilisateur la juge erronée). */
export function oublierRegleSms(signature: string): void {
  const memoire = lireJson<Memoire>(CLE_MEMOIRE, {});
  delete memoire[signature];
  ecrireJson(CLE_MEMOIRE, memoire);
}

export function oublierApprentissageSms(): void {
  ecrireJson(CLE_MEMOIRE, {});
}

/* ------------------------------------------------------------------ */
/* Fiabilité : statistiques et messages jamais reconnus                 */
/* ------------------------------------------------------------------ */

export type StatsSms = {
  /** Nombre de messages analysés depuis l'installation. */
  lus: number;
  /** Messages dans lesquels une opération a été comprise. */
  reconnus: number;
  /** Opérations enregistrées seules, sans confirmation. */
  auto: number;
  /** Opérations confirmées telles quelles par l'utilisateur. */
  confirmes: number;
  /** Opérations corrigées avant enregistrement (sens, compte ou enveloppe). */
  corriges: number;
  /** Opérations écartées par l'utilisateur. */
  ignores: number;
};

const STATS_VIDE: StatsSms = {
  lus: 0,
  reconnus: 0,
  auto: 0,
  confirmes: 0,
  corriges: 0,
  ignores: 0,
};

export function statsSms(): StatsSms {
  return { ...STATS_VIDE, ...lireJson<Partial<StatsSms>>(CLE_STATS, {}) };
}

/** Incrémente un ou plusieurs compteurs de fiabilité. */
export function noterStatSms(ajouts: Partial<StatsSms>): void {
  const actuel = statsSms();
  const suivant = { ...actuel };
  for (const [cle, valeur] of Object.entries(ajouts)) {
    const k = cle as keyof StatsSms;
    suivant[k] = actuel[k] + (valeur ?? 0);
  }
  ecrireJson(CLE_STATS, suivant);
}

/** Part des messages compris automatiquement, entre 0 et 1. */
export function tauxReconnaissance(stats: StatsSms = statsSms()): number {
  return stats.lus > 0 ? stats.reconnus / stats.lus : 0;
}

/** Part des opérations comprises sans aucune correction, entre 0 et 1. */
export function tauxJustesse(stats: StatsSms = statsSms()): number {
  const decides = stats.auto + stats.confirmes + stats.corriges;
  return decides > 0 ? (stats.auto + stats.confirmes) / decides : 0;
}

export type MessageInconnu = {
  id: string;
  expediteur: string;
  extrait: string;
  date: number;
};

/** Mémorise un message qu'aucune règle n'a su interpréter (20 derniers). */
export function memoriserInconnu(message: MessageSms): void {
  const liste = messagesInconnus();
  if (liste.some((m) => m.id === message.id)) return;
  const entree: MessageInconnu = {
    id: message.id,
    expediteur: message.expediteur,
    extrait: message.corps.slice(0, 220),
    date: message.date,
  };
  ecrireJson(CLE_INCONNUS, [entree, ...liste].slice(0, 20));
}

export function messagesInconnus(): MessageInconnu[] {
  return lireJson<MessageInconnu[]>(CLE_INCONNUS, []);
}

export function oublierInconnus(): void {
  ecrireJson(CLE_INCONNUS, []);
}

export function reinitialiserStatsSms(): void {
  ecrireJson(CLE_STATS, STATS_VIDE);
  oublierInconnus();
}

/* ------------------------------------------------------------------ */
/* Messages déjà traités                                                */
/* ------------------------------------------------------------------ */

export function messagesTraites(): string[] {
  return lireJson<string[]>(CLE_TRAITES, []);
}

export function marquerTraite(id: string): void {
  const liste = messagesTraites();
  if (liste.includes(id)) return;
  // Seuls les 500 derniers identifiants sont conservés.
  ecrireJson(CLE_TRAITES, [id, ...liste].slice(0, 500));
}

export function lectureAutoActive(): boolean {
  return lireJson<boolean>(CLE_AUTO, false);
}

export function definirLectureAuto(valeur: boolean): void {
  ecrireJson(CLE_AUTO, valeur);
}

/* ------------------------------------------------------------------ */
/* Analyse                                                              */
/* ------------------------------------------------------------------ */

function devinerCompte(expediteur: string, corps: string, comptes: string[]): string {
  const texte = `${expediteur} ${corps}`;
  for (const op of OPERATEURS) {
    if (!op.motifs.test(texte)) continue;
    const correspondant = comptes.find((c) =>
      normaliser(c).includes(normaliser(op.nom).split(" ")[0]!),
    );
    if (correspondant) return correspondant;
    const parMot = comptes.find((c) => op.motifs.test(c));
    if (parMot) return parMot;
    return op.nom;
  }
  return comptes[0] ?? "Espèces";
}

function devinerEnveloppe(
  corps: string,
  enveloppes: ContexteSms["enveloppes"],
): string | undefined {
  const texte = normaliser(corps);
  for (const indice of INDICES) {
    if (!indice.motifs.test(corps)) continue;
    const trouvee = enveloppes.find((e) => {
      const nom = normaliser(`${e.nom} ${e.categorie ?? ""}`);
      return indice.mots.some((m) => nom.includes(m));
    });
    if (trouvee) return trouvee.id;
  }
  // Le nom exact d'une enveloppe cité dans le message l'emporte.
  const parNom = enveloppes.find((e) => e.nom.length > 3 && texte.includes(normaliser(e.nom)));
  return parNom?.id;
}

/**
 * Analyse un SMS et renvoie l'opération détectée, ou `null` si le message
 * n'est pas une transaction (code de vérification, publicité, information).
 */
export function analyserSms(message: MessageSms, contexte: ContexteSms): OperationSms | null {
  const corps = message.corps.trim();
  if (corps.length < 12) return null;
  const texte = normaliser(corps);

  if (BRUIT.some((b) => texte.includes(b)) && !/(recu|envoye|debite|credite)/.test(texte)) {
    return null;
  }

  const montant = lireMontant(corps);
  if (montant === null) return null;

  const memoire = lireJson<Memoire>(CLE_MEMOIRE, {});
  const souvenir = memoire[signatureSms(message.expediteur, corps)];

  const motEntree = premierMotif(texte, ENTREE);
  const motSortie = premierMotif(texte, SORTIE);
  let type: "revenu" | "depense";
  let confiance: number;
  if (souvenir) {
    type = souvenir.type;
    confiance = Math.min(0.99, 0.85 + souvenir.occurrences * 0.03);
  } else if (motEntree && !motSortie) {
    type = "revenu";
    confiance = 0.88;
  } else if (motSortie && !motEntree) {
    type = "depense";
    confiance = 0.88;
  } else if (motEntree && motSortie) {
    // Les deux familles de mots apparaissent : on suit celle qui vient en premier.
    type = texte.indexOf(motEntree) < texte.indexOf(motSortie) ? "revenu" : "depense";
    confiance = 0.6;
  } else {
    type = "depense";
    confiance = 0.45;
  }

  const frais = lireApres(texte, /frais/) ?? 0;
  const soldeApres = lireApres(texte, /(nouveau solde|solde disponible|solde\s*:)/) ?? undefined;
  const reference =
    corps.match(/(?:ref(?:erence)?|txn|id)\s*[:.\s]\s*([A-Za-z0-9.-]{4,})/i)?.[1] ?? undefined;
  const contrepartie =
    corps.match(
      /(?:de|from|a|à|vers|chez|pour)\s+((?:[A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,2})|\+?\d{8,})/,
    )?.[1] ?? undefined;

  const compte = souvenir?.compte ?? devinerCompte(message.expediteur, corps, contexte.comptes);
  const enveloppeId =
    type === "depense"
      ? (souvenir?.enveloppeId ?? devinerEnveloppe(corps, contexte.enveloppes))
      : undefined;
  if (type === "depense" && !enveloppeId) confiance = Math.min(confiance, 0.75);

  const libelle = contrepartie
    ? `${type === "revenu" ? "Reçu de" : "Payé à"} ${contrepartie}`
    : `${message.expediteur} — ${type === "revenu" ? "encaissement" : "décaissement"}`;

  const date = new Date(message.date);
  const iso = Number.isFinite(date.getTime())
    ? date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return {
    id: message.id,
    type,
    montant,
    frais: frais > 0 && frais < montant ? frais : 0,
    libelle,
    ...(contrepartie ? { contrepartie } : {}),
    ...(reference ? { reference } : {}),
    ...(soldeApres ? { soldeApres } : {}),
    compte,
    date: iso,
    ...(enveloppeId ? { enveloppeId } : {}),
    confiance,
    source: corps,
    expediteur: message.expediteur,
  };
}

/** Analyse une série de messages en ignorant ceux déjà enregistrés. */
export function analyserMessages(
  messages: MessageSms[],
  contexte: ContexteSms,
  deja: string[] = messagesTraites(),
): OperationSms[] {
  const vus = new Set(deja);
  const out: OperationSms[] = [];
  let lus = 0;
  for (const m of messages) {
    if (vus.has(m.id)) continue;
    lus += 1;
    const op = analyserSms(m, contexte);
    if (op) {
      vus.add(m.id);
      out.push(op);
    } else if (ressembleATransaction(m.corps)) {
      // Message qui parle d'argent mais qu'aucune règle ne sait lire :
      // il est conservé pour être montré dans le tableau de fiabilité.
      memoriserInconnu(m);
    }
  }
  if (lus > 0) noterStatSms({ lus, reconnus: out.length });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Repère un message qui évoque de l'argent sans avoir été compris. */
function ressembleATransaction(corps: string): boolean {
  const t = normaliser(corps);
  return (
    /[0-9]/.test(t) &&
    /(fcfa|xof|f cfa|montant|solde|transfert|paiement|retrait|depot|virement|debit|credit)/.test(t)
  );
}

/** Découpe un texte collé manuellement en messages analysables. */
export function messagesDepuisTexte(texte: string, expediteur = "Message"): MessageSms[] {
  return texte
    .split(/\n{2,}/)
    .map((bloc) => bloc.trim())
    .filter((bloc) => bloc.length > 12)
    .map((bloc, i) => ({
      id: `colle:${hachage(bloc)}`,
      expediteur,
      corps: bloc,
      date: Date.now() - i,
    }));
}

/** Petit hachage stable, suffisant pour repérer un message déjà traité. */
export function hachage(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
