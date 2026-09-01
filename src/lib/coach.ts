/**
 * Coach financier local : messagerie entre l'utilisateur et son conseiller.
 *
 * Le conseiller observe les données chaque jour, produit des messages
 * (notifications) et apprend des réactions de l'utilisateur : les thèmes
 * appréciés remontent, les thèmes rejetés descendent et finissent par se
 * taire. Tout est calculé et stocké sur l'appareil, chiffré.
 */

import type { Budget, Dette, Enveloppe, Transaction } from "./store";
import { conseiller, evaluerSante, type Recommandation } from "./conseil";
import { lireSecurise, ecrireSecurise } from "./coffre-local";

export const CLE_COACH = "super-app-coach";

export type CategorieCoach =
  | Recommandation["categorie"]
  | "bilan"
  | "reponse"
  | "question"
  | "enveloppe";

export type MessageCoach = {
  id: string;
  auteur: "coach" | "utilisateur";
  texte: string;
  /** Précisions affichées sous le message. */
  details?: string[];
  categorie: CategorieCoach;
  /** Enveloppe concernée, quand le message vient du conseiller d'enveloppe. */
  enveloppeId?: string;
  date: string; // ISO
  lu: boolean;
  /** Retour de l'utilisateur : utile / inutile. */
  avis?: "utile" | "inutile";
};

export type MemoireCoach = {
  messages: MessageCoach[];
  /** Poids d'intérêt par thème, entre 0 et 2 (1 = neutre). */
  poids: Record<string, number>;
  /** Poids d'intérêt par enveloppe, entre 0 et 2 (1 = neutre). */
  poidsEnveloppe: Record<string, number>;
  /** Dernier jour (AAAA-MM-JJ) où le bilan quotidien a été produit. */
  dernierJour: string | null;
  /** Empreintes des messages déjà envoyés, pour ne pas se répéter. */
  vus: string[];
  /** Observations quotidiennes accumulées : dépense moyenne par jour. */
  historique: { jour: string; depense: number; revenu: number; score: number }[];
  /** Mots-clés les plus souvent employés par l'utilisateur, avec leur compte. */
  motsCles: Record<string, number>;
  /** Nombre de questions posées : sert à adapter le ton du conseiller. */
  echanges: number;
};

export const MEMOIRE_VIDE: MemoireCoach = {
  messages: [],
  poids: {},
  poidsEnveloppe: {},
  dernierJour: null,
  vus: [],
  historique: [],
  motsCles: {},
  echanges: 0,
};


