import type { Budget, Dette, Enveloppe, Transaction } from "./store";
import { resteDu } from "./store";
import { etatEnveloppe } from "./enveloppe-etat";
import { calculerFaits } from "./cerveau/faits";

/** Fenêtres d'analyse proposées à l'utilisateur. */
export type Fenetre = "mois" | "trimestre" | "annee" | "tout";

export const FENETRES: { id: Fenetre; label: string; jours: number }[] = [
  { id: "mois", label: "Ce mois", jours: 30 },
  { id: "trimestre", label: "3 mois", jours: 90 },
  { id: "annee", label: "12 mois", jours: 365 },
  { id: "tout", label: "Tout", jours: 100000 },
];

const JOUR = 86400000;

function jour(iso: string): string {
  return iso.slice(0, 10);
}

/** Transactions comprises dans la fenêtre choisie (fin incluse). */
export function filtrerFenetre(transactions: Transaction[], fenetre: Fenetre): Transaction[] {
  if (fenetre === "tout") return transactions;
  const jours = FENETRES.find((f) => f.id === fenetre)?.jours ?? 30;
  const limite = jour(new Date(Date.now() - (jours - 1) * JOUR).toISOString());
  return transactions.filter((t) => jour(t.date) >= limite);
}

/** Transactions de la fenêtre précédente, de même durée, pour comparer. */
export function filtrerFenetrePrecedente(
  transactions: Transaction[],
  fenetre: Fenetre,
): Transaction[] {
  if (fenetre === "tout") return [];
  const jours = FENETRES.find((f) => f.id === fenetre)?.jours ?? 30;
  const debut = jour(new Date(Date.now() - (2 * jours - 1) * JOUR).toISOString());
  const fin = jour(new Date(Date.now() - jours * JOUR).toISOString());
  return transactions.filter((t) => jour(t.date) >= debut && jour(t.date) <= fin);
}

export type Totaux = { revenus: number; depenses: number; net: number };

export function totaliser(transactions: Transaction[]): Totaux {
  const revenus = transactions
    .filter((t) => t.type === "revenu")
    .reduce((s, t) => s + t.montant, 0);
  const depenses = transactions
    .filter((t) => t.type === "depense")
    .reduce((s, t) => s + t.montant, 0);
  return { revenus, depenses, net: revenus - depenses };
}

/** Variation en pourcentage entre deux montants ; null si aucune base de comparaison. */
export function variation(actuel: number, precedent: number): number | null {
  if (precedent <= 0) return null;
  return Math.round(((actuel - precedent) / precedent) * 100);
}

export type PartCategorie = {
  nom: string;
  montant: number;
  part: number;
  enveloppes: { nom: string; emoji: string; montant: number }[];
};

/** Répartition des dépenses par catégorie d'enveloppe, puis par enveloppe. */
export function repartitionParCategorie(
  transactions: Transaction[],
  enveloppes: Enveloppe[],
): PartCategorie[] {
  const parEnveloppe = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    parEnveloppe.set(t.categorie, (parEnveloppe.get(t.categorie) ?? 0) + t.montant);
  }
  const total = [...parEnveloppe.values()].reduce((s, v) => s + v, 0);
  const groupes = new Map<string, PartCategorie>();
  for (const [enveloppeId, montant] of parEnveloppe) {
    if (montant <= 0) continue;
    const env = enveloppes.find((e) => e.id === enveloppeId);
    const nomCat = env?.categorie?.trim() || "Sans catégorie";
    const groupe = groupes.get(nomCat) ?? { nom: nomCat, montant: 0, part: 0, enveloppes: [] };
    groupe.montant += montant;
    groupe.enveloppes.push({
      nom: env?.nom ?? enveloppeId,
      emoji: env?.emoji ?? "💸",
      montant,
    });
    groupes.set(nomCat, groupe);
  }
  return [...groupes.values()]
    .map((g) => ({
      ...g,
      part: total > 0 ? Math.round((g.montant / total) * 100) : 0,
      enveloppes: g.enveloppes.sort((a, b) => b.montant - a.montant),
    }))
    .sort((a, b) => b.montant - a.montant);
}

