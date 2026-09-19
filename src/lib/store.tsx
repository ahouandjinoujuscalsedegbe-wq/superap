import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from "react";
import { avancerDate } from "./periodes";
import { appliquerReglages } from "./reglages-complets";
import { CLE_BROUILLONS } from "./brouillons";
import { montantSurRevenu } from "./remplissage";
import { ecrireSecurise, estChiffre, lireSecuriseDetail } from "./coffre-local";
import { camouflageEnCours } from "./securite-avancee";
import { toast } from "sonner";
import { journaliser } from "./journal";
import { dotationDe } from "./enveloppe-etat";
import { demanderMotDePasse } from "./mot-de-passe-actions";
import {
  assainirBudget,
  assainirCategorie,
  assainirComptes,
  assainirDette,
  assainirElementCorbeille,
  assainirEnveloppe,
  assainirListe,
  assainirMembres,
  assainirObjectif,
  assainirRegleTransfert,
  assainirRemplissage,
  assainirTransaction,
  assainirTransfert,
  montantPositifOuNul,
  montantValide,
  nombreSur,
  texteSur,
} from "./validation";

export type Enveloppe = {
  id: string;
  nom: string;
  emoji: string;
  plafond: number;
  /** Somme attribuée à l'enveloppe ; elle diminue à chaque dépense. */
  dotation?: number;
  /** Catégorie de classement, ex. « Transport », « Factures ». */
  categorie?: string;
  /** Sous-catégorie, ex. « Carburant », « Facture SBEE ». */
  sousCategorie?: string;
  /** Compte qui alimente l'enveloppe : le remplissage y est débité. */
  compteSource?: string;
  /** Périodicité de renouvellement du contenu de l'enveloppe. */
  periodeRenouvellement?: Periode;
  /** Mode de remplissage : montant fixe par période ou % de chaque revenu. */
  modeRemplissage?: "fixe" | "pourcentage";
  /** Montant fixe versé à chaque période (mode « fixe »). */
  montantPeriode?: number;
  /** Part de chaque revenu versée à l'enveloppe, en % (mode « pourcentage »). */
  pourcentageRevenu?: number;
  /** true : le montant s'ajuste seul aux habitudes de dépense observées. */
  ajustementAuto?: boolean;
  /** Date (ISO) du dernier remplissage périodique appliqué. */
  dernierRemplissage?: string;
  /**
   * Date (AAAA-MM-JJ) choisie par l'utilisateur pour le premier renouvellement
   * automatique. Sans elle, aucun renouvellement automatique n'a lieu.
   */
  dateRenouvellement?: string;
};

/** Versement d'un compte vers une enveloppe (approvisionnement). */
export type Remplissage = {
  id: string;
  enveloppeId: string;
  /** Compte débité. */
  compte: string;
  montant: number;
  date: string;
  /** Origine : renouvellement de période, part d'un revenu, ou geste manuel. */
  origine: "periode" | "revenu" | "manuel";
};

export type CategorieEnveloppe = {
  id: string;
  nom: string;
  sousCategories: string[];
  /** Icône (emoji) choisie par l'utilisateur pour repérer la catégorie. */
  emoji?: string;
};

export type Transaction = {
  id: string;
  type: "revenu" | "depense";
  montant: number;
  libelle: string;
  categorie: string;
  compte: string;
  date: string;
  /** Budget planifié à l'origine de cette opération, si elle vient de la Budgétisation. */
  budgetId?: string | undefined;
  /** Dette ou créance à l'origine de cette opération, si elle vient du module Dettes. */
  detteId?: string | undefined;
  /** Membre du foyer à l'origine de l'opération (mode couple). */
  membre?: string | undefined;
  /**
   * Frais supportés lors de l'opération (retrait, dépôt, commission…).
   * Une dépense coûte réellement `montant + frais` au compte ;
   * un revenu ne rapporte réellement que `montant - frais`.
   */
  frais?: number | undefined;
  /** Nature technique d'une écriture qui ne doit pas être comptée comme un revenu du mois. */
  origine?: "solde_initial" | undefined;
};

/** Opération supprimée, conservée 30 jours dans la corbeille. */
export type ElementCorbeille = Transaction & { supprimeLe: string };

/** Objectif d'épargne suivi par l'application. */
/** Nature de l'objectif : épargne libre, achat programmé ou tontine. */
export type TypeObjectif = "epargne" | "achat" | "tontine";

/** Rythme des cotisations d'une tontine (ancien format, conservé pour les données existantes). */
export type FrequenceTontine = "hebdomadaire" | "quinzaine" | "mensuelle";

/** Unité de répétition d'un rappel d'objectif, librement choisie par l'utilisateur. */
export type UniteRappel = "jour" | "semaine" | "mois" | "annee";

export type Objectif = {
  id: string;
  libelle: string;
  /** Montant visé, en FCFA. */
  cible: number;
  /** Date visée (YYYY-MM-DD). */
  dateCible: string;
  /** Montant déjà mis de côté avant le suivi. */
  deja: number;
  /** Nature de l'objectif (défaut : épargne). */
  type?: TypeObjectif | undefined;
  /** Tontine : montant d'une cotisation. */
  tontineMontantTour?: number | undefined;
  /** Tontine : rythme des cotisations. */
  tontineFrequence?: FrequenceTontine | undefined;
  /** Tontine : nombre de participants (donc de tours). */
  tontineParticipants?: number | undefined;
  /** Tontine : rang de passage de l'utilisateur. */
  tontineRang?: number | undefined;
  /** Tontine : date de la première cotisation (YYYY-MM-DD). */
  tontineDebut?: string | undefined;
  /** Tontine : nom de l'organisateur ou du groupe. */
  tontineOrganisateur?: string | undefined;
  /** Ancien rythme des rappels d'épargne (converti automatiquement). */
  rappelFrequence?: FrequenceTontine | undefined;
  /** Unité de répétition du rappel : jour, semaine, mois ou année. */
  rappelUnite?: UniteRappel | undefined;
  /** Nombre d'unités entre deux rappels (1 à 31). */
  rappelIntervalle?: number | undefined;
  /** Date du premier rappel (YYYY-MM-DD). */
  rappelDebut?: string | undefined;
  /** Date unique choisie d'office : un seul rappel, ce jour-là (remplace le rythme régulier). */
  rappelDateUnique?: string | undefined;
  /** false pour désactiver les rappels de cotisation de cet objectif. */
  rappelActif?: boolean | undefined;
  /** Enveloppe d'épargne associée, si l'utilisateur en choisit une. */
  enveloppeId?: string | undefined;
  /** Compte débité chaque mois pour alimenter l'épargne de l'objectif. */
  compteSource?: string | undefined;
  /** Compte d'épargne (exclu du solde disponible) qui reçoit le prélèvement. */
  compteEpargne?: string | undefined;
  /** true si le prélèvement mensuel est effectué automatiquement. */
  prelevementAuto?: boolean | undefined;
  /** Date (YYYY-MM-DD) à laquelle l'utilisateur déclare l'objectif atteint. */
  atteintLe?: string | undefined;
  /** Montant réellement réuni au moment où l'objectif a été déclaré atteint. */
  montantFinal?: number | undefined;
  /** Remarque libre saisie lors de la clôture de l'objectif. */
  noteCloture?: string | undefined;
  creeLe: string;
};

export type Transfert = {
  id: string;
  source: string;
  destination: string;
  montant: number;
  note: string;
  date: string;
  /** Frais de transaction supportés lors du transfert (0 si aucun). */
  frais?: number | undefined;
  /** Compte qui supporte les frais : celui qui envoie ou celui qui reçoit. */
  fraisSur?: "source" | "destination" | undefined;
  /** Fiche de dette ou de créance à l'origine de ce transfert. */
  detteId?: string | undefined;
  /** Objectif (tontine, épargne…) auquel ce mouvement est rattaché. */
  objectifId?: string | undefined;
};

/**
 * Règle de transfert automatique : à chaque revenu enregistré, un pourcentage
 * du montant part aussitôt du compte crédité vers un autre compte.
 */
export type RegleTransfert = {
  id: string;
  nom: string;
  /** Compte crédité qui déclenche la règle ; « * » = n'importe quel compte. */
  source: string;
  /** Compte qui reçoit la part automatique. */
  destination: string;
  /** Part de chaque revenu transférée, en pourcentage (1 à 100). */
  pourcentage: number;
  /** Source de revenu concernée (Salaire, Prime…) ; « * » = toutes. */
  sourceRevenu: string;
  actif: boolean;
  creeLe: string;
};


export type Periode = "jour" | "semaine" | "mois" | "trimestre" | "semestre" | "annee";

export const PERIODES: { id: Periode; label: string; parAn: number }[] = [
  { id: "jour", label: "Journalière", parAn: 365 },
  { id: "semaine", label: "Hebdomadaire", parAn: 52 },
  { id: "mois", label: "Mensuelle", parAn: 12 },
  { id: "trimestre", label: "Trimestrielle", parAn: 4 },
  { id: "semestre", label: "Semestrielle", parAn: 2 },
  { id: "annee", label: "Annuelle", parAn: 1 },
];

export type Budget = {
  id: string;
  libelle: string;
  enveloppeId: string;
  montant: number;
  periode: Periode;
  compte: string;
  prochaine: string;
  /** Début de la période planifiée (YYYY-MM-DD) */
  debut?: string;
  /** Fin de la période planifiée (YYYY-MM-DD) */
  fin?: string;
  /** true = planification unique sur la période, false = récurrente */
  ponctuel?: boolean;
  /** Nombre d'unités de période entre deux échéances (ex. 2 = tous les 2 jours) */
  intervalle?: number;
  /** Heure prévue de la dépense au format HH:MM (ex. « 08:30 »). */
  heure?: string;
  /** Heure de l'alarme de rappel au format HH:MM. */
  heureRappel?: string;
  actif: boolean;
};

export type Remboursement = {
  id: string;
  montant: number;
  date: string;
  note?: string | undefined;
  /** Transfert de compte créé par ce remboursement, s'il y en a un. */
  transfertId?: string | undefined;
};

/** Paiement échelonné programmé d'une dette (ou d'une créance attendue). */
export type EcheancierDette = {
  /** Montant de chaque versement. */
  montant: number;
  /** Nombre d'unités entre deux versements (1 à 31). */
  intervalle: number;
  unite: UniteRappel;
  /** Prochaine échéance (YYYY-MM-DD). */
  prochaine: string;
  /** Heure de l'alarme de rappel (HH:MM). */
  heure: string;
  /** Compte à utiliser pour le versement. */
  compte?: string | undefined;
  actif: boolean;
};