function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function jourDe(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function id(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Persistance                                                          */
/* ------------------------------------------------------------------ */

export function assainirMemoire(brut: unknown): MemoireCoach {
  const o = (brut ?? {}) as Partial<MemoireCoach>;
  return {
    messages: Array.isArray(o.messages) ? o.messages.slice(-400) : [],
    poids: o.poids && typeof o.poids === "object" ? o.poids : {},
    poidsEnveloppe:
      o.poidsEnveloppe && typeof o.poidsEnveloppe === "object" ? o.poidsEnveloppe : {},
    dernierJour: typeof o.dernierJour === "string" ? o.dernierJour : null,
    vus: Array.isArray(o.vus) ? o.vus.slice(-200) : [],
    historique: Array.isArray(o.historique) ? o.historique.slice(-120) : [],
    motsCles: o.motsCles && typeof o.motsCles === "object" ? o.motsCles : {},
    echanges: typeof o.echanges === "number" && Number.isFinite(o.echanges) ? o.echanges : 0,
  };
}

export async function lireMemoire(): Promise<MemoireCoach> {
  try {
    const brut = await lireSecurise(CLE_COACH);
    if (!brut) return MEMOIRE_VIDE;
    return assainirMemoire(JSON.parse(brut));
  } catch {
    return MEMOIRE_VIDE;
  }
}

export async function ecrireMemoire(memoire: MemoireCoach): Promise<void> {
  await ecrireSecurise(CLE_COACH, JSON.stringify(memoire));
}

/* ------------------------------------------------------------------ */
/* Apprentissage                                                        */
/* ------------------------------------------------------------------ */

export function poidsDe(memoire: MemoireCoach, categorie: string): number {
  const p = memoire.poids[categorie];
  return typeof p === "number" && Number.isFinite(p) ? p : 1;
}

export function poidsEnveloppeDe(memoire: MemoireCoach, enveloppeId: string): number {
  const p = memoire.poidsEnveloppe[enveloppeId];
  return typeof p === "number" && Number.isFinite(p) ? p : 1;
}

function borne(v: number): number {
  return Math.max(0, Math.min(2, v));
}

/** Un avis fait monter ou descendre l'intérêt pour le thème du message. */
export function apprendreAvis(
  memoire: MemoireCoach,
  messageId: string,
  avis: "utile" | "inutile",
): MemoireCoach {
  const message = memoire.messages.find((m) => m.id === messageId);
  if (!message) return memoire;
  const poids = { ...memoire.poids };
  const actuel = poidsDe(memoire, message.categorie);
  poids[message.categorie] = borne(avis === "utile" ? actuel + 0.25 : actuel - 0.35);

  const poidsEnveloppe = { ...memoire.poidsEnveloppe };
  if (message.enveloppeId) {
    const courant = poidsEnveloppeDe(memoire, message.enveloppeId);
    poidsEnveloppe[message.enveloppeId] = borne(
      avis === "utile" ? courant + 0.3 : courant - 0.4,
    );
  }

  // Les mots du message noté renforcent (ou affaiblissent) le vocabulaire suivi.
  const motsCles = { ...memoire.motsCles };
  for (const mot of motsUtiles(message.texte)) {
    const n = motsCles[mot] ?? 0;
    motsCles[mot] = Math.max(0, n + (avis === "utile" ? 1 : -1));
  }

  return {
    ...memoire,
    poids,
    poidsEnveloppe,
    motsCles,
    messages: memoire.messages.map((m) => (m.id === messageId ? { ...m, avis } : m)),
  };
}

const MOTS_VIDES = new Set([
  "avec","dans","pour","vous","cette","votre","mais","plus","moins","chez","tout","tous",
  "sont","cela","donc","alors","quand","comme","fait","faire","sans","leur","elle","nous",
  "combien","est-ce","quel","quelle","mois","jour","francs","fcfa",
]);

/** Mots significatifs d'une phrase, sans accents ni mots vides. */
export function motsUtiles(texte: string): string[] {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m))
    .slice(0, 12);
}

/**
 * Une question posée renforce le thème abordé, l'enveloppe citée et le
 * vocabulaire de l'utilisateur : les conseils suivants s'y adaptent.
 */
export function apprendreQuestion(
  memoire: MemoireCoach,
  question: string,
  enveloppeId?: string,
): MemoireCoach {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const themes: [RegExp, CategorieCoach][] = [
    [/epargn|econom|reserve|urgence/, "epargne"],
    [/depens|budget|enveloppe|plafond/, "depense"],
    [/dette|credit|rembours|creance/, "dette"],
    [/revenu|salaire|gain|entree/, "revenu"],
    [/objectif|plan|organis|categor/, "organisation"],
    [/securit|code|pin|sauvegarde/, "securite"],
  ];
  const poids = { ...memoire.poids };
  for (const [regex, theme] of themes) {
    if (regex.test(q)) poids[theme] = borne(poidsDe(memoire, theme) + 0.15);
  }

  const poidsEnveloppe = { ...memoire.poidsEnveloppe };
  if (enveloppeId) {
    poidsEnveloppe[enveloppeId] = borne(poidsEnveloppeDe(memoire, enveloppeId) + 0.2);
  }

  const motsCles = { ...memoire.motsCles };
  for (const mot of motsUtiles(question)) motsCles[mot] = (motsCles[mot] ?? 0) + 1;

  return {
    ...memoire,
    poids,
    poidsEnveloppe,
    motsCles,
    echanges: memoire.echanges + 1,
  };
}

/** Les sujets que l'utilisateur ramène le plus souvent, du plus fréquent au moins. */
export function sujetsFavoris(memoire: MemoireCoach, combien = 5): string[] {
  return Object.entries(memoire.motsCles)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, combien)
    .map(([mot]) => mot);
}


/* ------------------------------------------------------------------ */
/* Génération des messages du jour                                      */
/* ------------------------------------------------------------------ */

export type DonneesCoach = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  budgets: Budget[];
  dettes: Dette[];
  depensesParEnveloppe: Record<string, number>;
  solde: number;
};

function empreinte(texte: string): string {
  return texte.slice(0, 80).toLowerCase();
}

/**
 * Produit les messages du conseiller pour aujourd'hui.
 * Les thèmes rejetés (poids < 0,4) sont écartés, les thèmes appréciés passent
 * devant. Un même message n'est jamais renvoyé deux fois.
 */