/**
 * Dépense moyenne par jour et projection de fin de mois.
 * Simple façade : le calcul vient du noyau unique (cerveau/faits) pour que
 * tous les écrans affichent exactement la même projection.
 */
export function projectionFinDeMois(transactions: Transaction[]): {
  moyenneJour: number;
  dejaDepense: number;
  joursRestants: number;
  projection: number;
} {
  const faits = calculerFaits({ transactions, enveloppes: [] });
  return {
    moyenneJour:
      faits.joursEcoules > 0 ? Math.round(faits.moisCourant.depenses / faits.joursEcoules) : 0,
    dejaDepense: faits.moisCourant.depenses,
    joursRestants: faits.joursRestants,
    projection: faits.projectionFinDeMois,
  };
}

export type Conseil = {
  id: string;
  niveau: "alerte" | "attention" | "bon";
  titre: string;
  texte: string;
};

export type Diagnostic = {
  score: number;
  mention: string;
  conseils: Conseil[];
};

/**
 * Score de santé financière sur 100 : capacité d'épargne, respect des plafonds,
 * poids des dettes et régularité des revenus.
 */
export function diagnostiquer(args: {
  totaux: Totaux;
  precedents: Totaux;
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
  dettes: Dette[];
  budgets: Budget[];
  solde: number;
}): Diagnostic {
  const { totaux, precedents, enveloppes, depensesParEnveloppe, dettes, budgets, solde } = args;
  const conseils: Conseil[] = [];
  let score = 100;

  const tauxEpargne = totaux.revenus > 0 ? Math.round((totaux.net / totaux.revenus) * 100) : 0;

  if (totaux.revenus === 0) {
    score -= 20;
    conseils.push({
      id: "revenu",
      niveau: "attention",
      titre: "Aucun revenu enregistré",
      texte: "Enregistrez vos entrées d'argent pour obtenir une analyse fiable de votre foyer.",
    });
  } else if (tauxEpargne < 0) {
    score -= 40;
    conseils.push({
      id: "deficit",
      niveau: "alerte",
      titre: "Vous dépensez plus que vous ne gagnez",
      texte: `Votre solde de période est négatif. Réduisez d'abord les postes non vitaux et reportez les achats de confort.`,
    });
  } else if (tauxEpargne < 10) {
    score -= 20;
    conseils.push({
      id: "epargne-faible",
      niveau: "attention",
      titre: `Épargne faible (${tauxEpargne} %)`,
      texte: "Visez au moins 10 % : mettez la part d'épargne de côté dès la réception du revenu.",
    });
  } else {
    conseils.push({
      id: "epargne-ok",
      niveau: "bon",
      titre: `Bon rythme d'épargne (${tauxEpargne} %)`,
      texte: "Continuez ainsi et constituez une réserve équivalente à 3 mois de dépenses.",
    });
  }

  const depassees = enveloppes.filter(
    (e) => etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0).plafondAtteint,
  );
  if (depassees.length > 0) {
    score -= Math.min(25, depassees.length * 8);
    conseils.push({
      id: "plafonds",
      niveau: "alerte",
      titre: `${depassees.length} enveloppe(s) en zone rouge`,
      texte: `Plafond atteint pour : ${depassees.map((e) => e.nom).join(", ")}. Ces postes puisent désormais dans la réserve.`,
    });
  }

  const dettesDues = dettes.filter((d) => d.sens === "dette" && resteDu(d) > 0);
  const totalDettes = dettesDues.reduce((s, d) => s + resteDu(d), 0);
  if (totalDettes > 0) {
    const poids = totaux.revenus > 0 ? Math.round((totalDettes / totaux.revenus) * 100) : 100;
    if (poids > 40) {
      score -= 20;
      conseils.push({
        id: "dettes",
        niveau: "alerte",
        titre: "Endettement élevé",
        texte: `Vos dettes représentent environ ${poids} % de vos revenus de la période. Priorisez le remboursement des plus petites pour libérer du souffle.`,
      });
    } else {
      conseils.push({
        id: "dettes-ok",
        niveau: "attention",
        titre: "Dettes en cours",
        texte: `Il reste ${totalDettes.toLocaleString("fr-FR")} FCFA à rembourser. Planifiez ces remboursements dans la Budgétisation.`,
      });
    }
  }

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const enRetard = dettes.filter(
    (d) => d.dateLimite && d.dateLimite < aujourdHui && resteDu(d) > 0,
  );
  if (enRetard.length > 0) {
    score -= 10;
    conseils.push({
      id: "retard",
      niveau: "alerte",
      titre: `${enRetard.length} échéance(s) dépassée(s)`,
      texte: `À régulariser : ${enRetard.map((d) => d.personne).join(", ")}.`,
    });
  }

  const evolution = variation(totaux.depenses, precedents.depenses);
  if (evolution !== null && evolution >= 20) {
    score -= 10;
    conseils.push({
      id: "hausse",
      niveau: "attention",
      titre: `Dépenses en hausse de ${evolution} %`,
      texte: "Comparé à la période précédente. Vérifiez quelle catégorie a le plus augmenté.",
    });
  } else if (evolution !== null && evolution <= -10) {
    conseils.push({
      id: "baisse",
      niveau: "bon",
      titre: `Dépenses en baisse de ${Math.abs(evolution)} %`,
      texte: "Excellent réflexe : transformez cette économie en épargne planifiée.",
    });
  }

  if (budgets.filter((b) => b.actif).length === 0) {
    score -= 5;
    conseils.push({
      id: "planif",
      niveau: "attention",
      titre: "Aucune dépense planifiée",
      texte:
        "Utilisez la Budgétisation pour prévoir vos dépenses récurrentes et éviter les surprises.",
    });
  }

  if (solde < 0) {
    score -= 15;
    conseils.push({
      id: "solde",
      niveau: "alerte",
      titre: "Solde global négatif",
      texte: "Vos comptes sont à découvert : suspendez toute dépense non indispensable.",
    });
  }

  score = Math.max(0, Math.min(100, score));
  const mention =
    score >= 80
      ? "Situation saine"
      : score >= 60
        ? "Situation correcte"
        : score >= 40
          ? "Vigilance"
          : "Situation critique";

  return { score, mention, conseils };
}

