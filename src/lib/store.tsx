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
import { montantSurRevenu } from "./remplissage";
import { ecrireSecurise, estChiffre, lireSecuriseDetail } from "./coffre-local";
import { journaliser } from "./journal";
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
};

/** Opération supprimée, conservée 30 jours dans la corbeille. */
export type ElementCorbeille = Transaction & { supprimeLe: string };

/** Objectif d'épargne suivi par l'application. */
export type Objectif = {
  id: string;
  libelle: string;
  /** Montant visé, en FCFA. */
  cible: number;
  /** Date visée (YYYY-MM-DD). */
  dateCible: string;
  /** Montant déjà mis de côté avant le suivi. */
  deja: number;
  /** Enveloppe d'épargne associée, si l'utilisateur en choisit une. */
  enveloppeId?: string | undefined;
  creeLe: string;
};

export type Transfert = {
  id: string;
  source: string;
  destination: string;
  montant: number;
  note: string;
  date: string;
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
  actif: boolean;
};

export type Remboursement = {
  id: string;
  montant: number;
  date: string;
  note?: string | undefined;
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
  creeLe: string;
  remboursements: Remboursement[];
};

/** Montant restant dû sur une dette ou créance. */
export function resteDu(d: Dette): number {
  const rembourse = d.remboursements.reduce((s, r) => s + r.montant, 0);
  return Math.max(0, d.montantInitial - rembourse);
}

export const COMPTES = [
  "Espèces",
  "Banque",
  "MTN MoMo",
  "Moov Money",
  "Wave",
  "Carte virtuelle",
] as const;

/**
 * Comptes de mise de côté (épargne, caisse, compte diamant) : par défaut leur
 * argent n'entre pas dans le solde disponible. L'utilisateur peut changer ce
 * choix à la création ou à la modification du compte.
 */
export function estCompteNonDisponible(nom: string): boolean {
  return /(épargne|epargne|caisse|diamant|tontine)/i.test(nom);
}

export const ENVELOPPES_PAR_DEFAUT: Enveloppe[] = [
  {
    id: "vitaux",
    nom: "Besoins vitaux",
    emoji: "🍚",
    plafond: 150000,
    dotation: 180000,
    categorie: "Alimentation",
    sousCategorie: "Marché",
  },
  {
    id: "transport",
    nom: "Transport",
    emoji: "🛵",
    plafond: 40000,
    dotation: 50000,
    categorie: "Transport",
    sousCategorie: "Carburant",
  },
  {
    id: "maison",
    nom: "Maison & Factures",
    emoji: "🏠",
    plafond: 60000,
    dotation: 70000,
    categorie: "Factures",
    sousCategorie: "Facture SBEE",
  },
  {
    id: "epargne",
    nom: "Épargne",
    emoji: "🐖",
    plafond: 50000,
    dotation: 55000,
    categorie: "Épargne",
    sousCategorie: "Tontine",
  },
  {
    id: "envies",
    nom: "Projets & Envies",
    emoji: "✨",
    plafond: 30000,
    dotation: 35000,
    categorie: "Famille",
    sousCategorie: "Cadeaux",
  },
  {
    id: "imprevus",
    nom: "Imprévus",
    emoji: "🚨",
    plafond: 20000,
    dotation: 25000,
    categorie: "Santé",
    sousCategorie: "Pharmacie",
  },
];

export const CATEGORIES_PAR_DEFAUT: CategorieEnveloppe[] = [
  {
    id: "cat-transport",
    nom: "Transport",
    sousCategories: ["Carburant", "Vidange voiture", "Taxi / Zémidjan"],
  },
  {
    id: "cat-factures",
    nom: "Factures",
    sousCategories: ["Facture SBEE", "Facture SONEB", "Internet"],
  },
  { id: "cat-alimentation", nom: "Alimentation", sousCategories: ["Marché", "Boutique"] },
  { id: "cat-sante", nom: "Santé", sousCategories: ["Pharmacie", "Consultation"] },
  { id: "cat-epargne", nom: "Épargne", sousCategories: ["Tontine", "Épargne banque"] },
  { id: "cat-famille", nom: "Famille", sousCategories: ["Cadeaux", "Cérémonies"] },
];

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
  transferts: Transfert[];
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
 * Ramène un état de provenance inconnue (stockage, sauvegarde importée,
 * dépôt de synchronisation) à un état sain : tout élément invalide est écarté
 * plutôt que d'empoisonner les soldes.
 */
