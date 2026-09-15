/**
 * Classement du coffre-fort e-mail.
 *
 * À chaque nouvelle saisie (un nom donné à une dépense, un compte, une dette,
 * un objectif…), la copie chiffrée part avec un classement précis : année,
 * mois, rubrique et nom de l'élément saisi. La boîte e-mail devient ainsi un
 * espace de stockage rangé méthodiquement, où chaque copie se retrouve d'un
 * coup d'œil (et se filtre automatiquement hors de la boîte de réception).
 */

export type Rubrique =
  | "depenses"
  | "revenus"
  | "transferts"
  | "comptes"
  | "enveloppes"
  | "dettes"
  | "creances"
  | "objectifs"
  | "budgets"
  | "membres"
  | "general";

export type Classement = {
  rubrique: Rubrique;
  /** Libellé lisible de la rubrique. */
  libelle: string;
  /** Dossier daté, ex. « 2026-09 ». */
  dossier: string;
  /** Nom donné par l'utilisateur à l'élément saisi (vide si inconnu). */
  nom: string;
  /** Chemin complet de classement, utilisé dans l'objet du message. */
  chemin: string;
  /** true : une nouvelle fiche nommée vient d'être créée. */
  nouveau: boolean;
};

const CLE_COMPTEURS = "superapp:coffre-mail:classement:v1";

const LIBELLES: Record<Rubrique, string> = {
  depenses: "DÉPENSES",
  revenus: "REVENUS",
  transferts: "TRANSFERTS",
  comptes: "COMPTES",
  enveloppes: "ENVELOPPES",
  dettes: "DETTES",
  creances: "CRÉANCES",
  objectifs: "OBJECTIFS",
  budgets: "BUDGETS",
  membres: "FOYER",
  general: "GÉNÉRAL",
};

type Compteurs = Partial<Record<Rubrique, number>>;

type EtatMinimal = {
  transactions?: { type?: string; libelle?: string }[];
  transferts?: { note?: string; source?: string; destination?: string }[];
  comptes?: string[];
  enveloppes?: { nom?: string }[];
  dettes?: { sens?: string; personne?: string }[];
  objectifs?: { libelle?: string }[];
  budgets?: { libelle?: string; nom?: string }[];
  membres?: { nom?: string }[] | string[];
};

function nomMembre(m: unknown): string {
  if (typeof m === "string") return m;
  const o = m as { nom?: string } | null;
  return o?.nom ?? "";
}

/** Derniers éléments et effectifs de chaque rubrique. */
function inventaire(etat: EtatMinimal): { compteurs: Compteurs; noms: Partial<Record<Rubrique, string>> } {
  const tx = etat.transactions ?? [];
  const depenses = tx.filter((t) => t.type === "depense");
  const revenus = tx.filter((t) => t.type === "revenu");
  const dettes = (etat.dettes ?? []).filter((d) => d.sens !== "creance");
  const creances = (etat.dettes ?? []).filter((d) => d.sens === "creance");
  const transferts = etat.transferts ?? [];
  const membres = (etat.membres ?? []) as unknown[];

  const dernier = <T>(liste: T[]): T | undefined => liste[liste.length - 1];

  return {
    compteurs: {
      depenses: depenses.length,
      revenus: revenus.length,
      transferts: transferts.length,
      comptes: (etat.comptes ?? []).length,
      enveloppes: (etat.enveloppes ?? []).length,
      dettes: dettes.length,
      creances: creances.length,
      objectifs: (etat.objectifs ?? []).length,
      budgets: (etat.budgets ?? []).length,
      membres: membres.length,
    },
    noms: {
      depenses: dernier(depenses)?.libelle ?? "",
      revenus: dernier(revenus)?.libelle ?? "",
      transferts: (() => {
        const t = dernier(transferts);
        return t ? (t.note || `${t.source ?? ""} → ${t.destination ?? ""}`) : "";
      })(),
      comptes: dernier(etat.comptes ?? []) ?? "",
      enveloppes: dernier(etat.enveloppes ?? [])?.nom ?? "",
      dettes: dernier(dettes)?.personne ?? "",
      creances: dernier(creances)?.personne ?? "",
      objectifs: dernier(etat.objectifs ?? [])?.libelle ?? "",
      budgets: (() => {
        const b = dernier(etat.budgets ?? []);
        return b?.libelle ?? b?.nom ?? "";
      })(),
      membres: nomMembre(dernier(membres)),
    },
  };
}

function lireCompteurs(): Compteurs {
  try {
    const brut = window.localStorage.getItem(CLE_COMPTEURS);
    return brut ? (JSON.parse(brut) as Compteurs) : {};
  } catch {
    return {};
  }
}

function ecrireCompteurs(c: Compteurs) {
  try {
    window.localStorage.setItem(CLE_COMPTEURS, JSON.stringify(c));
  } catch {
    /* stockage indisponible */
  }
}

function nettoyer(nom: string): string {
  return nom.replace(/[\r\n|]+/g, " ").trim().slice(0, 48);
}

function dossierDuJour(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Classe la dernière saisie. `memoriser` enregistre les effectifs observés :
 * l'appel suivant ne considérera donc plus la même fiche comme nouvelle.
 */
export function classerSaisie(etat: EtatMinimal, memoriser = true): Classement {
  const { compteurs, noms } = inventaire(etat);
  const avant = lireCompteurs();
  let rubrique: Rubrique = "general";
  let nouveau = false;
  let meilleurGain = 0;

  for (const cle of Object.keys(compteurs) as Rubrique[]) {
    const gain = (compteurs[cle] ?? 0) - (avant[cle] ?? 0);
    if (gain > meilleurGain) {
      meilleurGain = gain;
      rubrique = cle;
      nouveau = true;
    }
  }

  if (memoriser) ecrireCompteurs(compteurs);

  const dossier = dossierDuJour();
  const nom = nettoyer(nouveau ? (noms[rubrique] ?? "") : "");
  const libelle = LIBELLES[rubrique];
  const chemin = ["SUPER APP", dossier, libelle, nom ? `« ${nom} »` : ""]
    .filter(Boolean)
    .join(" / ");

  return { rubrique, libelle, dossier, nom, chemin, nouveau };
}

/** Étiquette technique du message, pour un filtre automatique dans la boîte. */
export function etiquetteCoffre(c: Classement): string {
  return `coffre-${c.rubrique}`;
}