/** Les plus grosses dépenses de la période. */
export function plusGrossesDepenses(transactions: Transaction[], limite = 5): Transaction[] {
  return transactions
    .filter((t) => t.type === "depense")
    .sort((a, b) => b.montant - a.montant)
    .slice(0, limite);
}

/** Somme des dépenses par mois (6 derniers mois), pour la tendance. */
export function tendanceMensuelle(
  transactions: Transaction[],
): { mois: string; label: string; revenus: number; depenses: number }[] {
  const maintenant = new Date();
  const series: { mois: string; label: string; revenus: number; depenses: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    series.push({
      mois: cle,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      revenus: 0,
      depenses: 0,
    });
  }
  for (const t of transactions) {
    const cle = jour(t.date).slice(0, 7);
    const ligne = series.find((s) => s.mois === cle);
    if (!ligne) continue;
    if (t.type === "revenu") ligne.revenus += t.montant;
    else ligne.depenses += t.montant;
  }
  return series;
}

/* ------------------------------------------------------------------ */
/* Compléments : comparaison par catégorie, prévu vs réel, anomalies,   */
/* alertes d'épuisement d'enveloppe et résumé partageable.              */
/* ------------------------------------------------------------------ */

export type EvolutionCategorie = {
  nom: string;
  actuel: number;
  precedent: number;
  ecart: number;
  pourcentage: number | null;
};