export function assainirEtat(brut: Partial<Etat>): Etat {
  const enveloppes = assainirListe(brut.enveloppes, assainirEnveloppe);
  const comptes = assainirComptes(brut.comptes);
  const limite = Date.now() - JOURS_CORBEILLE * 86400000;
  return {
    transactions: assainirListe(brut.transactions, assainirTransaction),
    enveloppes: enveloppes.length > 0 ? enveloppes : ENVELOPPES_PAR_DEFAUT,
    categories: assainirListe(brut.categories, assainirCategorie),
    comptes: comptes.length > 0 ? comptes : [...COMPTES],
    comptesExclus: brut.comptesExclus
      ? assainirComptes(brut.comptesExclus)
      : (comptes.length > 0 ? comptes : [...COMPTES]).filter((c) => estCompteNonDisponible(c)),

    transferts: assainirListe(brut.transferts, assainirTransfert),
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
  comptes: [...COMPTES],
  comptesExclus: [],
  transferts: [],
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
  ajouterCompte: (nom: string, dansDisponible?: boolean) => void;
  /** Indique si un compte entre ou non dans le solde disponible. */
  definirCompteDisponible: (nom: string, dansDisponible: boolean) => void;
  renommerCompte: (ancien: string, nouveau: string) => void;
  supprimerCompte: (nom: string) => void;
  ajouterTransfert: (t: Omit<Transfert, "id">) => void;
  supprimerTransfert: (id: string) => void;
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
  /** Déplace une dotation d'une enveloppe vers une autre (plan de secours). */
  transfererEntreEnveloppes: (sourceId: string, cibleId: string, montant: number) => void;
  modifierEnveloppe: (id: string, e: Partial<Omit<Enveloppe, "id">>) => void;
  supprimerEnveloppe: (id: string) => void;
  deplacerEnveloppe: (id: string, sens: "haut" | "bas") => void;
  ajouterCategorie: (nom: string) => void;
  renommerCategorie: (id: string, nom: string) => void;
  supprimerCategorie: (id: string) => void;
  ajouterSousCategorie: (id: string, nom: string) => void;
  renommerSousCategorie: (id: string, ancien: string, nom: string) => void;
  supprimerSousCategorie: (id: string, nom: string) => void;
  reordonnerCategories: (depuis: number, vers: number) => void;
  reordonnerSousCategories: (id: string, depuis: number, vers: number) => void;
  restaurerCategories: (liste: CategorieEnveloppe[]) => void;
  ajouterBudget: (b: Omit<Budget, "id">) => void;
  convertirBudget: (id: string, fois?: number) => void;
  genererEcheancesDues: () => void;
  modifierBudget: (id: string, b: Partial<Omit<Budget, "id">>) => void;
  supprimerBudget: (id: string) => void;
  ajouterDette: (d: Omit<Dette, "id" | "creeLe" | "remboursements">, compte?: string) => void;
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
  remplacerEtat: (e: Partial<Etat>) => void;
  etatComplet: () => Etat;
  reinitialiser: () => void;
  totalRevenus: number;
  totalDepenses: number;
  solde: number;
  /** Solde des seuls comptes comptés dans le disponible. */
  soldeDisponible: number;
  depensesParEnveloppe: Record<string, number>;
  soldesParCompte: Record<string, number>;
  /** Part du solde de chaque compte déjà réservée aux enveloppes. */
  reservesParCompte: Record<string, number>;
  /** true quand des données existent mais n'ont pas pu être déchiffrées. */
  stockageIllisible: boolean;
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
  return {
    ...charge,
    transactions: [...ajouts(actuel.transactions, charge.transactions), ...charge.transactions],
    transferts: [...ajouts(actuel.transferts, charge.transferts), ...charge.transferts],
    remplissages: [...ajouts(actuel.remplissages, charge.remplissages), ...charge.remplissages],
    budgets: [...charge.budgets, ...ajouts(actuel.budgets, charge.budgets)],
    dettes: [...charge.dettes, ...ajouts(actuel.dettes, charge.dettes)],
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
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
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
    if (pret.current && !illisible) void ecrireSecurise(CLE, JSON.stringify(etat));
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
        journaliser("avertissement", "application", "Remplissage refusé : montant ou compte invalide.");
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
      if (nouveaux.length === 0) return suivant;
      return { ...suivant, enveloppes, remplissages: [...nouveaux, ...suivant.remplissages] };
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

  const ajouterCompte = useCallback((nom: string, dansDisponible = true) => {
    const propre = texteSur(nom, 60);
    if (!propre) return;
    setEtat((e) => {
      if (e.comptes.includes(propre)) return e;
      const exclus = dansDisponible
        ? e.comptesExclus.filter((c) => c !== propre)
        : [...e.comptesExclus, propre];
      return { ...e, comptes: [...e.comptes, propre], comptesExclus: exclus };
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
    setEtat((e) => ({
      ...e,
      comptes: e.comptes.map((c) => (c === ancien ? nouveau : c)),
      comptesExclus: e.comptesExclus.map((c) => (c === ancien ? nouveau : c)),
      transactions: e.transactions.map((t) =>
        t.compte === ancien ? { ...t, compte: nouveau } : t,
      ),
      transferts: e.transferts.map((t) => ({
        ...t,
        source: t.source === ancien ? nouveau : t.source,
        destination: t.destination === ancien ? nouveau : t.destination,
      })),
    }));
  }, []);

  const supprimerCompte = useCallback((nom: string) => {
    setEtat((e) => {
      // Garde-fou métier : un compte encore référencé ne peut pas disparaître,
      // sinon ses opérations deviendraient orphelines et fausseraient les soldes.
      const utilise =
        e.transactions.some((t) => t.compte === nom) ||
        e.transferts.some((t) => t.source === nom || t.destination === nom) ||
        e.budgets.some((b) => b.compte === nom);
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
      };
    });
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

  const ajouterEnveloppe = useCallback((env: Omit<Enveloppe, "id">): string | null => {
    const propre = assainirEnveloppe({ ...env, id: crypto.randomUUID() });
    if (!propre) {
      journaliser("avertissement", "application", "Enveloppe refusée : nom ou montant invalide.");
      return null;
    }
    setEtat((e) => ({ ...e, enveloppes: [...e.enveloppes, propre] }));
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

  const ajouterCategorie = useCallback((nom: string) => {
    setEtat((e) =>
      e.categories.some((c) => c.nom === nom)
        ? e
        : {
            ...e,
            categories: [...e.categories, { id: crypto.randomUUID(), nom, sousCategories: [] }],
          },
    );
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
          ? { ...c, sousCategories: [...c.sousCategories, nom] }
          : c,
      ),
    }));
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
      const budgets = e.budgets.map((b) => {
        if (!b.actif) return b;
        let date = b.prochaine;
        let garde = 0;
        while (new Date(date).getTime() <= maintenant && garde < 240) {
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
    (d: Omit<Dette, "id" | "creeLe" | "remboursements">, compte?: string) => {
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
        const etatSuivant: Etat = { ...e, dettes: [fiche, ...e.dettes] };
        if (!compte) return etatSuivant;
        // Une dette contractée fait entrer de l'argent ; une créance accordée en fait sortir.
        const mouvement: Transaction = {
          id: crypto.randomUUID(),
          type: d.sens === "dette" ? "revenu" : "depense",
          montant: d.montantInitial,
          libelle:
            d.sens === "dette" ? `Emprunt auprès de ${d.personne}` : `Prêt accordé à ${d.personne}`,
          categorie: "dettes",
          compte,
          date: new Date(creeLe).toISOString(),
          detteId: id,
        };
        return { ...etatSuivant, transactions: [mouvement, ...e.transactions] };
      });
    },
    [],
  );

  const modifierDette = useCallback(
    (id: string, d: Partial<Omit<Dette, "id" | "remboursements">>) => {
      if (d.montantInitial !== undefined && !montantValide(d.montantInitial)) return;
      setEtat((e) => ({
        ...e,
        dettes: e.dettes.map((x) => (x.id === id ? { ...x, ...d } : x)),
      }));
    },
    [],
  );

  const supprimerDette = useCallback((id: string) => {
    setEtat((e) => ({
      ...e,
      dettes: e.dettes.filter((x) => x.id !== id),
      // Les mouvements de trésorerie liés à la fiche disparaissent avec elle.
      transactions: e.transactions.filter((t) => t.detteId !== id),
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
        const dettes = e.dettes.map((x) =>
          x.id === detteId
            ? {
                ...x,
                remboursements: [...x.remboursements, { ...r, id: crypto.randomUUID() }].sort(
                  (a, b) => a.date.localeCompare(b.date),
                ),
              }
            : x,
        );
        if (!compte) return { ...e, dettes };
        // Rembourser une dette sort de l'argent ; encaisser une créance en fait entrer.
        const mouvement: Transaction = {
          id: crypto.randomUUID(),
          type: cible.sens === "dette" ? "depense" : "revenu",
          montant: r.montant,
          libelle:
            cible.sens === "dette"
              ? `Remboursement à ${cible.personne}`
              : `Encaissement de ${cible.personne}`,
          categorie: "dettes",
          compte,
          date: new Date(r.date).toISOString(),
          detteId,
        };
        return { ...e, dettes, transactions: [mouvement, ...e.transactions] };
      });
    },
    [],
  );

  const supprimerRemboursement = useCallback((detteId: string, remboursementId: string) => {
    setEtat((e) => ({
      ...e,
      dettes: e.dettes.map((x) =>
        x.id === detteId
          ? { ...x, remboursements: x.remboursements.filter((r) => r.id !== remboursementId) }
          : x,
      ),
    }));
  }, []);

  const definirTransparence = useCallback((v: number) => {
    const propre = Math.min(100, Math.max(0, nombreSur(v, 85)));
    setEtat((e) => ({ ...e, transparence: propre }));
  }, []);

  const definirNomUtilisateur = useCallback((nom: string) => {
    setEtat((e) => ({ ...e, nomUtilisateur: texteSur(nom, 60) }));
  }, []);

  const remplacerEtat = useCallback((nouveau: Partial<Etat>) => {
    // Tout ce qui vient de l'extérieur (sauvegarde, synchronisation) est
    // systématiquement assaini avant d'entrer dans l'application.
    setEtat((e) => assainirEtat({ ...ETAT_INITIAL, ...e, ...nouveau }));
  }, []);

  const etatRef = useRef<Etat>(etat);
  etatRef.current = etat;
  const etatComplet = useCallback(() => etatRef.current, []);

  const reinitialiser = useCallback(() => setEtat(ETAT_INITIAL), []);

  const actions = useMemo(
    () => ({
      ajouterTransaction,
      supprimerTransaction,
      ajouterCompte,
      definirCompteDisponible,
      renommerCompte,
      supprimerCompte,
      ajouterTransfert,
      supprimerTransfert,
      ajouterEnveloppe,
      remplirEnveloppe,
      transfererEntreEnveloppes,
      modifierEnveloppe,
      supprimerEnveloppe,
      deplacerEnveloppe,
      ajouterCategorie,
      renommerCategorie,
      supprimerCategorie,
      ajouterSousCategorie,
      renommerSousCategorie,
      supprimerSousCategorie,
      reordonnerCategories,
      reordonnerSousCategories,
      restaurerCategories,
      ajouterBudget,
      convertirBudget,
      genererEcheancesDues,
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
    }),
    [
      ajouterTransaction,
      supprimerTransaction,
      ajouterCompte,
      definirCompteDisponible,
      renommerCompte,
      supprimerCompte,
      ajouterTransfert,
      supprimerTransfert,
      ajouterEnveloppe,
      remplirEnveloppe,
      transfererEntreEnveloppes,
      modifierEnveloppe,
      supprimerEnveloppe,
      deplacerEnveloppe,
      ajouterCategorie,
      renommerCategorie,
      supprimerCategorie,
      ajouterSousCategorie,
      renommerSousCategorie,
      supprimerSousCategorie,
      reordonnerCategories,
      reordonnerSousCategories,
      restaurerCategories,
      ajouterBudget,
      convertirBudget,
      genererEcheancesDues,
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
    ],
  );

  const valeur = useMemo<Contexte>(() => {
    const moisEnCours = new Date().toISOString().slice(0, 7);
    const totalRevenus = etat.transactions
      .filter((t) => t.type === "revenu" && t.date.slice(0, 7) === moisEnCours)
      .reduce((s, t) => s + t.montant, 0);
    const totalDepenses = etat.transactions
      .filter((t) => t.type === "depense" && t.date.slice(0, 7) === moisEnCours)
      .reduce((s, t) => s + t.montant, 0);
    const depensesParEnveloppe: Record<string, number> = {};
    for (const t of etat.transactions) {
      if (t.type !== "depense") continue;
      depensesParEnveloppe[t.categorie] = (depensesParEnveloppe[t.categorie] ?? 0) + t.montant;
    }
    const soldesParCompte: Record<string, number> = {};
    for (const c of etat.comptes) soldesParCompte[c] = 0;
    for (const t of etat.transactions) {
      soldesParCompte[t.compte] =
        (soldesParCompte[t.compte] ?? 0) + (t.type === "revenu" ? t.montant : -t.montant);
    }
    for (const t of etat.transferts) {
      soldesParCompte[t.source] = (soldesParCompte[t.source] ?? 0) - t.montant;
      soldesParCompte[t.destination] = (soldesParCompte[t.destination] ?? 0) + t.montant;
    }
    // Remplir une enveloppe ne sort PAS l'argent du compte : c'est une simple
    // réservation d'une partie du solde. Seules les dépenses appauvrissent le
    // compte. On calcule donc la part réservée, à titre indicatif.
    const reservesParCompte: Record<string, number> = {};
    for (const c of etat.comptes) reservesParCompte[c] = 0;
    for (const e of etat.enveloppes) {
      const compte = e.compteSource;
      if (!compte) continue;
      const reste = Math.max(0, e.dotation ?? e.plafond);
      reservesParCompte[compte] = (reservesParCompte[compte] ?? 0) + reste;
    }
    // Solde disponible : seuls les comptes marqués « dans le disponible »
    // comptent. Les comptes épargne, caisse ou diamant en sont exclus, ainsi
    // que les enveloppes qui tirent leur source de ces comptes.
    const soldeDisponible = etat.comptes
      .filter((c) => !etat.comptesExclus.includes(c))
      .reduce((s, c) => s + (soldesParCompte[c] ?? 0), 0);

    return {
      ...etat,
      sourcesRevenu: SOURCES_REVENU,
      ...actions,
      totalRevenus,
      totalDepenses,
      solde: totalRevenus - totalDepenses,
      soldeDisponible,
      depensesParEnveloppe,
      soldesParCompte,
      reservesParCompte,
      stockageIllisible: illisible,
      chargement,
    };
  }, [etat, actions, illisible, chargement]);

  return <SuperAppContext.Provider value={valeur}>{children}</SuperAppContext.Provider>;
}

export function useSuperApp() {
  const ctx = useContext(SuperAppContext);
  if (!ctx) throw new Error("useSuperApp doit être utilisé dans SuperAppProvider");
  return ctx;
}