export type Dette = {
  id: string;
  /** Personne concernée (prêteur ou emprunteur). */
  personne: string;
  /** "dette" = je dois ; "creance" = on me doit. */
  sens: "dette" | "creance";
  montantInitial: number;
  note?: string | undefined;
  /** Date limite de remboursement (YYYY-MM-DD), optionnelle. */
  dateLimite?: string | undefined;
  /** Paiement échelonné programmé, avec alarme de rappel. */
  echeancier?: EcheancierDette | undefined;
  creeLe: string;
  remboursements: Remboursement[];
};

/** Montant restant dû sur une dette ou créance. */
export function resteDu(d: Dette): number {
  const rembourse = d.remboursements.reduce((s, r) => s + r.montant, 0);
  return Math.max(0, d.montantInitial - rembourse);
}

/** Compte dédié à tout ce que je dois à quelqu'un. */
export const COMPTE_DETTES = "Je dois à quelqu'un 🤔";
/** Compte dédié à tout ce que quelqu'un me doit. */
export const COMPTE_CREANCES = "Quelqu'un me doit 🤔";
/** Compte dédié aux tontines : il reçoit le contenu des enveloppes de tontine. */
export const COMPTE_TONTINES = "Tontines 🤝";

/** Comptes créés automatiquement : ni renommables, ni supprimables. */
export const COMPTES_SYSTEME: readonly string[] = [
  COMPTE_DETTES,
  COMPTE_CREANCES,
  COMPTE_TONTINES,
];

/** Compte dédié correspondant au sens d'une fiche. */
export function compteDedie(sens: "dette" | "creance"): string {
  return sens === "dette" ? COMPTE_DETTES : COMPTE_CREANCES;
}

/**
 * Aucun compte n'est proposé par défaut : l'utilisateur crée lui-même ses
 * comptes. Seuls les deux comptes dédiés aux dettes et aux créances existent
 * automatiquement.
 */
export const COMPTES: readonly string[] = [];


/**
 * Comptes de mise de côté (épargne, caisse, compte diamant) : par défaut leur
 * argent n'entre pas dans le solde disponible. L'utilisateur peut changer ce
 * choix à la création ou à la modification du compte.
 */
export function estCompteNonDisponible(nom: string): boolean {
  return /(épargne|epargne|caisse|diamant|tontine)/i.test(nom);
}

/** Aucune enveloppe n'est proposée par défaut : l'utilisateur crée les siennes. */
export const ENVELOPPES_PAR_DEFAUT: Enveloppe[] = [];

/** Aucun groupe ni sous-groupe par défaut : l'utilisateur crée les siens. */
export const CATEGORIES_PAR_DEFAUT: CategorieEnveloppe[] = [];

const SOURCES_REVENU = ["Salaire", "Activité", "Aide famille", "Prime", "Autre"];

export type Etat = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  categories: CategorieEnveloppe[];
  comptes: string[];
  /**
   * Comptes exclus du « solde disponible » (épargne, caisse, compte diamant…).
   * Leur solde et les enveloppes qui en tirent leur source ne sont pas comptés.
   */
  comptesExclus: string[];
  /**
   * Ordre d'affichage personnalisé des comptes. Vide = tri alphabétique
   * automatique ; sinon, les comptes listés ici priment sur l'alphabet.
   */
  ordreComptes: string[];
  /** Icône (emoji) associée à chaque compte, pour un repérage visuel rapide. */
  iconesComptes: Record<string, string>;
  transferts: Transfert[];
  /** Règles de transfert automatique déclenchées par chaque revenu. */
  reglesTransfert: RegleTransfert[];
  /**
   * Comptes repérés à leur création comme réservés aux transferts automatiques :
   * ils sont présentés à part pour ne pas être mélangés aux autres comptes.
   */
  comptesReserves: string[];
  /**
   * Compte réellement débité lorsqu'un revenu arrive sur un compte donné :
   * « compte crédité → compte à débiter pour les transferts automatiques ».
   * Absent = le compte crédité est débité lui-même.
   */
  comptesRelais: Record<string, string>;
  /** Approvisionnements des enveloppes depuis les comptes. */
  remplissages: Remplissage[];
  budgets: Budget[];
  dettes: Dette[];
  objectifs: Objectif[];
  /** Opérations supprimées, récupérables pendant 30 jours. */
  corbeille: ElementCorbeille[];
  /** Membres du foyer (mode couple) ; vide = mode simple. */
  membres: string[];
  transparence: number;
  nomUtilisateur?: string;
};

/** Durée de conservation d'une opération supprimée, en jours. */
export const JOURS_CORBEILLE = 30;

/**
 * Ordre d'affichage effectif des comptes : ordre personnalisé s'il existe
 * (complété par les comptes nouveaux), sinon tri alphabétique français.
 */
export function ordreEffectifComptes(comptes: string[], ordre: string[]): string[] {
  const personnalise = ordre.filter((c) => comptes.includes(c));
  const base =
    personnalise.length > 0 ? personnalise : [...comptes].sort((a, b) => a.localeCompare(b, "fr"));
  for (const c of comptes) if (!base.includes(c)) base.push(c);
  return base;
}

/**
 * Ramène un état de provenance inconnue (stockage, sauvegarde importée,
 * dépôt de synchronisation) à un état sain : tout élément invalide est écarté
 * plutôt que d'empoisonner les soldes.
 */
/** Ne conserve que des paires « compte → emoji » exploitables. */
function assainirIconesComptes(brut: unknown): Record<string, string> {
  if (!brut || typeof brut !== "object") return {};
  const sortie: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const nom = texteSur(cle, 60);
    const emoji = texteSur(valeur, 8);
    if (nom && emoji) sortie[nom] = emoji;
  }
  return sortie;
}

/**
 * Ne conserve que des paires « compte crédité → compte à débiter » valides :
 * les deux comptes existent et sont différents.
 */
function assainirComptesRelais(brut: unknown, comptes: string[]): Record<string, string> {
  if (!brut || typeof brut !== "object") return {};
  const sortie: Record<string, string> = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const credite = texteSur(cle, 60);
    const relais = texteSur(valeur, 60);
    if (!credite || !relais || credite === relais) continue;
    if (!comptes.includes(credite) || !comptes.includes(relais)) continue;
    sortie[credite] = relais;
  }
  return sortie;
}

export function assainirEtat(brut: Partial<Etat>): Etat {
  const enveloppes = assainirListe(brut.enveloppes, assainirEnveloppe);
  const comptesLus = assainirComptes(brut.comptes);
  // Les deux comptes dédiés aux dettes et aux créances existent toujours :
  // c'est là que se reflète tout ce que je dois et tout ce qu'on me doit.
  const comptes = [
    ...comptesLus,
    ...COMPTES_SYSTEME.filter((c) => !comptesLus.includes(c)),
  ];
  const exclusLus = brut.comptesExclus
    ? assainirComptes(brut.comptesExclus)
    : comptes.filter((c) => estCompteNonDisponible(c));
  const limite = Date.now() - JOURS_CORBEILLE * 86400000;
  return {
    transactions: assainirListe(brut.transactions, assainirTransaction),
    enveloppes,
    categories: assainirListe(brut.categories, assainirCategorie),
    comptes,
    // Ces comptes de suivi ne gonflent jamais le solde disponible.
    comptesExclus: Array.from(new Set([...exclusLus, ...COMPTES_SYSTEME])),
    ordreComptes: brut.ordreComptes ? assainirComptes(brut.ordreComptes) : [],
    iconesComptes: assainirIconesComptes(brut.iconesComptes),

    transferts: assainirListe(brut.transferts, assainirTransfert),
    reglesTransfert: assainirListe(brut.reglesTransfert, assainirRegleTransfert).filter(
      (r) => r.destination !== r.source,
    ),
    comptesReserves: brut.comptesReserves
      ? assainirComptes(brut.comptesReserves).filter((c) => comptes.includes(c))
      : [],
    comptesRelais: assainirComptesRelais(brut.comptesRelais, comptes),
    remplissages: assainirListe(brut.remplissages, assainirRemplissage),
    budgets: assainirListe(brut.budgets, assainirBudget),
    dettes: assainirListe(brut.dettes, assainirDette),
    objectifs: assainirListe(brut.objectifs, assainirObjectif),
    corbeille: assainirListe(brut.corbeille, assainirElementCorbeille).filter(
      (c) => new Date(c.supprimeLe).getTime() >= limite,
    ),
    membres: assainirMembres(brut.membres),
    transparence: Math.min(100, Math.max(0, nombreSur(brut.transparence, 85))),
    nomUtilisateur: texteSur(brut.nomUtilisateur, 60),
  };
}

const ETAT_INITIAL: Etat = {
  transactions: [],
  enveloppes: ENVELOPPES_PAR_DEFAUT,
  categories: CATEGORIES_PAR_DEFAUT,
  comptes: [...COMPTES_SYSTEME],
  comptesExclus: [...COMPTES_SYSTEME],
  ordreComptes: [],
  iconesComptes: {},
  transferts: [],
  reglesTransfert: [],
  comptesReserves: [],
  remplissages: [],
  budgets: [],
  dettes: [],
  objectifs: [],
  corbeille: [],
  membres: [],
  transparence: 85,
  nomUtilisateur: "",
};