/** Compare les dépenses par catégorie entre la période et la précédente. */
export function comparerCategories(
  periode: Transaction[],
  precedente: Transaction[],
  enveloppes: Enveloppe[],
): EvolutionCategorie[] {
  const cle = (t: Transaction) => {
    const env = enveloppes.find((e) => e.id === t.categorie);
    return env?.categorie?.trim() || "Sans catégorie";
  };
  const cumuler = (liste: Transaction[]) => {
    const m = new Map<string, number>();
    for (const t of liste) {
      if (t.type !== "depense") continue;
      m.set(cle(t), (m.get(cle(t)) ?? 0) + t.montant);
    }
    return m;
  };
  const a = cumuler(periode);
  const b = cumuler(precedente);
  const noms = new Set([...a.keys(), ...b.keys()]);
  return [...noms]
    .map((nom) => {
      const actuel = a.get(nom) ?? 0;
      const precedent = b.get(nom) ?? 0;
      return {
        nom,
        actuel,
        precedent,
        ecart: actuel - precedent,
        pourcentage: variation(actuel, precedent),
      };
    })
    .filter((e) => e.actuel > 0 || e.precedent > 0)
    .sort((x, y) => Math.abs(y.ecart) - Math.abs(x.ecart));
}

export type LignePrevuReel = {
  enveloppeId: string;
  nom: string;
  emoji: string;
  prevu: number;
  reel: number;
  ecart: number;
  respect: number;
};

/** Confronte les montants planifiés (Budgétisation) aux dépenses réelles du mois. */
export function prevuContreReel(
  budgets: Budget[],
  transactions: Transaction[],
  enveloppes: Enveloppe[],
): { lignes: LignePrevuReel[]; totalPrevu: number; totalReel: number } {
  const maintenant = new Date();
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const parMois: Record<string, number> = {
    jour: 30,
    semaine: 4.345,
    mois: 1,
    trimestre: 1 / 3,
    semestre: 1 / 6,
    annee: 1 / 12,
  };

  const prevus = new Map<string, number>();
  for (const b of budgets) {
    if (!b.actif) continue;
    const intervalle = Math.max(1, Math.round(b.intervalle ?? 1));
    const mensuel = b.ponctuel
      ? b.montant
      : Math.round((b.montant * (parMois[b.periode] ?? 1)) / intervalle);
    prevus.set(b.enveloppeId, (prevus.get(b.enveloppeId) ?? 0) + mensuel);
  }

  const reels = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "depense" || jour(t.date) < debutMois) continue;
    reels.set(t.categorie, (reels.get(t.categorie) ?? 0) + t.montant);
  }

  const ids = new Set([...prevus.keys(), ...reels.keys()]);
  const lignes = [...ids].map((id) => {
    const env = enveloppes.find((e) => e.id === id);
    const prevu = prevus.get(id) ?? 0;
    const reel = reels.get(id) ?? 0;
    return {
      enveloppeId: id,
      nom: env?.nom ?? id,
      emoji: env?.emoji ?? "💸",
      prevu,
      reel,
      ecart: reel - prevu,
      respect: prevu > 0 ? Math.round((reel / prevu) * 100) : reel > 0 ? 100 : 0,
    };
  });
  lignes.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));
  return {
    lignes,
    totalPrevu: lignes.reduce((s, l) => s + l.prevu, 0),
    totalReel: lignes.reduce((s, l) => s + l.reel, 0),
  };
}

/** Résumé texte du rapport, prêt à être copié ou partagé. */
export function resumeTexte(args: {
  fenetre: string;
  diagnostic: Diagnostic;
  totaux: Totaux;
  projection: number;
  repartition: PartCategorie[];
}): string {
  const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
  const lignes = [
    `RAPPORT FINANCIER — ${args.fenetre}`,
    `Score de santé : ${args.diagnostic.score}/100 (${args.diagnostic.mention})`,
    `Revenus : ${f(args.totaux.revenus)} · Dépenses : ${f(args.totaux.depenses)} · Solde : ${f(args.totaux.net)}`,
    `Projection de fin de mois : ${f(args.projection)}`,
    "",
    "Répartition des dépenses :",
    ...args.repartition.map((c) => `- ${c.nom} : ${f(c.montant)} (${c.part} %)`),
    "",
    "Conseils :",
    ...args.diagnostic.conseils.map((c) => `- [${c.niveau}] ${c.titre} : ${c.texte}`),
  ];
  return lignes.join("\n");
}