export function messagesDuJour(
  memoire: MemoireCoach,
  donnees: DonneesCoach,
  maintenant = new Date(),
): MessageCoach[] {
  const jour = jourDe(maintenant);
  const sante = evaluerSante({
    transactions: donnees.transactions,
    dettes: donnees.dettes,
    solde: donnees.solde,
    enveloppes: donnees.enveloppes,
    depensesParEnveloppe: donnees.depensesParEnveloppe,
  });
  const recos = conseiller(donnees);

  const sortie: MessageCoach[] = [];
  const horodater = (i: number) =>
    new Date(maintenant.getTime() + i * 1000).toISOString();

  /* Bilan quotidien : toujours présent, il ouvre la conversation du jour. */
  const veille = memoire.historique[memoire.historique.length - 1];
  const evolution = veille
    ? sante.score - veille.score
    : 0;
  const bilan = [
    `Bonjour. Voici votre point du jour : santé financière ${sante.score}/100 (${sante.niveau}).`,
    veille
      ? evolution === 0
        ? "C'est stable par rapport à hier."
        : evolution > 0
          ? `Vous progressez de ${evolution} points depuis hier. Continuez.`
          : `Vous perdez ${Math.abs(evolution)} points depuis hier, regardons pourquoi.`
      : "Je commence à observer vos habitudes ; mes conseils s'affineront chaque jour.",
  ].join(" ");

  sortie.push({
    id: id(),
    auteur: "coach",
    texte: bilan,
    details: [
      `Revenu mensuel estimé : ${fcfa(sante.revenuMensuel)}`,
      `Dépense mensuelle estimée : ${fcfa(sante.depenseMensuelle)}`,
      `Taux d'épargne : ${Math.round(sante.tauxEpargne * 100)} %`,
      `Réserve : ${sante.moisDeReserve.toFixed(1)} mois de dépenses`,
    ],
    categorie: "bilan",
    date: horodater(0),
    lu: false,
  });

  /* Conseils du jour, triés par intérêt appris puis par gain. */
  const classees = recos
    .filter((r) => poidsDe(memoire, r.categorie) >= 0.4)
    .map((r) => ({ r, note: r.gainMensuel * poidsDe(memoire, r.categorie) }))
    .sort((a, b) => b.note - a.note)
    .map((x) => x.r)
    .filter((r) => !memoire.vus.includes(empreinte(r.titre)))
    .slice(0, 3);

  classees.forEach((r, i) => {
    sortie.push({
      id: id(),
      auteur: "coach",
      texte: `${r.titre}. ${r.explication}`,
      details: [
        `À faire : ${r.action}`,
        `Gain estimé : ${fcfa(r.gainMensuel)} par mois`,
        `Horizon : ${r.horizon} · priorité ${r.priorite}`,
      ],
      categorie: r.categorie,
      date: horodater(i + 1),
      lu: false,
    });
  });

  if (classees.length === 0) {
    sortie.push({
      id: id(),
      auteur: "coach",
      texte:
        "Rien d'urgent aujourd'hui : vos indicateurs tiennent. Posez-moi une question quand vous voulez, je réponds à partir de vos propres chiffres.",
      categorie: "bilan",
      date: horodater(1),
      lu: false,
    });
  }

  void jour;
  return sortie;
}

/** Ajoute les messages du jour à la mémoire, une seule fois par journée. */
export function mettreAJourJournee(
  memoire: MemoireCoach,
  donnees: DonneesCoach,
  maintenant = new Date(),
): MemoireCoach {
  const jour = jourDe(maintenant);
  if (memoire.dernierJour === jour) return memoire;

  const nouveaux = messagesDuJour(memoire, donnees, maintenant);
  const sante = evaluerSante({
    transactions: donnees.transactions,
    dettes: donnees.dettes,
    solde: donnees.solde,
    enveloppes: donnees.enveloppes,
    depensesParEnveloppe: donnees.depensesParEnveloppe,
  });

  return {
    ...memoire,
    dernierJour: jour,
    messages: [...memoire.messages, ...nouveaux].slice(-400),
    vus: [...memoire.vus, ...nouveaux.map((m) => empreinte(m.texte))].slice(-200),
    historique: [
      ...memoire.historique.filter((h) => h.jour !== jour),
      {
        jour,
        depense: sante.depenseMensuelle,
        revenu: sante.revenuMensuel,
        score: sante.score,
      },
    ].slice(-120),
  };
}

export function nonLus(memoire: MemoireCoach): number {
  return memoire.messages.filter((m) => m.auteur === "coach" && !m.lu).length;
}