type Contexte = Etat & {
  sourcesRevenu: string[];
  ajouterTransaction: (t: Omit<Transaction, "id">) => void;
  supprimerTransaction: (id: string) => void;
  /** Change l'enveloppe d'une dépense déjà enregistrée (classement manuel). */
  reclasserTransaction: (id: string, enveloppeId: string) => void;
  ajouterCompte: (
    nom: string,
    dansDisponible?: boolean,
    emoji?: string,
    /** Compte réservé aux transferts automatiques, présenté à part. */
    reserve?: boolean,
    /** Vrai lorsque le compte a bien été retenu. */
  ) => boolean;
  definirIconeCompte: (nom: string, emoji: string) => void;
  /** Indique si un compte entre ou non dans le solde disponible. */
  definirCompteDisponible: (nom: string, dansDisponible: boolean) => void;
  renommerCompte: (ancien: string, nouveau: string) => void;
  supprimerCompte: (nom: string) => void;
  /** Déplace un compte d'un cran dans l'ordre d'affichage personnalisé. */
  deplacerCompte: (nom: string, sens: "haut" | "bas") => void;
  /** Rétablit le tri alphabétique automatique des comptes. */
  reinitialiserOrdreComptes: () => void;
  ajouterTransfert: (t: Omit<Transfert, "id">) => void;
  supprimerTransfert: (id: string) => void;
  /** Crée une règle de transfert automatique et renvoie son identifiant. */
  ajouterRegleTransfert: (r: Omit<RegleTransfert, "id" | "creeLe">) => string | null;
  modifierRegleTransfert: (id: string, r: Partial<Omit<RegleTransfert, "id" | "creeLe">>) => void;
  supprimerRegleTransfert: (id: string) => void;
  /** Marque un compte comme réservé aux transferts automatiques (ou non). */
  definirCompteReserve: (nom: string, reserve: boolean) => void;
  /** Crée l'enveloppe et renvoie son identifiant (null si refusée). */
  ajouterEnveloppe: (e: Omit<Enveloppe, "id">) => string | null;
  /** Verse un montant d'un compte vers une enveloppe (dotation + débit compte). */
  remplirEnveloppe: (
    enveloppeId: string,
    montant: number,
    compte: string,
    origine?: Remplissage["origine"],
    date?: string,
  ) => void;
  /**
   * Cotisation de tontine confirmée : l'enveloppe associée renvoie tout son
   * contenu vers le compte « Tontines ».
   */
  verserEnveloppeVersTontines: (
    enveloppeId: string,
    date?: string,
    note?: string,
    objectifId?: string,
  ) => void;
  /** Déplace une dotation d'une enveloppe vers une autre (plan de secours). */
  transfererEntreEnveloppes: (sourceId: string, cibleId: string, montant: number) => void;
  modifierEnveloppe: (id: string, e: Partial<Omit<Enveloppe, "id">>) => void;
  supprimerEnveloppe: (id: string) => void;
  deplacerEnveloppe: (id: string, sens: "haut" | "bas") => void;
  ajouterCategorie: (nom: string, emoji?: string) => void;
  definirIconeCategorie: (id: string, emoji: string) => void;
  renommerCategorie: (id: string, nom: string) => void;
  supprimerCategorie: (id: string) => void;
  ajouterSousCategorie: (id: string, nom: string) => void;
  renommerSousCategorie: (id: string, ancien: string, nom: string) => void;
  supprimerSousCategorie: (id: string, nom: string) => void;
  /** Déplace une sous-catégorie (et ses enveloppes) vers une autre catégorie. */
  deplacerSousCategorie: (idSource: string, nom: string, idCible: string) => void;
  reordonnerCategories: (depuis: number, vers: number) => void;
  reordonnerSousCategories: (id: string, depuis: number, vers: number) => void;
  restaurerCategories: (liste: CategorieEnveloppe[]) => void;
  ajouterBudget: (b: Omit<Budget, "id">) => void;
  convertirBudget: (id: string, fois?: number) => void;
  genererEcheancesDues: () => void;
  /**
   * L'échéance n'a pas été réalisée : aucune dépense n'est créée et la
   * dépense est replanifiée (prochaine occurrence, ou dans `joursReport`
   * jours pour une dépense ponctuelle).
   */
  reporterBudget: (id: string, joursReport?: number) => void;
  modifierBudget: (id: string, b: Partial<Omit<Budget, "id">>) => void;
  supprimerBudget: (id: string) => void;
  ajouterDette: (
    d: Omit<Dette, "id" | "creeLe" | "remboursements">,
    compte?: string,
    /** Enveloppe qui finance le prêt : son contenu part vers le compte dédié. */
    enveloppeId?: string,
  ) => void;
  modifierDette: (id: string, d: Partial<Omit<Dette, "id" | "remboursements">>) => void;
  supprimerDette: (id: string) => void;
  ajouterRemboursement: (detteId: string, r: Omit<Remboursement, "id">, compte?: string) => void;
  supprimerRemboursement: (detteId: string, remboursementId: string) => void;
  restaurerTransaction: (id: string) => void;
  supprimerDefinitivement: (id: string) => void;
  viderCorbeille: () => void;
  ajouterObjectif: (o: Omit<Objectif, "id" | "creeLe">) => void;
  modifierObjectif: (id: string, o: Partial<Omit<Objectif, "id" | "creeLe">>) => void;
  supprimerObjectif: (id: string) => void;
  definirMembres: (noms: string[]) => void;
  definirTransparence: (v: number) => void;
  definirNomUtilisateur: (nom: string) => void;
  /** Actions internes non protégées, réservées aux automatismes de l'application. */
  systeme: {
    modifierEnveloppe: (id: string, e: Partial<Omit<Enveloppe, "id">>) => void;
    modifierObjectif: (id: string, o: Partial<Omit<Objectif, "id" | "creeLe">>) => void;
    modifierBudget: (id: string, b: Partial<Omit<Budget, "id">>) => void;
    modifierDette: (id: string, d: Partial<Omit<Dette, "id" | "remboursements">>) => void;
  };
  remplacerEtat: (e: Partial<Etat>) => void;
  etatComplet: () => Etat;
  reinitialiser: () => void;
  totalRevenus: number;
  totalDepenses: number;
  /** Total des frais de transaction supportés ce mois-ci. */
  totalFrais: number;
  solde: number;
  /** Solde des seuls comptes comptés dans le disponible. */
  soldeDisponible: number;
  depensesParEnveloppe: Record<string, number>;
  soldesParCompte: Record<string, number>;
  /** Part du solde de chaque compte déjà réservée aux enveloppes. */
  reservesParCompte: Record<string, number>;
  /** true quand des données existent mais n'ont pas pu être déchiffrées. */
  stockageIllisible: boolean;
  /** true quand la dernière écriture protégée sur le téléphone a échoué. */
  enregistrementEnEchec: boolean;
  /** true tant que la lecture chiffrée initiale n'est pas terminée. */
  chargement: boolean;
};

/**
 * Fusionne l'état lu sur le téléphone avec ce que l'utilisateur a pu saisir
 * pendant le déchiffrement initial : sans cela, une opération enregistrée
 * dans la première seconde d'ouverture était silencieusement écrasée.
 */
function fusionnerPendantChargement(charge: Etat, actuel: Etat): Etat {
  const ajouts = <T extends { id: string }>(depuis: T[], deja: T[]): T[] => {
    const connus = new Set(deja.map((x) => x.id));
    return depuis.filter((x) => !connus.has(x.id));
  };
  // Toutes les entités porteuses d'identifiant sont fusionnées : une
  // enveloppe, un objectif ou une catégorie créés pendant le déchiffrement
  // ne peuvent plus disparaître silencieusement.
  return {
    ...charge,
    transactions: [...ajouts(actuel.transactions, charge.transactions), ...charge.transactions],
    transferts: [...ajouts(actuel.transferts, charge.transferts), ...charge.transferts],
    remplissages: [...ajouts(actuel.remplissages, charge.remplissages), ...charge.remplissages],
    budgets: [...charge.budgets, ...ajouts(actuel.budgets, charge.budgets)],
    dettes: [...charge.dettes, ...ajouts(actuel.dettes, charge.dettes)],
    objectifs: [...charge.objectifs, ...ajouts(actuel.objectifs, charge.objectifs)],
    corbeille: [...ajouts(actuel.corbeille, charge.corbeille), ...charge.corbeille],
    // Les valeurs fournies par défaut ne sont pas des saisies utilisateur.
    // En revanche, toute création réellement effectuée pendant le déchiffrement
    // doit survivre au chargement de l'état enregistré.
    enveloppes: [
      ...ajouts(
        actuel.enveloppes.filter((x) => !ENVELOPPES_PAR_DEFAUT.some((d) => d.id === x.id)),
        charge.enveloppes,
      ),
      ...charge.enveloppes,
    ],
    categories: [
      ...ajouts(
        actuel.categories.filter((x) => !CATEGORIES_PAR_DEFAUT.some((d) => d.id === x.id)),
        charge.categories,
      ),
      ...charge.categories,
    ],
    reglesTransfert: [
      ...charge.reglesTransfert,
      ...ajouts(actuel.reglesTransfert, charge.reglesTransfert),
    ],
    comptesReserves: Array.from(new Set([...charge.comptesReserves, ...actuel.comptesReserves])),
    comptes: [
      ...charge.comptes,
      ...actuel.comptes.filter(
        (c) => !ETAT_INITIAL.comptes.includes(c) && !charge.comptes.includes(c),
      ),
    ],
  };
}

const CLE = "superapp:etat:v1";
// Les composants de routes sont chargés en modules séparés. Pendant un
// rechargement à chaud, le provider et une route peuvent momentanément recevoir
// deux évaluations différentes de ce fichier. Conserver le contexte sur
// globalThis garantit qu'ils utilisent toujours exactement la même instance.
const registreGlobal = globalThis as typeof globalThis & {
  __superAppContext?: Context<Contexte | null>;
};
const SuperAppContext = registreGlobal.__superAppContext ?? createContext<Contexte | null>(null);
registreGlobal.__superAppContext = SuperAppContext;

