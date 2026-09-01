/**
 * Couche 1 du cerveau local : les FAITS.
 *
 * Un seul endroit lit les données de l'application et produit un unique objet
 * de faits chiffrés. Tous les écrans (accueil, conseiller, rapports, alertes)
 * doivent partir de cet objet pour que les chiffres soient identiques partout.
 *
 * 100 % local : aucun réseau, aucun modèle externe.
 */
import { dotationDe, etatEnveloppe } from "../enveloppe-etat";
import type { Dette, Enveloppe, Objectif, Transaction } from "../store";
import { resteDu } from "../store";

const JOUR_MS = 86_400_000;

export type DonneesCerveau = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  dettes?: Dette[];
  objectifs?: Objectif[];
  /** Solde global disponible, si l'appelant le connaît déjà. */
  solde?: number;
  /** Date de référence (tests). */
  maintenant?: Date;
  /**
   * Comptes dont le solde n'entre PAS dans le solde disponible.
   * Sens métier : ces fonds sont réservés (épargne, projet, usage précis) et
   * ne doivent jamais être considérés comme de l'argent du quotidien.
   */
  comptesExclus?: string[];
};

export type FaitEnveloppe = {
  id: string;
  nom: string;
  emoji: string;
  dotation: number;
  utilise: number;
  restant: number;
  pourcentage: number;
  plafondAtteint: boolean;
  epuisee: boolean;
  /** Rythme de consommation observé sur 30 jours, en FCFA/jour. */
  rythmeJour: number;
  /** Jours avant épuisement au rythme actuel, null si inconnu. */
  joursAvantEpuisement: number | null;
  /** Aucune dépense depuis 60 jours alors qu'une dotation existe. */
  dormante: boolean;
  /** Compte qui alimente l'enveloppe. */
  compteSource?: string;
  /**
   * Enveloppe alimentée par un compte hors solde disponible : son argent est
   * réservé à un projet, une épargne ou un usage précis, pas au quotidien.
   */
  reservee: boolean;
};

export type FaitMois = {
  /** YYYY-MM */
  mois: string;
  revenus: number;
  depenses: number;
  net: number;
};

export type FaitCategorie = {
  nom: string;
  montant: number;
  part: number;
  operations: number;
  /** Variation en % par rapport à la moyenne des mois précédents. */
  variation: number | null;
};

export type FaitDepenseInhabituelle = {
  id: string;
  transaction: Transaction;
  habituel: number;
  facteur: number;
};

export type Faits = {
  genereLe: string;
  /** Nombre d'opérations analysées : sert à jauger la confiance. */
  volume: number;
  solde: number;
  moisCourant: FaitMois;
  moisPrecedent: FaitMois | null;
  historique: FaitMois[];
  moyenneDepensesMensuelles: number;
  moyenneRevenusMensuels: number;
  tauxEpargne: number | null;
  projectionFinDeMois: number;
  joursEcoules: number;
  joursRestants: number;
  enveloppes: FaitEnveloppe[];
  categories: FaitCategorie[];
  inhabituelles: FaitDepenseInhabituelle[];
  detteTotale: number;
  creanceTotale: number;
  objectifsEnRetard: { libelle: string; manque: number; joursRestants: number }[];
  /** Somme dormant dans les enveloppes réservées (projet, épargne, usage précis). */
  fondsReserves: number;
  /** Somme disponible dans les enveloppes du quotidien. */
  fondsQuotidiens: number;
  /** Nombre d'enveloppes réservées. */
  nbEnveloppesReservees: number;
  /** Confiance globale des analyses (0-1), basée sur le volume de données. */
  confiance: number;
};

// ------------------------------------------------------------------ outils

function moisDe(date: string): string {
  return date.slice(0, 7);
}

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(tri.length / 2);
  return tri.length % 2 === 0 ? ((tri[m - 1] ?? 0) + (tri[m] ?? 0)) / 2 : (tri[m] ?? 0);
}

function totauxMois(transactions: Transaction[], mois: string): FaitMois {
  let revenus = 0;
  let depenses = 0;
  for (const t of transactions) {
    if (moisDe(t.date) !== mois) continue;
    if (t.type === "revenu") revenus += t.montant;
    else depenses += t.montant;
  }
  return { mois, revenus, depenses, net: revenus - depenses };
}

