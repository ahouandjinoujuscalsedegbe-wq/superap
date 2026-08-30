/**
 * Moteur de conseil financier dynamique.
 *
 * Il agrège l'ensemble des signaux de l'application (revenus, dépenses,
 * enveloppes, dettes, budgets) pour produire :
 *  - un score de santé financière sur 100, décomposé en piliers ;
 *  - des recommandations classées par gain estimé en FCFA ;
 *  - un plan d'action concret sur 30, 90 et 365 jours.
 *
 * Fonctions pures et testables : aucun accès au stockage ni au réseau.
 */

import type { Budget, Dette, Enveloppe, Transaction } from "./store";
import { resteDu } from "./store";
import { rythmeJournalier, revenuMensuelMoyen } from "./simulation";

const JOUR = 86_400_000;

function j(iso: string): string {
  return iso.slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Score de santé financière                                            */
/* ------------------------------------------------------------------ */

export type Pilier = {
  nom: string;
  score: number; // 0 à 100
  poids: number; // pondération dans le score global
  commentaire: string;
};

export type SanteFinanciere = {
  score: number;
  niveau: "critique" | "fragile" | "correct" | "solide" | "excellent";
  piliers: Pilier[];
  revenuMensuel: number;
  depenseMensuelle: number;
  tauxEpargne: number;
  moisDeReserve: number;
  poidsDettes: number;
};

function borne(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function evaluerSante(args: {
  transactions: Transaction[];
  dettes: Dette[];
  solde: number;
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
}): SanteFinanciere {
  const { transactions, dettes, solde, enveloppes, depensesParEnveloppe } = args;

  const revenuMensuel = Math.round(revenuMensuelMoyen(transactions, 3));
  const depenseMensuelle = Math.round(rythmeJournalier(transactions, 90) * 30);
  const tauxEpargne = revenuMensuel > 0 ? (revenuMensuel - depenseMensuelle) / revenuMensuel : 0;
  const moisDeReserve = depenseMensuelle > 0 ? solde / depenseMensuelle : solde > 0 ? 6 : 0;
  const detteRestante = dettes
    .filter((d) => d.sens === "dette")
    .reduce((s, d) => s + resteDu(d), 0);
  const poidsDettes = revenuMensuel > 0 ? detteRestante / revenuMensuel : detteRestante > 0 ? 6 : 0;

  const depassements = enveloppes.filter(
    (e) => (depensesParEnveloppe[e.id] ?? 0) > (e.dotation ?? e.plafond ?? 0),
  ).length;
  const disciplineBase =
    enveloppes.length > 0 ? 100 - (depassements / enveloppes.length) * 100 : 60;

  const piliers: Pilier[] = [
    {
      nom: "Capacité d'épargne",
      score: borne((tauxEpargne / 0.2) * 100),
      poids: 0.3,
      commentaire:
        tauxEpargne >= 0.2
          ? "Vous épargnez au moins un cinquième de vos revenus."
          : tauxEpargne > 0
            ? "Vous épargnez, mais en dessous de l'objectif de 20 %."
            : "Vos dépenses dépassent vos revenus.",
    },
    {
      nom: "Réserve de sécurité",
      score: borne((moisDeReserve / 3) * 100),
      poids: 0.25,
      commentaire: `Vous tenez environ ${moisDeReserve.toFixed(1)} mois sans revenu.`,
    },
    {
      nom: "Poids des dettes",
      score: borne(100 - (poidsDettes / 3) * 100),
      poids: 0.2,
      commentaire:
        detteRestante > 0
          ? `Vos dettes représentent ${poidsDettes.toFixed(1)} mois de revenu.`
          : "Aucune dette en cours.",
    },
    {
      nom: "Discipline des enveloppes",
      score: borne(disciplineBase),
      poids: 0.15,
      commentaire:
        depassements === 0
          ? "Aucune enveloppe dépassée."
          : `${depassements} enveloppe(s) au-dessus de leur dotation.`,
    },
    {
      nom: "Régularité de suivi",
      score: borne((transactions.filter((t) => j(t.date) >= j(new Date(Date.now() - 30 * JOUR).toISOString())).length / 20) * 100),
      poids: 0.1,
      commentaire: "Plus vous saisissez, plus les conseils sont précis.",
    },
  ];

  const score = borne(piliers.reduce((s, p) => s + p.score * p.poids, 0));
  const niveau: SanteFinanciere["niveau"] =
    score >= 85 ? "excellent" : score >= 70 ? "solide" : score >= 50 ? "correct" : score >= 30 ? "fragile" : "critique";

  return {
    score,
    niveau,
    piliers,
    revenuMensuel,
    depenseMensuelle,
    tauxEpargne,
    moisDeReserve,
    poidsDettes,
  };
}

/* ------------------------------------------------------------------ */
/* Recommandations priorisées                                           */
/* ------------------------------------------------------------------ */

export type Recommandation = {
  id: string;
  titre: string;
  explication: string;
  action: string;
  /** Gain ou économie estimée en FCFA par mois. */
  gainMensuel: number;
  priorite: "haute" | "moyenne" | "basse";
  horizon: "30 jours" | "90 jours" | "1 an";
  categorie: "epargne" | "depense" | "dette" | "revenu" | "organisation" | "securite";
};

export function conseiller(args: {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  budgets: Budget[];
  dettes: Dette[];
  depensesParEnveloppe: Record<string, number>;
  solde: number;
}): Recommandation[] {
  const { transactions, enveloppes, budgets, dettes, depensesParEnveloppe, solde } = args;
  const sante = evaluerSante({
    transactions,
    dettes,
    solde,
    enveloppes,
    depensesParEnveloppe,
  });
  const recos: Recommandation[] = [];

  /* 1. Déficit structurel. */
  if (sante.revenuMensuel > 0 && sante.depenseMensuelle > sante.revenuMensuel) {
    const ecart = Math.round(sante.depenseMensuelle - sante.revenuMensuel);
    recos.push({
      id: "deficit",
      titre: "Vous dépensez plus que vous ne gagnez",
      explication: `Chaque mois, il vous manque environ ${ecart} FCFA pour équilibrer le budget.`,
      action: `Réduisez ${ecart} FCFA sur vos trois plus grosses enveloppes ou trouvez un revenu complémentaire.`,
      gainMensuel: ecart,
      priorite: "haute",
      horizon: "30 jours",
      categorie: "depense",
    });
  }

  /* 2. Réserve de sécurité insuffisante. */
  if (sante.moisDeReserve < 3 && sante.depenseMensuelle > 0) {
    const cible = Math.round(sante.depenseMensuelle * 3 - solde);
    recos.push({
      id: "reserve",
      titre: "Constituez un fonds d'urgence de 3 mois",
      explication: `Il vous manque environ ${Math.max(0, cible)} FCFA pour tenir trois mois sans revenu.`,
      action: `Mettez de côté ${Math.max(1000, Math.round(Math.max(0, cible) / 12))} FCFA par mois dans une enveloppe « Urgence ».`,
      gainMensuel: Math.round(Math.max(0, cible) / 12),
      priorite: sante.moisDeReserve < 1 ? "haute" : "moyenne",
      horizon: "1 an",
      categorie: "securite",
    });
  }

  /* 3. Dettes coûteuses en priorité. */
  const dettesOuvertes = dettes
    .filter((d) => d.sens === "dette" && resteDu(d) > 0)
    .sort((a, b) => resteDu(a) - resteDu(b));
  if (dettesOuvertes.length > 0) {
    const petite = dettesOuvertes[0] as Dette;
    const total = dettesOuvertes.reduce((s, d) => s + resteDu(d), 0);
    recos.push({
      id: "dettes",
      titre: "Soldez d'abord la plus petite dette",
      explication: `Vous devez ${total} FCFA au total. La plus petite (${petite.personne}, ${resteDu(petite)} FCFA) se solde vite et libère de la marge.`,
      action: `Affectez votre prochain surplus au remboursement de ${petite.personne}.`,
      gainMensuel: Math.round(resteDu(petite) / 6),
      priorite: sante.poidsDettes > 2 ? "haute" : "moyenne",
      horizon: "90 jours",
      categorie: "dette",
    });
  }

  /* 4. Créances à recouvrer. */
  const creances = dettes.filter((d) => d.sens === "creance" && resteDu(d) > 0);
  if (creances.length > 0) {
    const total = creances.reduce((s, d) => s + resteDu(d), 0);
    recos.push({
      id: "creances",
      titre: "Relancez l'argent qu'on vous doit",
      explication: `${creances.length} personne(s) vous doivent ${total} FCFA au total.`,
      action: "Relancez d'abord la créance la plus ancienne et fixez une date de remboursement.",
      gainMensuel: Math.round(total / 3),
      priorite: "moyenne",
      horizon: "90 jours",
      categorie: "revenu",
    });
  }

  /* 5. Enveloppes dépassées. */
  for (const e of enveloppes) {
    const dotation = e.dotation ?? e.plafond ?? 0;
    const utilise = depensesParEnveloppe[e.id] ?? 0;
    if (dotation > 0 && utilise > dotation) {
      const exces = Math.round(utilise - dotation);
      recos.push({
        id: `enveloppe-${e.id}`,
        titre: `Enveloppe « ${e.nom} » dépassée de ${exces} FCFA`,
        explication: `Vous avez engagé ${utilise} FCFA pour une dotation de ${dotation} FCFA.`,
        action: `Suspendez les dépenses de « ${e.nom} » ou relevez sa dotation en réduisant une autre enveloppe.`,
        gainMensuel: exces,
        priorite: exces > dotation * 0.25 ? "haute" : "moyenne",
        horizon: "30 jours",
        categorie: "depense",
      });
    }
  }

  /* 6. Poste de dépense dominant. */
  const parCategorie = new Map<string, number>();
  const limite = j(new Date(Date.now() - 30 * JOUR).toISOString());
  for (const t of transactions) {
    if (t.type !== "depense" || j(t.date) < limite) continue;
    parCategorie.set(t.categorie, (parCategorie.get(t.categorie) ?? 0) + t.montant);
  }
  const totalMois = [...parCategorie.values()].reduce((s, v) => s + v, 0);
  const dominant = [...parCategorie.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && totalMois > 0 && dominant[1] / totalMois > 0.4) {
    const nom = enveloppes.find((e) => e.id === dominant[0])?.nom ?? dominant[0];
    const economie = Math.round(dominant[1] * 0.1);
    recos.push({
      id: "concentration",
      titre: `« ${nom} » absorbe ${Math.round((dominant[1] / totalMois) * 100)} % de vos dépenses`,
      explication: "Une dépense trop concentrée fragilise le budget en cas d'imprévu.",
      action: `Une baisse de 10 % sur ce poste libère environ ${economie} FCFA par mois.`,
      gainMensuel: economie,
      priorite: "moyenne",
      horizon: "90 jours",
      categorie: "depense",
    });
  }

  /* 7. Petites dépenses répétées. */
  const petites = transactions.filter(
    (t) => t.type === "depense" && t.montant <= 2000 && j(t.date) >= limite,
  );
  if (petites.length >= 10) {
    const cumul = petites.reduce((s, t) => s + t.montant, 0);
    recos.push({
      id: "petites-depenses",
      titre: "Les petites dépenses pèsent lourd",
      explication: `${petites.length} dépenses de moins de 2 000 FCFA ont coûté ${cumul} FCFA en un mois.`,
      action: `Fixez un plafond quotidien de ${Math.round((cumul * 0.7) / 30)} FCFA pour ces achats.`,
      gainMensuel: Math.round(cumul * 0.3),
      priorite: "moyenne",
      horizon: "30 jours",
      categorie: "depense",
    });
  }

  /* 8. Budgets planifiés non suivis. */
  if (budgets.length === 0 && enveloppes.length > 0) {
    recos.push({
      id: "budgetisation",
      titre: "Planifiez vos dépenses récurrentes",
      explication: "Aucune dépense planifiée n'est enregistrée : les échéances risquent de surprendre.",
      action: "Ouvrez Enveloppes → Budgétisation et planifiez loyer, scolarité et factures.",
      gainMensuel: 0,
      priorite: "moyenne",
      horizon: "30 jours",
      categorie: "organisation",
    });
  }

  /* 9. Marge disponible à faire fructifier. */
  if (sante.tauxEpargne >= 0.2 && sante.moisDeReserve >= 3) {
    const marge = Math.round(sante.revenuMensuel - sante.depenseMensuelle);
    recos.push({
      id: "placement",
      titre: "Faites travailler votre surplus",
      explication: `Vous dégagez environ ${marge} FCFA par mois au-delà de votre réserve.`,
      action: "Affectez ce surplus à un projet daté (terrain, formation, matériel) plutôt qu'au compte courant.",
      gainMensuel: marge,
      priorite: "basse",
      horizon: "1 an",
      categorie: "epargne",
    });
  }

  /* 10. Données insuffisantes. */
  if (transactions.length < 10) {
    recos.push({
      id: "donnees",
      titre: "Enrichissez vos données",
      explication: "Moins de dix opérations enregistrées : les prévisions restent approximatives.",
      action: "Saisissez vos dépenses pendant deux semaines, y compris les petits achats.",
      gainMensuel: 0,
      priorite: "haute",
      horizon: "30 jours",
      categorie: "organisation",
    });
  }

  const rang = { haute: 0, moyenne: 1, basse: 2 } as const;
  return recos.sort(
    (a, b) => rang[a.priorite] - rang[b.priorite] || b.gainMensuel - a.gainMensuel,
  );
}

/* ------------------------------------------------------------------ */
/* Plan d'action                                                        */
/* ------------------------------------------------------------------ */

export type PlanAction = {
  horizon: Recommandation["horizon"];
  etapes: string[];
  gainCumule: number;
};

export function planDAction(recos: Recommandation[]): PlanAction[] {
  const horizons: Recommandation["horizon"][] = ["30 jours", "90 jours", "1 an"];
  return horizons.map((horizon) => {
    const liste = recos.filter((r) => r.horizon === horizon);
    return {
      horizon,
      etapes: liste.map((r) => r.action),
      gainCumule: liste.reduce((s, r) => s + r.gainMensuel, 0),
    };
  });
}