export function SuperAppProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(ETAT_INITIAL);
  // Tant que la lecture chiffrée n'est pas terminée, on n'écrit rien :
  // cela évite d'écraser les données existantes par l'état initial.
  const pret = useRef(false);
  const [illisible, setIllisible] = useState(false);
  const [echecEcriture, setEchecEcriture] = useState(false);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    // Mode camouflage : session fictive, aucune lecture ni écriture réelle.
    if (camouflageEnCours()) {
      setEtat(ETAT_INITIAL);
      setChargement(false);
      return;
    }
    void (async () => {
      const lecture = await lireSecuriseDetail(CLE);
      if (annule) return;

      if (lecture.statut === "illisible") {
        // Des données EXISTENT mais sont indéchiffrables (secret d'appareil
        // perdu ou fichier abîmé). On n'active JAMAIS l'écriture : écraser
        // reviendrait à détruire définitivement la sauvegarde de l'utilisateur.
        setIllisible(true);
        setChargement(false);
        journaliser(
          "erreur",
          "stockage",
          "Données locales illisibles : écriture suspendue pour ne rien détruire.",
        );
        return;
      }

      if (lecture.statut === "ok") {
        try {
          const charge = assainirEtat(JSON.parse(lecture.valeur) as Partial<Etat>);
          // Fusion : on conserve ce que l'utilisateur a saisi pendant la lecture.
          setEtat((actuel) => fusionnerPendantChargement(charge, actuel));
          // Migration immédiate : réécriture chiffrée des anciennes données en clair.
          let enClair = false;
          try {
            enClair = !estChiffre(window.localStorage.getItem(CLE) ?? "");
          } catch {
            enClair = false;
          }
          if (enClair) await ecrireSecurise(CLE, JSON.stringify(charge));
        } catch {
          // JSON corrompu : même prudence, on ne réécrit rien.
          setIllisible(true);
          setChargement(false);
          journaliser("erreur", "stockage", "Données locales corrompues : écriture suspendue.");
          return;
        }
      }

      // Le drapeau ne passe à true qu'ici : aucune écriture ne peut partir
      // avant que la lecture initiale soit complètement terminée.
      pret.current = true;
      setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    // Chiffrement AES-GCM avant toute écriture sur le téléphone.
    // En mode camouflage, rien n'est jamais écrit : les vraies données restent intactes.
    if (pret.current && !illisible && !camouflageEnCours()) {
      void ecrireSecurise(CLE, JSON.stringify(etat)).then(
        () => setEchecEcriture(false),
        () => {
          journaliser(
            "erreur",
            "stockage",
            "Écriture chiffrée impossible : espace insuffisant ou stockage indisponible.",
          );
          // L'utilisateur doit le savoir tout de suite : sinon il croit sa
          // saisie enregistrée alors qu'elle disparaîtra à la réouverture.
          setEchecEcriture(true);
          toast.error("Cette saisie n'a pas pu être enregistrée sur le téléphone.", {
            description: "Libérez de l'espace, puis ressaisissez-la ou réessayez.",
            id: "echec-enregistrement",
          });
        },
      );
    }
    document.documentElement.style.setProperty("--surface-alpha", String(etat.transparence / 100));
  }, [etat, illisible]);

  /**
   * Verse un montant d'un compte vers une enveloppe : la dotation augmente et
   * le compte source est débité d'autant (le remplissage est historisé).
   */
  const remplirEnveloppe = useCallback(
    (
      enveloppeId: string,
      montant: number,
      compte: string,
      origine: Remplissage["origine"] = "manuel",
      date = new Date().toISOString().slice(0, 10),
    ) => {
      const propre = assainirRemplissage({
        id: crypto.randomUUID(),
        enveloppeId,
        compte,
        montant,
        date,
        origine,
      });
      if (!propre) {
        journaliser(
          "avertissement",
          "application",
          "Remplissage refusé : montant ou compte invalide.",
        );
        return;
      }
      setEtat((e) => ({
        ...e,
        remplissages: [propre, ...e.remplissages],
        enveloppes: e.enveloppes.map((x) =>
          x.id === enveloppeId
            ? {
                ...x,
                dotation: (x.dotation ?? x.plafond) + propre.montant,
                ...(origine === "periode" ? { dernierRemplissage: propre.date } : {}),
              }
            : x,
        ),
      }));
    },
    [],
  );

  const ajouterTransaction = useCallback((t: Omit<Transaction, "id">) => {
    const propre = assainirTransaction({ ...t, id: crypto.randomUUID() });
    if (!propre) {
      journaliser("avertissement", "application", "Opération refusée : montant ou date invalide.");
      return;
    }
    setEtat((e) => {
      const suivant: Etat = { ...e, transactions: [propre, ...e.transactions] };
      if (propre.type !== "revenu") return suivant;

      // Enveloppes alimentées par un pourcentage de chaque revenu du compte :
      // la part est versée aussitôt et débitée du compte crédité.
      const nouveaux: Remplissage[] = [];
      const enveloppes = suivant.enveloppes.map((env) => {
        if (env.modeRemplissage !== "pourcentage") return env;
        if (env.compteSource && env.compteSource !== propre.compte) return env;
        const part = montantSurRevenu(env, propre.montant);
        if (part <= 0) return env;
        nouveaux.push({
          id: crypto.randomUUID(),
          enveloppeId: env.id,
          compte: env.compteSource || propre.compte,
          montant: part,
          date: propre.date.slice(0, 10),
          origine: "revenu",
        });
        return { ...env, dotation: (env.dotation ?? env.plafond) + part };
      });
      // Transferts automatiques : un pourcentage du revenu part aussitôt
      // du compte crédité vers le compte d'affectation choisi par l'utilisateur.
      const automatiques: Transfert[] = [];
      if (propre.origine !== "solde_initial") {
        for (const regle of suivant.reglesTransfert) {
          if (!regle.actif) continue;
          if (regle.source !== "*" && regle.source !== propre.compte) continue;
          if (regle.sourceRevenu !== "*" && regle.sourceRevenu !== propre.categorie) continue;
          if (regle.destination === propre.compte) continue;
          if (!suivant.comptes.includes(regle.destination)) continue;
          const part = Math.round((propre.montant * regle.pourcentage) / 100);
          if (part <= 0) continue;
          const transfert = assainirTransfert({
            id: crypto.randomUUID(),
            source: propre.compte,
            destination: regle.destination,
            montant: part,
            note: `Transfert automatique ${regle.pourcentage} % · ${regle.nom}`,
            date: propre.date.slice(0, 10),
          });
          if (transfert) automatiques.push(transfert);
        }
      }

      if (nouveaux.length === 0 && automatiques.length === 0) return suivant;
      return {
        ...suivant,
        enveloppes,
        remplissages: [...nouveaux, ...suivant.remplissages],
        transferts: [...automatiques, ...suivant.transferts],
      };
    });
  }, []);

  const supprimerTransaction = useCallback((id: string) => {
    setEtat((e) => {
      const cible = e.transactions.find((t) => t.id === id);
      if (!cible) return e;
      const limite = Date.now() - JOURS_CORBEILLE * 86400000;
      const corbeille = e.corbeille.filter(
        (c) => c.id !== id && new Date(c.supprimeLe).getTime() >= limite,
      );
      return {
        ...e,
        transactions: e.transactions.filter((t) => t.id !== id),
        corbeille: [{ ...cible, supprimeLe: new Date().toISOString() }, ...corbeille],
      };
    });
  }, []);

  /** Classement manuel : rattache une dépense existante à une autre enveloppe. */
  const reclasserTransaction = useCallback((id: string, enveloppeId: string) => {
    setEtat((e) => ({
      ...e,
      transactions: e.transactions.map((t) =>
        t.id === id && t.type === "depense" ? { ...t, categorie: enveloppeId } : t,
      ),
    }));
  }, []);

  /** Remet une opération de la corbeille dans les comptes. */
  const restaurerTransaction = useCallback((id: string) => {
    setEtat((e) => {
      const cible = e.corbeille.find((c) => c.id === id);
      if (!cible) return e;
      const { supprimeLe: _supprimeLe, ...operation } = cible;
      if (e.transactions.some((t) => t.id === id)) {
        return { ...e, corbeille: e.corbeille.filter((c) => c.id !== id) };
      }
      return {
        ...e,
        transactions: [operation, ...e.transactions],
        corbeille: e.corbeille.filter((c) => c.id !== id),
      };
    });
  }, []);

  const supprimerDefinitivement = useCallback((id: string) => {
    setEtat((e) => ({ ...e, corbeille: e.corbeille.filter((c) => c.id !== id) }));
  }, []);

  const viderCorbeille = useCallback(() => setEtat((e) => ({ ...e, corbeille: [] })), []);

  const ajouterObjectif = useCallback((o: Omit<Objectif, "id" | "creeLe">) => {
    const propre = assainirObjectif({
      ...o,
      id: crypto.randomUUID(),
      creeLe: new Date().toISOString(),
    });
    if (!propre) {
      journaliser("avertissement", "application", "Objectif refusé : montant ou date invalide.");
      return;
    }
    setEtat((e) => ({ ...e, objectifs: [...e.objectifs, propre] }));
  }, []);

  const modifierObjectif = useCallback(
    (id: string, o: Partial<Omit<Objectif, "id" | "creeLe">>) => {
      setEtat((e) => ({
        ...e,
        objectifs: e.objectifs.map((x) => {
          if (x.id !== id) return x;
          return assainirObjectif({ ...x, ...o }) ?? x;
        }),
      }));
    },
    [],
  );

  const supprimerObjectif = useCallback((id: string) => {
    setEtat((e) => ({ ...e, objectifs: e.objectifs.filter((o) => o.id !== id) }));
  }, []);

  const definirMembres = useCallback((noms: string[]) => {
    setEtat((e) => ({ ...e, membres: assainirMembres(noms) }));
  }, []);

  const ajouterCompte = useCallback(
    (nom: string, dansDisponible = true, emoji?: string, reserve = false): boolean => {
      const propre = texteSur(nom, 60);
      if (!propre) {
        journaliser("avertissement", "application", "Compte refusé : nom invalide.");
        return false;
      }
      const icone = texteSur(emoji, 8);
      setEtat((e) => {
        if (e.comptes.includes(propre)) return e;
        const exclus = dansDisponible
          ? e.comptesExclus.filter((c) => c !== propre)
          : [...e.comptesExclus, propre];
        return {
          ...e,
          comptes: [...e.comptes, propre],
          // Le nouveau compte arrive en tête de liste ; les comptes déjà
          // présents conservent exactement leur ordre d'affichage actuel.
          ordreComptes: e.ordreComptes.includes(propre)
            ? e.ordreComptes
            : [propre, ...ordreEffectifComptes(e.comptes, e.ordreComptes)],
          comptesExclus: exclus,
          comptesReserves: reserve ? [...e.comptesReserves, propre] : e.comptesReserves,
          iconesComptes: icone ? { ...e.iconesComptes, [propre]: icone } : e.iconesComptes,
        };
      });
      return true;
    },
    [],
  );

  const definirCompteReserve = useCallback((nom: string, reserve: boolean) => {
    setEtat((e) => {
      if (!e.comptes.includes(nom)) return e;
      return {
        ...e,
        comptesReserves: reserve
          ? e.comptesReserves.includes(nom)
            ? e.comptesReserves
            : [...e.comptesReserves, nom]
          : e.comptesReserves.filter((c) => c !== nom),
      };
    });
  }, []);

  const definirIconeCompte = useCallback((nom: string, emoji: string) => {
    const icone = texteSur(emoji, 8);
    setEtat((e) => {
      if (!e.comptes.includes(nom)) return e;
      const icones = { ...e.iconesComptes };
      if (icone) icones[nom] = icone;
      else delete icones[nom];
      return { ...e, iconesComptes: icones };
    });
  }, []);

  const definirCompteDisponible = useCallback((nom: string, dansDisponible: boolean) => {
    setEtat((e) => ({
      ...e,
      comptesExclus: dansDisponible
        ? e.comptesExclus.filter((c) => c !== nom)
        : e.comptesExclus.includes(nom)
          ? e.comptesExclus
          : [...e.comptesExclus, nom],
    }));
  }, []);

  const renommerCompte = useCallback((ancien: string, nouveau: string) => {
    const propre = texteSur(nouveau, 60);
    if (!propre || ancien === propre) return;
    // Les comptes créés automatiquement gardent toujours leur nom.
    if (COMPTES_SYSTEME.includes(ancien)) {
      journaliser(
        "avertissement",
        "application",
        `Renommage refusé : « ${ancien} » est un compte créé automatiquement.`,
      );
      return;
    }
    setEtat((e) => {
      if (!e.comptes.includes(ancien) || e.comptes.some((c) => c === propre && c !== ancien)) return e;
      return {
        ...e,
        comptes: e.comptes.map((c) => (c === ancien ? propre : c)),
        comptesExclus: e.comptesExclus.map((c) => (c === ancien ? propre : c)),
        comptesReserves: e.comptesReserves.map((c) => (c === ancien ? propre : c)),
        reglesTransfert: e.reglesTransfert.map((r) => ({
          ...r,
          source: r.source === ancien ? propre : r.source,
          destination: r.destination === ancien ? propre : r.destination,
        })),
        ordreComptes: e.ordreComptes.map((c) => (c === ancien ? propre : c)),
        iconesComptes: Object.fromEntries(
          Object.entries(e.iconesComptes).map(([c, i]) => [c === ancien ? propre : c, i]),
        ),
        transactions: e.transactions.map((t) =>
          t.compte === ancien ? { ...t, compte: propre } : t,
        ),
        transferts: e.transferts.map((t) => ({
          ...t,
          source: t.source === ancien ? propre : t.source,
          destination: t.destination === ancien ? propre : t.destination,
        })),
        enveloppes: e.enveloppes.map((v) =>
          v.compteSource === ancien ? { ...v, compteSource: propre } : v,
        ),
        objectifs: e.objectifs.map((o) => ({
          ...o,
          compteSource: o.compteSource === ancien ? propre : o.compteSource,
          compteEpargne: o.compteEpargne === ancien ? propre : o.compteEpargne,
        })),
        budgets: e.budgets.map((b) => (b.compte === ancien ? { ...b, compte: propre } : b)),
        remplissages: e.remplissages.map((r) =>
          r.compte === ancien ? { ...r, compte: propre } : r,
        ),
        dettes: e.dettes.map((d) =>
          d.echeancier?.compte === ancien
            ? { ...d, echeancier: { ...d.echeancier, compte: propre } }
            : d,
        ),
      };
    });
  }, []);

  const supprimerCompte = useCallback((nom: string) => {
    // Dettes, créances et tontines sont des comptes permanents de l'application.
    if (COMPTES_SYSTEME.includes(nom)) {
      journaliser(
        "avertissement",
        "application",
        `Suppression refusée : « ${nom} » est un compte permanent de l'application.`,
      );
      return;
    }
    setEtat((e) => {
      // Garde-fou métier : un compte encore référencé ne peut pas disparaître,
      // sinon ses opérations deviendraient orphelines et fausseraient les soldes.
      const utilise =
        e.transactions.some((t) => t.compte === nom) ||
        e.transferts.some((t) => t.source === nom || t.destination === nom) ||
        e.budgets.some((b) => b.compte === nom) ||
        // Une enveloppe alimentée par ce compte continuerait de tirer de
        // l'argent d'un compte disparu : le renouvellement deviendrait invisible.
        e.enveloppes.some((v) => v.compteSource === nom) ||
        // Idem pour l'épargne automatique des objectifs.
        e.objectifs.some((o) => o.compteSource === nom || o.compteEpargne === nom) ||
        e.remplissages.some((r) => r.compte === nom) ||
        e.dettes.some((d) => d.echeancier?.compte === nom) ||
        // Une règle de transfert automatique pointerait vers un compte disparu.
        e.reglesTransfert.some((r) => r.source === nom || r.destination === nom);
      if (utilise) {
        journaliser(
          "avertissement",
          "application",
          `Suppression refusée : le compte « ${nom} » est encore utilisé.`,
        );
        return e;
      }
      return {
        ...e,
        comptes: e.comptes.filter((c) => c !== nom),
        comptesExclus: e.comptesExclus.filter((c) => c !== nom),
        comptesReserves: e.comptesReserves.filter((c) => c !== nom),
        iconesComptes: Object.fromEntries(
          Object.entries(e.iconesComptes).filter(([c]) => c !== nom),
        ),
      };
    });
  }, []);

  const deplacerCompte = useCallback((nom: string, sens: "haut" | "bas") => {
    setEtat((e) => {
      const base = ordreEffectifComptes(e.comptes, e.ordreComptes);
      const i = base.indexOf(nom);
      const j = sens === "haut" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= base.length) return e;
      [base[i], base[j]] = [base[j]!, base[i]!];
      return { ...e, ordreComptes: base };
    });
  }, []);

  const reinitialiserOrdreComptes = useCallback(() => {
    setEtat((e) => (e.ordreComptes.length === 0 ? e : { ...e, ordreComptes: [] }));
  }, []);

  const ajouterTransfert = useCallback((t: Omit<Transfert, "id">) => {
    const propre = assainirTransfert({ ...t, id: crypto.randomUUID() });
    if (!propre) {
      journaliser("avertissement", "application", "Transfert refusé : données invalides.");
      return;
    }
    setEtat((e) => ({ ...e, transferts: [propre, ...e.transferts] }));
  }, []);

  const supprimerTransfert = useCallback((id: string) => {
    setEtat((e) => ({ ...e, transferts: e.transferts.filter((t) => t.id !== id) }));
  }, []);

  const ajouterRegleTransfert = useCallback(
    (r: Omit<RegleTransfert, "id" | "creeLe">): string | null => {
      const propre = assainirRegleTransfert({
        ...r,
        id: crypto.randomUUID(),
        creeLe: new Date().toISOString().slice(0, 10),
      });
      if (!propre) {
        journaliser(
          "avertissement",
          "application",
          "Règle de transfert refusée : comptes ou pourcentage invalides.",
        );
        return null;
      }
      setEtat((e) => ({ ...e, reglesTransfert: [...e.reglesTransfert, propre] }));
      return propre.id;
    },
    [],
  );

  const modifierRegleTransfert = useCallback(
    (id: string, r: Partial<Omit<RegleTransfert, "id" | "creeLe">>) => {
      setEtat((e) => ({
        ...e,
        reglesTransfert: e.reglesTransfert.map((x) =>
          x.id === id ? (assainirRegleTransfert({ ...x, ...r }) ?? x) : x,
        ),
      }));
    },
    [],
  );

  const supprimerRegleTransfert = useCallback((id: string) => {
    setEtat((e) => ({ ...e, reglesTransfert: e.reglesTransfert.filter((r) => r.id !== id) }));
  }, []);

  const ajouterEnveloppe = useCallback((env: Omit<Enveloppe, "id">): string | null => {
    const propre = assainirEnveloppe({ ...env, id: crypto.randomUUID() });
    if (!propre) {
      journaliser("avertissement", "application", "Enveloppe refusée : nom ou montant invalide.");
      return null;
    }
    // La nouvelle enveloppe apparaît en tête de liste ; les autres gardent leur ordre.
    setEtat((e) => ({ ...e, enveloppes: [propre, ...e.enveloppes] }));
    return propre.id;
  }, []);

  /**
   * Déplace une part de dotation d'une enveloppe vers une autre.
   * Aucun compte n'est débité : l'argent est déjà sorti du compte au
   * remplissage, on ne fait que le réaffecter entre enveloppes.
   */
  const transfererEntreEnveloppes = useCallback(
    (sourceId: string, cibleId: string, montant: number) => {
      if (!montantPositifOuNul(montant) || montant <= 0 || sourceId === cibleId) return;
      setEtat((e) => {
        const source = e.enveloppes.find((x) => x.id === sourceId);
        const cible = e.enveloppes.find((x) => x.id === cibleId);
        if (!source || !cible) return e;
        const dispoSource = source.dotation ?? source.plafond;
        const somme = Math.min(Math.round(montant), Math.round(dispoSource));
        if (!(somme > 0)) return e;
        journaliser(
          "info",
          "application",
          `Secours : ${somme} FCFA déplacés de ${source.nom} vers ${cible.nom}.`,
        );
        return {
          ...e,
          enveloppes: e.enveloppes.map((x) => {
            if (x.id === sourceId) return { ...x, dotation: (x.dotation ?? x.plafond) - somme };
            if (x.id === cibleId) return { ...x, dotation: (x.dotation ?? x.plafond) + somme };
            return x;
          }),
        };
      });
    },
    [],
  );

  /**
   * Cotisation de tontine confirmée : l'enveloppe associée renvoie tout son
   * contenu vers le compte « Tontines ». Le mouvement est un vrai transfert
   * depuis le compte qui alimentait l'enveloppe, et l'enveloppe repart à zéro.
   */
  const verserEnveloppeVersTontines = useCallback(
    (
      enveloppeId: string,
      date = new Date().toISOString().slice(0, 10),
      note = "",
      objectifId = "",
    ) => {
      setEtat((e) => {
        const env = e.enveloppes.find((x) => x.id === enveloppeId);
        if (!env) return e;
        const contenu = Math.round(env.dotation ?? env.plafond);
        const source = env.compteSource ?? "";
        if (!(contenu > 0) || !source || source === COMPTE_TONTINES) return e;
        const transfert = assainirTransfert({
          id: crypto.randomUUID(),
          source,
          destination: COMPTE_TONTINES,
          montant: contenu,
          note: note || `Tontine : enveloppe ${env.nom}`,
          date,
          ...(objectifId ? { objectifId } : {}),
        });
        if (!transfert) return e;
        journaliser(
          "info",
          "application",
          `Tontine : ${contenu} FCFA de l'enveloppe ${env.nom} versés au compte Tontines.`,
        );
        return {
          ...e,
          transferts: [transfert, ...e.transferts],
          enveloppes: e.enveloppes.map((x) => (x.id === enveloppeId ? { ...x, dotation: 0 } : x)),
        };
      });
    },
    [],
  );

  const modifierEnveloppe = useCallback((id: string, env: Partial<Omit<Enveloppe, "id">>) => {
    if (env.plafond !== undefined && !montantPositifOuNul(env.plafond)) return;
    if (env.dotation !== undefined && !montantPositifOuNul(env.dotation)) return;
    setEtat((e) => ({
      ...e,
      enveloppes: e.enveloppes.map((x) =>
        x.id === id ? (assainirEnveloppe({ ...x, ...env }) ?? x) : x,
      ),
    }));
  }, []);

  const supprimerEnveloppe = useCallback((id: string) => {
    setEtat((e) => ({
      ...e,
      enveloppes: e.enveloppes.filter((x) => x.id !== id),
      budgets: e.budgets.filter((b) => b.enveloppeId !== id),
    }));
  }, []);

  /** Déplace une enveloppe d'un cran vers le haut ou le bas dans sa catégorie. */
  const deplacerEnveloppe = useCallback((id: string, sens: "haut" | "bas") => {
    setEtat((e) => {
      const liste = [...e.enveloppes];
      const index = liste.findIndex((x) => x.id === id);
      const courante = liste[index];
      if (!courante) return e;
      const cat = (courante.categorie ?? "").trim();
      const memeCat = (x: Enveloppe | undefined) => (x?.categorie ?? "").trim() === cat;
      let voisin = -1;
      if (sens === "haut") {
        for (let i = index - 1; i >= 0; i -= 1)
          if (memeCat(liste[i])) {
            voisin = i;
            break;
          }
      } else {
        for (let i = index + 1; i < liste.length; i += 1)
          if (memeCat(liste[i])) {
            voisin = i;
            break;
          }
      }
      const autre = voisin < 0 ? undefined : liste[voisin];
      if (!autre) return e;
      liste[index] = autre;
      liste[voisin] = courante;

      return { ...e, enveloppes: liste };
    });
  }, []);

  const ajouterCategorie = useCallback((nom: string, emoji?: string) => {
    const icone = texteSur(emoji, 8);
    setEtat((e) =>
      e.categories.some((c) => c.nom === nom)
        ? e
        : {
            ...e,
            // La nouvelle catégorie s'affiche en haut de la liste.
            categories: [
              {
                id: crypto.randomUUID(),
                nom,
                sousCategories: [],
                ...(icone ? { emoji: icone } : {}),
              },
              ...e.categories,
            ],
          },
    );
  }, []);

  const definirIconeCategorie = useCallback((id: string, emoji: string) => {
    const icone = texteSur(emoji, 8);
    setEtat((e) => ({
      ...e,
      categories: e.categories.map((c) => {
        if (c.id !== id) return c;
        const { emoji: _ancien, ...reste } = c;
        return icone ? { ...reste, emoji: icone } : reste;
      }),
    }));
  }, []);

  const renommerCategorie = useCallback((id: string, nom: string) => {
    setEtat((e) => {
      const cible = e.categories.find((c) => c.id === id);
      if (!cible) return e;
      return {
        ...e,
        categories: e.categories.map((c) => (c.id === id ? { ...c, nom } : c)),
        enveloppes: e.enveloppes.map((x) =>
          (x.categorie ?? "") === cible.nom ? { ...x, categorie: nom } : x,
        ),
      };
    });
  }, []);

  const supprimerCategorie = useCallback((id: string) => {
    setEtat((e) => {
      const cible = e.categories.find((c) => c.id === id);
      if (!cible) return e;
      return {
        ...e,
        categories: e.categories.filter((c) => c.id !== id),
        enveloppes: e.enveloppes.map((x) =>
          (x.categorie ?? "") === cible.nom ? { ...x, categorie: "", sousCategorie: "" } : x,
        ),
      };
    });
  }, []);

  const ajouterSousCategorie = useCallback((id: string, nom: string) => {
    setEtat((e) => ({
      ...e,
      categories: e.categories.map((c) =>
        c.id === id && !c.sousCategories.includes(nom)
          ? // La nouvelle sous-catégorie s'affiche en haut de la liste.
            { ...c, sousCategories: [nom, ...c.sousCategories] }
          : c,
      ),
    }));
  }, []);

  /**
   * Déplace une sous-catégorie entière vers une autre catégorie : les
   * enveloppes qu'elle contient suivent automatiquement.
   */
  const deplacerSousCategorie = useCallback((idSource: string, nom: string, idCible: string) => {
    setEtat((e) => {
      if (idSource === idCible) return e;
      const source = e.categories.find((c) => c.id === idSource);
      const cible = e.categories.find((c) => c.id === idCible);
      if (!source || !cible || !source.sousCategories.includes(nom)) return e;
      if (cible.sousCategories.includes(nom)) return e;
      return {
        ...e,
        categories: e.categories.map((c) => {
          if (c.id === idSource)
            return { ...c, sousCategories: c.sousCategories.filter((s) => s !== nom) };
          if (c.id === idCible) return { ...c, sousCategories: [nom, ...c.sousCategories] };
          return c;
        }),
        enveloppes: e.enveloppes.map((x) =>
          (x.categorie ?? "") === source.nom && (x.sousCategorie ?? "") === nom
            ? { ...x, categorie: cible.nom, sousCategorie: nom }
            : x,
        ),
      };
    });
  }, []);

  const renommerSousCategorie = useCallback((id: string, ancien: string, nom: string) => {
    setEtat((e) => {
      const cible = e.categories.find((c) => c.id === id);
      if (!cible) return e;
      return {
        ...e,
        categories: e.categories.map((c) =>
          c.id === id
            ? { ...c, sousCategories: c.sousCategories.map((s) => (s === ancien ? nom : s)) }
            : c,
        ),
        enveloppes: e.enveloppes.map((x) =>
          (x.categorie ?? "") === cible.nom && (x.sousCategorie ?? "") === ancien
            ? { ...x, sousCategorie: nom }
            : x,
        ),
      };
    });
  }, []);

  const reordonnerCategories = useCallback((depuis: number, vers: number) => {
    setEtat((e) => {
      if (depuis === vers) return e;
      const liste = [...e.categories];
      if (depuis < 0 || depuis >= liste.length || vers < 0 || vers >= liste.length) return e;
      const [item] = liste.splice(depuis, 1);
      liste.splice(vers, 0, item!);
      return { ...e, categories: liste };
    });
  }, []);

  const reordonnerSousCategories = useCallback((id: string, depuis: number, vers: number) => {
    setEtat((e) => ({
      ...e,
      categories: e.categories.map((c) => {
        if (c.id !== id || depuis === vers) return c;
        const liste = [...c.sousCategories];
        if (depuis < 0 || depuis >= liste.length || vers < 0 || vers >= liste.length) return c;
        const [item] = liste.splice(depuis, 1);
        liste.splice(vers, 0, item!);
        return { ...c, sousCategories: liste };
      }),
    }));
  }, []);

  const restaurerCategories = useCallback((liste: CategorieEnveloppe[]) => {
    setEtat((e) => ({ ...e, categories: liste }));
  }, []);

  const supprimerSousCategorie = useCallback((id: string, nom: string) => {
    setEtat((e) => {
      const cible = e.categories.find((c) => c.id === id);
      if (!cible) return e;
      return {
        ...e,
        categories: e.categories.map((c) =>
          c.id === id ? { ...c, sousCategories: c.sousCategories.filter((s) => s !== nom) } : c,
        ),
        enveloppes: e.enveloppes.map((x) =>
          (x.categorie ?? "") === cible.nom && (x.sousCategorie ?? "") === nom
            ? { ...x, sousCategorie: "" }
            : x,
        ),
      };
    });
  }, []);

  const ajouterBudget = useCallback((b: Omit<Budget, "id">) => {
    const propre = assainirBudget({ ...b, id: crypto.randomUUID() });
    if (!propre) {
      journaliser(
        "avertissement",
        "application",
        "Budget refusé : montant, période ou date invalide.",
      );
      return;
    }
    setEtat((e) => ({ ...e, budgets: [propre, ...e.budgets] }));
  }, []);

  const convertirBudget = useCallback((id: string, fois = 1) => {
    setEtat((e) => {
      const b = e.budgets.find((x) => x.id === id);
      if (!b) return e;
      const nouvelles: Transaction[] = [];
      let date = b.prochaine;
      for (let i = 0; i < fois; i += 1) {
        nouvelles.push({
          id: crypto.randomUUID(),
          type: "depense",
          montant: b.montant,
          libelle: b.libelle,
          categorie: b.enveloppeId,
          compte: b.compte,
          date,
          budgetId: b.id,
        });
        date = avancerDate(date, b.periode, b.intervalle);
      }
      return {
        ...e,
        transactions: [...nouvelles, ...e.transactions],
        budgets: e.budgets.map((x) => (x.id === id ? { ...x, prochaine: date } : x)),
      };
    });
  }, []);

  const genererEcheancesDues = useCallback(() => {
    setEtat((e) => {
      const maintenant = Date.now();
      const nouvelles: Transaction[] = [];
      const moisCourant = new Date().toISOString().slice(0, 7);
      const depensesParEnveloppe = new Map<string, number>();
      for (const t of e.transactions) {
        if (t.type !== "depense" || t.date.slice(0, 7) !== moisCourant) continue;
        depensesParEnveloppe.set(
          t.categorie,
          (depensesParEnveloppe.get(t.categorie) ?? 0) + t.montant + (t.frais ?? 0),
        );
      }
      const budgets = e.budgets.map((b) => {
        if (!b.actif) return b;
        let date = b.prochaine;
        let garde = 0;
        while (new Date(date).getTime() <= maintenant && garde < 240) {
          const enveloppe = e.enveloppes.find((v) => v.id === b.enveloppeId);
          const plafond = enveloppe ? dotationDe(enveloppe) : 0;
          const deja = depensesParEnveloppe.get(b.enveloppeId) ?? 0;
          if (plafond > 0 && deja + b.montant > plafond) {
            journaliser(
              "avertissement",
              "application",
              `Échéance « ${b.libelle} » non créée : l’enveloppe « ${enveloppe?.nom ?? "inconnue"} » serait dépassée.`,
            );
            break;
          }
          nouvelles.push({
            id: crypto.randomUUID(),
            type: "depense",
            montant: b.montant,
            libelle: b.libelle,
            categorie: b.enveloppeId,
            compte: b.compte,
            date,
            budgetId: b.id,
          });
          depensesParEnveloppe.set(b.enveloppeId, deja + b.montant);
          date = avancerDate(date, b.periode, b.intervalle);
          garde += 1;
        }
        return garde > 0 ? { ...b, prochaine: date } : b;
      });
      if (nouvelles.length === 0) return e;

      // Cohérence avec la règle appliquée aux transferts : on prévient quand
      // une échéance planifiée fait passer un compte en négatif.
      const soldes: Record<string, number> = {};
      for (const t of e.transactions)
        soldes[t.compte] = (soldes[t.compte] ?? 0) + (t.type === "revenu" ? t.montant : -t.montant);
      for (const t of e.transferts) {
        soldes[t.source] = (soldes[t.source] ?? 0) - t.montant;
        soldes[t.destination] = (soldes[t.destination] ?? 0) + t.montant;
      }
      const decouverts = new Set<string>();
      for (const n of nouvelles) {
        soldes[n.compte] = (soldes[n.compte] ?? 0) - n.montant;
        if ((soldes[n.compte] ?? 0) < 0) decouverts.add(n.compte);
      }
      for (const compte of decouverts) {
        journaliser(
          "avertissement",
          "application",
          `Échéances planifiées : le compte « ${compte} » passe en solde négatif.`,
        );
      }

      return { ...e, transactions: [...nouvelles, ...e.transactions], budgets };
    });
  }, []);

  const reporterBudget = useCallback((id: string, joursReport = 1) => {
    setEtat((e) => ({
      ...e,
      budgets: e.budgets.map((b) => {
        if (b.id !== id) return b;
        // Dépense ponctuelle : on la replanifie automatiquement plus tard,
        // en conservant l'heure choisie par l'utilisateur.
        if (b.ponctuel !== false) {
          const quand = new Date(b.prochaine);
          quand.setDate(quand.getDate() + Math.max(1, Math.round(joursReport)));
          return { ...b, actif: true, prochaine: quand.toISOString() };
        }
        // Dépense récurrente : on saute simplement à l'occurrence suivante.
        return { ...b, prochaine: avancerDate(b.prochaine, b.periode, b.intervalle) };
      }),
    }));
  }, []);

  const modifierBudget = useCallback((id: string, b: Partial<Omit<Budget, "id">>) => {
    if (b.montant !== undefined && !montantValide(b.montant)) return;
    setEtat((e) => ({
      ...e,
      budgets: e.budgets.map((x) => (x.id === id ? (assainirBudget({ ...x, ...b }) ?? x) : x)),
    }));
  }, []);

  const supprimerBudget = useCallback((id: string) => {
    setEtat((e) => ({ ...e, budgets: e.budgets.filter((b) => b.id !== id) }));
  }, []);

  const ajouterDette = useCallback(
    (d: Omit<Dette, "id" | "creeLe" | "remboursements">, compte?: string, enveloppeId?: string) => {
      if (!montantValide(d.montantInitial) || !texteSur(d.personne)) {
        journaliser(
          "avertissement",
          "application",
          "Fiche refusée : montant ou personne invalide.",
        );
        return;
      }
      setEtat((e) => {
        const id = crypto.randomUUID();
        const creeLe = new Date().toISOString().slice(0, 10);
        const fiche: Dette = { ...d, id, creeLe, remboursements: [] };
        const dedie = compteDedie(d.sens);
        // Miroir sur le compte dédié : une dette pèse en moins sur
        // « Je dois à quelqu'un », une créance s'inscrit sur
        // « Quelqu'un me doit » et disparaîtra au remboursement.
        const miroir: Transaction = {
          id: crypto.randomUUID(),
          type: d.sens === "dette" ? "depense" : "revenu",
          montant: d.montantInitial,
          libelle: d.sens === "dette" ? `Dette envers ${d.personne}` : `Créance sur ${d.personne}`,
          categorie: "dettes",
          compte: dedie,
          date: new Date(creeLe).toISOString(),
          detteId: id,
        };
        // Enveloppe qui finance l'opération : son contenu s'épuise d'autant et
        // le mouvement d'argent part du compte qui alimentait cette enveloppe,
        // pour que l'enveloppe, le compte et le compte dédié restent d'accord.
        const enveloppe = enveloppeId ? e.enveloppes.find((v) => v.id === enveloppeId) : undefined;
        const ponction = enveloppe
          ? Math.min(Math.round(d.montantInitial), Math.round(enveloppe.dotation ?? enveloppe.plafond))
          : 0;
        const compteEffectif = compte || (enveloppe?.compteSource ?? "");
        let etatSuivant: Etat = {
          ...e,
          dettes: [fiche, ...e.dettes],
          transactions: [miroir, ...e.transactions],
        };
        if (enveloppe && ponction > 0) {
          journaliser(
            "info",
            "application",
            `${d.sens === "creance" ? "Prêt" : "Dette"} : ${ponction} FCFA retirés de l'enveloppe ${enveloppe.nom} et reflétés sur « ${dedie} ».`,
          );
          etatSuivant = {
            ...etatSuivant,
            enveloppes: etatSuivant.enveloppes.map((v) =>
              v.id === enveloppe.id
                ? { ...v, dotation: Math.max(0, (v.dotation ?? v.plafond) - ponction) }
                : v,
            ),
          };
        }
        if (!compteEffectif) return etatSuivant;
        // Une dette contractée fait entrer de l'argent ; une créance accordée en fait sortir.
        const mouvement: Transaction = {
          id: crypto.randomUUID(),
          type: d.sens === "dette" ? "revenu" : "depense",
          montant: d.montantInitial,
          libelle:
            d.sens === "dette" ? `Emprunt auprès de ${d.personne}` : `Prêt accordé à ${d.personne}`,
          categorie: "dettes",
          compte: compteEffectif,
          date: new Date(creeLe).toISOString(),
          detteId: id,
        };
        return { ...etatSuivant, transactions: [mouvement, ...etatSuivant.transactions] };
      });
    },
    [],
  );

  const modifierDette = useCallback(
    (id: string, d: Partial<Omit<Dette, "id" | "remboursements">>) => {
      if (d.montantInitial !== undefined && !montantValide(d.montantInitial)) return;
      setEtat((e) => {
        const ancienne = e.dettes.find((x) => x.id === id);
        if (!ancienne) return e;
        // Le sens structure les mouvements et remboursements associés. Il ne
        // peut pas être inversé après création sans transformer leur histoire.
        const propre = assainirDette({ ...ancienne, ...d, sens: ancienne.sens });
        if (!propre) return e;
        const dedie = compteDedie(ancienne.sens);
        return {
          ...e,
          dettes: e.dettes.map((x) => (x.id === id ? propre : x)),
          transactions: e.transactions.map((t) => {
            if (t.detteId !== id) return t;
            const miroir = t.compte === dedie;
            return {
              ...t,
              montant: propre.montantInitial,
              type: miroir
                ? propre.sens === "dette"
                  ? "depense"
                  : "revenu"
                : propre.sens === "dette"
                  ? "revenu"
                  : "depense",
              libelle: miroir
                ? propre.sens === "dette"
                  ? `Dette envers ${propre.personne}`
                  : `Créance sur ${propre.personne}`
                : propre.sens === "dette"
                  ? `Emprunt auprès de ${propre.personne}`
                  : `Prêt accordé à ${propre.personne}`,
            };
          }),
        };
      });
    },
    [],
  );

  const supprimerDette = useCallback((id: string) => {
    setEtat((e) => ({
      ...e,
      dettes: e.dettes.filter((x) => x.id !== id),
      // Les mouvements de trésorerie liés à la fiche disparaissent avec elle.
      transactions: e.transactions.filter((t) => t.detteId !== id),
      transferts: e.transferts.filter((t) => t.detteId !== id),
    }));
  }, []);

  const ajouterRemboursement = useCallback(
    (detteId: string, r: Omit<Remboursement, "id">, compte?: string) => {
      if (!montantValide(r.montant)) {
        journaliser("avertissement", "application", "Remboursement refusé : montant invalide.");
        return;
      }
      setEtat((e) => {
        const cible = e.dettes.find((x) => x.id === detteId);
        if (!cible) return e;
        const dedie = compteDedie(cible.sens);
        // Rembourser une dette : l'argent part du compte choisi vers le compte
        // « Je dois à quelqu'un », qui s'allège d'autant. Encaisser une créance :
        // l'argent revient du compte « Quelqu'un me doit » vers le compte choisi.
        const transfert = compte
          ? assainirTransfert({
              id: crypto.randomUUID(),
              source: cible.sens === "dette" ? compte : dedie,
              destination: cible.sens === "dette" ? dedie : compte,
              montant: r.montant,
              note:
                cible.sens === "dette"
                  ? `Remboursement à ${cible.personne}`
                  : `Remboursement reçu de ${cible.personne}`,
              date: new Date(r.date).toISOString(),
              detteId,
            })
          : null;
        const nouveau: Remboursement = {
          ...r,
          id: crypto.randomUUID(),
          ...(transfert ? { transfertId: transfert.id } : {}),
        };
        const dettes = e.dettes.map((x) =>
          x.id === detteId
            ? {
                ...x,
                remboursements: [...x.remboursements, nouveau].sort((a, b) =>
                  a.date.localeCompare(b.date),
                ),
              }
            : x,
        );
        return {
          ...e,
          dettes,
          transferts: transfert ? [transfert, ...e.transferts] : e.transferts,
        };
      });
    },
    [],
  );

  const supprimerRemboursement = useCallback((detteId: string, remboursementId: string) => {
    setEtat((e) => {
      const cible = e.dettes.find((x) => x.id === detteId);
      const lie = cible?.remboursements.find((r) => r.id === remboursementId)?.transfertId;
      return {
        ...e,
        dettes: e.dettes.map((x) =>
          x.id === detteId
            ? { ...x, remboursements: x.remboursements.filter((r) => r.id !== remboursementId) }
            : x,
        ),
        transferts: lie ? e.transferts.filter((t) => t.id !== lie) : e.transferts,
      };
    });
  }, []);

  const definirTransparence = useCallback((v: number) => {
    const propre = Math.min(100, Math.max(0, nombreSur(v, 85)));
    setEtat((e) => ({ ...e, transparence: propre }));
  }, []);

  const definirNomUtilisateur = useCallback((nom: string) => {
    setEtat((e) => ({ ...e, nomUtilisateur: texteSur(nom, 60) }));
  }, []);

  const remplacerEtat = useCallback((nouveau: Partial<Etat>) => {
    // Une copie restaurée rapporte aussi les réglages personnels et les
    // saisies en cours : ils sont remis en place avant l'état principal.
    const extra = nouveau as unknown as {
      reglages?: unknown;
      brouillons?: unknown;
    };
    if (extra.reglages) appliquerReglages(extra.reglages);
    if (extra.brouillons && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(CLE_BROUILLONS, JSON.stringify(extra.brouillons));
      } catch {
        // Espace saturé : l'état principal reste prioritaire.
      }
    }
    // Tout ce qui vient de l'extérieur (sauvegarde, synchronisation) est
    // systématiquement assaini avant d'entrer dans l'application.
    setEtat((e) => assainirEtat({ ...ETAT_INITIAL, ...e, ...nouveau }));
  }, []);

  const etatRef = useRef<Etat>(etat);
  etatRef.current = etat;
  const etatComplet = useCallback(() => etatRef.current, []);

  const reinitialiser = useCallback(() => setEtat(ETAT_INITIAL), []);

  const proteger = useCallback(
    <A extends unknown[]>(fn: (...a: A) => void, libelle: string) =>
      (...a: A) => {
        void demanderMotDePasse(libelle).then((ok) => {
          if (ok) fn(...a);
        });
      },
    [],
  );

  const actions = useMemo(
    () => ({
      ajouterTransaction,
      supprimerTransaction: proteger(supprimerTransaction, "Confirmez la suppression."),
      reclasserTransaction: proteger(reclasserTransaction, "Confirmez la modification."),
      ajouterCompte,
      definirIconeCompte: proteger(definirIconeCompte, "Confirmez la modification."),
      definirCompteDisponible: proteger(definirCompteDisponible, "Confirmez la modification."),
      renommerCompte: proteger(renommerCompte, "Confirmez la modification."),
      supprimerCompte: proteger(supprimerCompte, "Confirmez la suppression."),
      deplacerCompte,
      reinitialiserOrdreComptes,
      ajouterTransfert,
      supprimerTransfert: proteger(supprimerTransfert, "Confirmez la suppression."),
      ajouterRegleTransfert,
      modifierRegleTransfert: proteger(modifierRegleTransfert, "Confirmez la modification."),
      supprimerRegleTransfert: proteger(supprimerRegleTransfert, "Confirmez la suppression."),
      definirCompteReserve: proteger(definirCompteReserve, "Confirmez la modification."),
      ajouterEnveloppe,
      remplirEnveloppe,
      transfererEntreEnveloppes,
      verserEnveloppeVersTontines,
      modifierEnveloppe: proteger(modifierEnveloppe, "Confirmez la modification."),
      supprimerEnveloppe: proteger(supprimerEnveloppe, "Confirmez la suppression."),
      deplacerEnveloppe,
      ajouterCategorie,
      definirIconeCategorie: proteger(definirIconeCategorie, "Confirmez la modification."),
      renommerCategorie: proteger(renommerCategorie, "Confirmez la modification."),
      supprimerCategorie: proteger(supprimerCategorie, "Confirmez la suppression."),
      ajouterSousCategorie,
      renommerSousCategorie: proteger(renommerSousCategorie, "Confirmez la modification."),
      supprimerSousCategorie: proteger(supprimerSousCategorie, "Confirmez la suppression."),
      deplacerSousCategorie: proteger(deplacerSousCategorie, "Confirmez le déplacement."),
      reordonnerCategories,
      reordonnerSousCategories,
      restaurerCategories,
      ajouterBudget,
      convertirBudget,
      genererEcheancesDues,
      reporterBudget,
      modifierBudget: proteger(modifierBudget, "Confirmez la modification."),
      supprimerBudget: proteger(supprimerBudget, "Confirmez la suppression."),
      ajouterDette,
      modifierDette: proteger(modifierDette, "Confirmez la modification."),
      supprimerDette: proteger(supprimerDette, "Confirmez la suppression."),
      ajouterRemboursement,
      supprimerRemboursement: proteger(supprimerRemboursement, "Confirmez la suppression."),
      restaurerTransaction,
      supprimerDefinitivement: proteger(supprimerDefinitivement, "Confirmez la suppression."),
      viderCorbeille: proteger(viderCorbeille, "Confirmez la suppression."),
      ajouterObjectif,
      modifierObjectif: proteger(modifierObjectif, "Confirmez la modification."),
      supprimerObjectif: proteger(supprimerObjectif, "Confirmez la suppression."),
      definirMembres,
      definirTransparence,
      definirNomUtilisateur,
      remplacerEtat,
      etatComplet,
      reinitialiser: proteger(reinitialiser, "Confirmez la réinitialisation."),
      systeme: {
        modifierEnveloppe,
        modifierObjectif,
        modifierBudget,
        modifierDette,
      },
    }),
    [
      ajouterTransaction,
      supprimerTransaction,
      reclasserTransaction,
      ajouterCompte,
      definirIconeCompte,
      definirCompteDisponible,
      renommerCompte,
      supprimerCompte,
      deplacerCompte,
      reinitialiserOrdreComptes,
      ajouterTransfert,
      supprimerTransfert,
      ajouterRegleTransfert,
      modifierRegleTransfert,
      supprimerRegleTransfert,
      definirCompteReserve,
      ajouterEnveloppe,
      remplirEnveloppe,
      transfererEntreEnveloppes,
      verserEnveloppeVersTontines,
      modifierEnveloppe,
      supprimerEnveloppe,
      deplacerEnveloppe,
      ajouterCategorie,
      definirIconeCategorie,
      renommerCategorie,
      supprimerCategorie,
      ajouterSousCategorie,
      renommerSousCategorie,
      supprimerSousCategorie,
      deplacerSousCategorie,
      reordonnerCategories,
      reordonnerSousCategories,
      restaurerCategories,
      ajouterBudget,
      convertirBudget,
      genererEcheancesDues,
      reporterBudget,
      modifierBudget,
      supprimerBudget,
      ajouterDette,
      modifierDette,
      supprimerDette,
      ajouterRemboursement,
      supprimerRemboursement,
      restaurerTransaction,
      supprimerDefinitivement,
      viderCorbeille,
      ajouterObjectif,
      modifierObjectif,
      supprimerObjectif,
      definirMembres,
      definirTransparence,
      definirNomUtilisateur,
      remplacerEtat,
      etatComplet,
      reinitialiser,
      proteger,
    ],
  );

  // Les totaux du mois ne doivent pas rester figés si l'application reste
  // ouverte au passage du 1er : on suit le mois courant dans un état revu
  // à chaque minute (coût négligeable, aucune dérive de date).
  const [moisEnCours, setMoisEnCours] = useState(() => new Date().toISOString().slice(0, 7));
  useEffect(() => {
    const id = window.setInterval(() => {
      const mois = new Date().toISOString().slice(0, 7);
      setMoisEnCours((actuel) => (actuel === mois ? actuel : mois));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { transactions, transferts, enveloppes, comptes, comptesExclus } = etat;

  // Chaque calcul ne dépend que des tranches d'état qui le concernent :
  // modifier un objectif ou une dette ne relance plus les totaux et soldes.
  const totaux = useMemo(() => {
    let totalRevenus = 0;
    let totalDepenses = 0;
    let totalFrais = 0;
    const depensesParEnveloppe: Record<string, number> = {};
    for (const t of transactions) {
      const duMois = t.date.slice(0, 7) === moisEnCours;
      const frais = Math.max(0, t.frais ?? 0);
      if (t.type === "revenu") {
        // Un revenu ne rapporte réellement que ce qui reste après les frais.
        if (duMois && t.origine !== "solde_initial") {
          totalRevenus += t.montant - frais;
          totalFrais += frais;
        }
        continue;
      }
      if (duMois) {
        totalDepenses += t.montant + frais;
        totalFrais += frais;
      }
      depensesParEnveloppe[t.categorie] = (depensesParEnveloppe[t.categorie] ?? 0) + t.montant;
    }
    // Les frais des transferts du mois pèsent aussi sur le budget réel.
    for (const t of transferts) {
      if (t.date.slice(0, 7) !== moisEnCours) continue;
      totalFrais += Math.max(0, t.frais ?? 0);
    }
    return { totalRevenus, totalDepenses, totalFrais, depensesParEnveloppe };
  }, [transactions, transferts, moisEnCours]);

  const soldesParCompte = useMemo(() => {
    const soldes: Record<string, number> = {};
    for (const c of comptes) soldes[c] = 0;
    for (const t of transactions) {
      const frais = Math.max(0, t.frais ?? 0);
      const effet = t.type === "revenu" ? t.montant - frais : -(t.montant + frais);
      soldes[t.compte] = (soldes[t.compte] ?? 0) + effet;
    }
    for (const t of transferts) {
      const frais = Math.max(0, t.frais ?? 0);
      const surSource = (t.fraisSur ?? "source") === "source";
      soldes[t.source] = (soldes[t.source] ?? 0) - t.montant - (surSource ? frais : 0);
      soldes[t.destination] = (soldes[t.destination] ?? 0) + t.montant - (surSource ? 0 : frais);
    }
    return soldes;
  }, [transactions, transferts, comptes]);

  // Remplir une enveloppe ne sort PAS l'argent du compte : c'est une simple
  // réservation d'une partie du solde. Seules les dépenses appauvrissent le
  // compte. On calcule donc la part réservée, à titre indicatif.
  const reservesParCompte = useMemo(() => {
    const reserves: Record<string, number> = {};
    for (const c of comptes) reserves[c] = 0;
    for (const e of enveloppes) {
      const compte = e.compteSource;
      if (!compte) continue;
      reserves[compte] = (reserves[compte] ?? 0) + Math.max(0, e.dotation ?? e.plafond);
    }
    return reserves;
  }, [enveloppes, comptes]);

  // Solde disponible : seuls les comptes marqués « dans le disponible »
  // comptent. Les comptes épargne, caisse ou diamant en sont exclus.
  const soldeDisponible = useMemo(
    () =>
      comptes
        .filter((c) => !comptesExclus.includes(c))
        .reduce((s, c) => s + (soldesParCompte[c] ?? 0), 0),
    [comptes, comptesExclus, soldesParCompte],
  );

  const valeur = useMemo<Contexte>(
    () => ({
      ...etat,
      sourcesRevenu: SOURCES_REVENU,
      ...actions,
      totalRevenus: totaux.totalRevenus,
      totalDepenses: totaux.totalDepenses,
      totalFrais: totaux.totalFrais,
      solde: totaux.totalRevenus - totaux.totalDepenses,
      soldeDisponible,
      depensesParEnveloppe: totaux.depensesParEnveloppe,
      soldesParCompte,
      reservesParCompte,
      stockageIllisible: illisible,
      enregistrementEnEchec: echecEcriture,
      chargement,
    }),
    [
      etat,
      actions,
      totaux,
      soldeDisponible,
      soldesParCompte,
      reservesParCompte,
      illisible,
      chargement,
    ],
  );

  return <SuperAppContext.Provider value={valeur}>{children}</SuperAppContext.Provider>;
}

export function useSuperApp() {
  const ctx = useContext(SuperAppContext);
  if (!ctx) throw new Error("useSuperApp doit être utilisé dans SuperAppProvider");
  return ctx;
}