function moisPrecedentDe(mois: string): string {
  const [a, m] = mois.split("-").map(Number);
  const d = new Date((a ?? 1970), (m ?? 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ calcul

/** Calcule l'ensemble des faits à partir des données brutes de l'application. */
export function calculerFaits(donnees: DonneesCerveau): Faits {
  const maintenant = donnees.maintenant ?? new Date();
  const transactions = donnees.transactions ?? [];
  const enveloppes = donnees.enveloppes ?? [];
  const moisCourantId = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;

  const moisCourant = totauxMois(transactions, moisCourantId);
  const idPrecedent = moisPrecedentDe(moisCourantId);
  const brutPrecedent = totauxMois(transactions, idPrecedent);
  const moisPrecedent =
    brutPrecedent.revenus === 0 && brutPrecedent.depenses === 0 ? null : brutPrecedent;

  // Historique des 12 derniers mois, du plus ancien au plus récent.
  const historique: FaitMois[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const t = totauxMois(transactions, id);
    if (t.revenus > 0 || t.depenses > 0 || i === 0) historique.push(t);
  }

  const moisAvecActivite = historique.filter((m) => m.revenus > 0 || m.depenses > 0);
  const moyenneDepensesMensuelles =
    moisAvecActivite.length > 0
      ? moisAvecActivite.reduce((s, m) => s + m.depenses, 0) / moisAvecActivite.length
      : 0;
  const moyenneRevenusMensuels =
    moisAvecActivite.length > 0
      ? moisAvecActivite.reduce((s, m) => s + m.revenus, 0) / moisAvecActivite.length
      : 0;

  const joursEcoules = maintenant.getDate();
  const joursDansMois = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth() + 1,
    0,
  ).getDate();
  const joursRestants = Math.max(0, joursDansMois - joursEcoules);
  const projectionFinDeMois =
    joursEcoules > 0 ? Math.round((moisCourant.depenses / joursEcoules) * joursDansMois) : 0;

  const tauxEpargne =
    moisCourant.revenus > 0
      ? Math.round(((moisCourant.revenus - moisCourant.depenses) / moisCourant.revenus) * 100)
      : null;

  // ---- enveloppes
  const limite30 = new Date(maintenant.getTime() - 29 * JOUR_MS).toISOString().slice(0, 10);
  const limite60 = new Date(maintenant.getTime() - 59 * JOUR_MS).toISOString().slice(0, 10);
  const depensesParEnveloppe = new Map<string, number>();
  const derniereDepense = new Map<string, string>();
  const recentesParEnveloppe = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    depensesParEnveloppe.set(t.categorie, (depensesParEnveloppe.get(t.categorie) ?? 0) + t.montant);
    const jour = t.date.slice(0, 10);
    if (jour > (derniereDepense.get(t.categorie) ?? "")) derniereDepense.set(t.categorie, jour);
    if (jour >= limite30) {
      recentesParEnveloppe.set(
        t.categorie,
        (recentesParEnveloppe.get(t.categorie) ?? 0) + t.montant,
      );
    }
  }

  const comptesReserves = new Set((donnees.comptesExclus ?? []).map((c) => c.trim().toLowerCase()));
  const estReservee = (e: Enveloppe) =>
    !!e.compteSource && comptesReserves.has(e.compteSource.trim().toLowerCase());

  const faitsEnveloppes: FaitEnveloppe[] = enveloppes.map((e) => {
    const etat = etatEnveloppe(e, depensesParEnveloppe.get(e.id) ?? 0);
    const rythmeJour = Math.round((recentesParEnveloppe.get(e.id) ?? 0) / 30);
    const derniere = derniereDepense.get(e.id);
    return {
      id: e.id,
      nom: e.nom,
      emoji: e.emoji,
      dotation: dotationDe(e),
      utilise: etat.utilise,
      restant: etat.restant,
      pourcentage: Math.round(etat.pourcentage),
      plafondAtteint: etat.plafondAtteint,
      epuisee: etat.epuisee,
      rythmeJour,
      joursAvantEpuisement: rythmeJour > 0 ? Math.floor(etat.restant / rythmeJour) : null,
      // Une enveloppe réservée n'est jamais « dormante » : ne rien y dépenser
      // est exactement son rôle (projet, épargne, usage précis).
      dormante:
        !estReservee(e) && dotationDe(e) > 0 && (!derniere || derniere < limite60),
      compteSource: e.compteSource,
      reservee: estReservee(e),
    };
  });

  // ---- catégories du mois courant
  const nomEnveloppe = new Map(enveloppes.map((e) => [e.id, `${e.emoji} ${e.nom}`]));
  const parCategorie = new Map<string, { montant: number; operations: number }>();
  for (const t of transactions) {
    if (t.type !== "depense" || moisDe(t.date) !== moisCourantId) continue;
    const cle = nomEnveloppe.get(t.categorie) ?? t.categorie ?? "Sans catégorie";
    const acc = parCategorie.get(cle) ?? { montant: 0, operations: 0 };
    acc.montant += t.montant;
    acc.operations += 1;
    parCategorie.set(cle, acc);
  }
  const totalCategories = [...parCategorie.values()].reduce((s, c) => s + c.montant, 0);

  // moyenne historique par catégorie pour mesurer la dérive
  const historiqueCategorie = new Map<string, number[]>();
  for (const m of moisAvecActivite) {
    if (m.mois === moisCourantId) continue;
    const cumul = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "depense" || moisDe(t.date) !== m.mois) continue;
      const cle = nomEnveloppe.get(t.categorie) ?? t.categorie ?? "Sans catégorie";
      cumul.set(cle, (cumul.get(cle) ?? 0) + t.montant);
    }
    for (const [cle, valeur] of cumul) {
      historiqueCategorie.set(cle, [...(historiqueCategorie.get(cle) ?? []), valeur]);
    }
  }

  const categories: FaitCategorie[] = [...parCategorie.entries()]
    .map(([nom, c]) => {
      const passe = historiqueCategorie.get(nom) ?? [];
      const reference = passe.length > 0 ? passe.reduce((s, v) => s + v, 0) / passe.length : 0;
      return {
        nom,
        montant: Math.round(c.montant),
        part: totalCategories > 0 ? Math.round((c.montant / totalCategories) * 100) : 0,
        operations: c.operations,
        variation: reference > 0 ? Math.round(((c.montant - reference) / reference) * 100) : null,
      };
    })
    .sort((a, b) => b.montant - a.montant);

  // ---- dépenses inhabituelles (médiane robuste, 30 derniers jours)
  const groupes = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== "depense" || t.montant <= 0) continue;
    groupes.set(t.categorie, [...(groupes.get(t.categorie) ?? []), t]);
  }
  const inhabituelles: FaitDepenseInhabituelle[] = [];
  for (const [, liste] of groupes) {
    if (liste.length < 5) continue;
    const base = mediane(liste.map((t) => t.montant));
    if (base <= 0) continue;
    for (const t of liste) {
      if (t.date.slice(0, 10) < limite30) continue;
      const facteur = t.montant / base;
      if (facteur >= 2.5) {
        inhabituelles.push({
          id: t.id,
          transaction: t,
          habituel: Math.round(base),
          facteur: Math.round(facteur * 10) / 10,
        });
      }
    }
  }
  inhabituelles.sort((a, b) => b.facteur - a.facteur);

  // ---- dettes et objectifs
  const dettes = donnees.dettes ?? [];
  const detteTotale = dettes
    .filter((d) => d.sens === "dette")
    .reduce((s, d) => s + resteDu(d), 0);
  const creanceTotale = dettes
    .filter((d) => d.sens === "creance")
    .reduce((s, d) => s + resteDu(d), 0);

  const objectifsEnRetard = (donnees.objectifs ?? [])
    .map((o) => {
      const restant = Math.max(0, o.cible - o.deja);
      const jours = Math.ceil((new Date(o.dateCible).getTime() - maintenant.getTime()) / JOUR_MS);
      return { libelle: o.libelle, manque: restant, joursRestants: jours };
    })
    .filter((o) => o.manque > 0 && o.joursRestants <= 60);

  const solde =
    typeof donnees.solde === "number"
      ? donnees.solde
      : transactions.reduce((s, t) => s + (t.type === "revenu" ? t.montant : -t.montant), 0);

  const volume = transactions.length;
  const confiance = Math.max(0.2, Math.min(1, volume / 60));

  return {
    genereLe: maintenant.toISOString(),
    volume,
    solde,
    moisCourant,
    moisPrecedent,
    historique,
    moyenneDepensesMensuelles: Math.round(moyenneDepensesMensuelles),
    moyenneRevenusMensuels: Math.round(moyenneRevenusMensuels),
    tauxEpargne,
    projectionFinDeMois,
    joursEcoules,
    joursRestants,
    enveloppes: faitsEnveloppes,
    categories,
    inhabituelles,
    detteTotale,
    creanceTotale,
    objectifsEnRetard,
    fondsReserves: faitsEnveloppes
      .filter((e) => e.reservee)
      .reduce((t, e) => t + Math.max(0, e.restant), 0),
    fondsQuotidiens: faitsEnveloppes
      .filter((e) => !e.reservee)
      .reduce((t, e) => t + Math.max(0, e.restant), 0),
    nbEnveloppesReservees: faitsEnveloppes.filter((e) => e.reservee).length,
    confiance: Math.round(confiance * 100) / 100,
  };
}
