import type { Budget, Enveloppe, Transaction } from "./store";

/**
 * Compléments d'analyse : comparaison mois par mois, jours de la semaine,
 * réalisation des budgets, sources de revenus, dépenses récurrentes,
 * comparaison à la moyenne, objectif d'épargne, historique des scores,
 * répartition circulaire et export PDF du rapport.
 */

const JOURS_SEMAINE = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

function cleMois(iso: string): string {
  return iso.slice(0, 7);
}

function labelMois(cle: string): string {
  const [a, m] = cle.split("-");
  const d = new Date(Number(a), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* 1. Comparaison mois par mois (12 derniers mois)                      */
/* ------------------------------------------------------------------ */

export type LigneMois = {
  mois: string;
  label: string;
  revenus: number;
  depenses: number;
  net: number;
};

export function comparaisonMensuelle(transactions: Transaction[], nombreMois = 12): LigneMois[] {
  const maintenant = new Date();
  const series: LigneMois[] = [];
  for (let i = nombreMois - 1; i >= 0; i -= 1) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    series.push({ mois: cle, label: labelMois(cle), revenus: 0, depenses: 0, net: 0 });
  }
  for (const t of transactions) {
    const ligne = series.find((s) => s.mois === cleMois(t.date));
    if (!ligne) continue;
    if (t.type === "revenu") ligne.revenus += t.montant;
    else ligne.depenses += t.montant;
  }
  for (const l of series) l.net = l.revenus - l.depenses;
  return series;
}

/* ------------------------------------------------------------------ */
/* 2. Analyse par jour de la semaine                                    */
/* ------------------------------------------------------------------ */

export type LigneJour = {
  index: number;
  nom: string;
  montant: number;
  operations: number;
  part: number;
};

export function analyseJoursSemaine(transactions: Transaction[]): LigneJour[] {
  const lignes: LigneJour[] = JOURS_SEMAINE.map((nom, index) => ({
    index,
    nom,
    montant: 0,
    operations: 0,
    part: 0,
  }));
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const d = new Date(`${t.date.slice(0, 10)}T12:00:00`);
    const i = d.getDay();
    const ligne = lignes[i];
    if (!ligne) continue;
    ligne.montant += t.montant;
    ligne.operations += 1;
    total += t.montant;
  }
  for (const l of lignes) l.part = total > 0 ? Math.round((l.montant / total) * 100) : 0;
  // Semaine à la française : lundi → dimanche.
  return [...lignes.slice(1), ...lignes.slice(0, 1)];
}

/* ------------------------------------------------------------------ */
/* 3. Taux de réalisation des budgets planifiés                         */
/* ------------------------------------------------------------------ */

export type RealisationBudget = {
  id: string;
  libelle: string;
  enveloppe: string;
  prevu: number;
  realise: number;
  taux: number;
};

export function tauxRealisationBudgets(
  budgets: Budget[],
  transactions: Transaction[],
  enveloppes: Enveloppe[],
): { lignes: RealisationBudget[]; tauxGlobal: number } {
  const lignes = budgets.map((b) => {
    const realise = transactions
      .filter((t) => t.type === "depense" && t.budgetId === b.id)
      .reduce((s, t) => s + t.montant, 0);
    const env = enveloppes.find((e) => e.id === b.enveloppeId);
    return {
      id: b.id,
      libelle: b.libelle,
      enveloppe: env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée",
      prevu: b.montant,
      realise,
      taux: b.montant > 0 ? Math.round((realise / b.montant) * 100) : 0,
    };
  });
  const prevu = lignes.reduce((s, l) => s + l.prevu, 0);
  const realise = lignes.reduce((s, l) => s + l.realise, 0);
  return {
    lignes: lignes.sort((a, b) => b.taux - a.taux),
    tauxGlobal: prevu > 0 ? Math.round((realise / prevu) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Revenus par source                                                */
/* ------------------------------------------------------------------ */

export type PartSource = { nom: string; montant: number; part: number; operations: number };

export function revenusParSource(transactions: Transaction[]): PartSource[] {
  const carte = new Map<string, { montant: number; operations: number }>();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== "revenu") continue;
    const cle = (t.categorie || "Autre").trim() || "Autre";
    const actuel = carte.get(cle) ?? { montant: 0, operations: 0 };
    actuel.montant += t.montant;
    actuel.operations += 1;
    carte.set(cle, actuel);
    total += t.montant;
  }
  return [...carte.entries()]
    .map(([nom, v]) => ({
      nom,
      montant: v.montant,
      operations: v.operations,
      part: total > 0 ? Math.round((v.montant / total) * 100) : 0,
    }))
    .sort((a, b) => b.montant - a.montant);
}

/* ------------------------------------------------------------------ */
/* 5. Dépenses récurrentes (abonnements détectés)                       */
/* ------------------------------------------------------------------ */

export type Recurrence = {
  libelle: string;
  occurrences: number;
  montantMoyen: number;
  total: number;
  derniere: string;
};

export function depensesRecurrentes(
  transactions: Transaction[],
  minimumOccurrences = 3,
): Recurrence[] {
  const carte = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    const cle = t.libelle.trim().toUpperCase();
    if (!cle) continue;
    carte.set(cle, [...(carte.get(cle) ?? []), t]);
  }
  return [...carte.entries()]
    .filter(([, liste]) => liste.length >= minimumOccurrences)
    .map(([libelle, liste]) => {
      const total = liste.reduce((s, t) => s + t.montant, 0);
      const dates = liste.map((t) => t.date.slice(0, 10)).sort();
      return {
        libelle,
        occurrences: liste.length,
        montantMoyen: Math.round(total / liste.length),
        total,
        derniere: dates[dates.length - 1] ?? "",
      };
    })
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------------------------------------------ */
/* 6. Comparaison à la moyenne des mois précédents                      */
/* ------------------------------------------------------------------ */

export type ComparaisonMoyenne = {
  moisCourant: number;
  moyenne: number;
  ecart: number;
  pourcentage: number | null;
  moisComptes: number;
};

export function comparerALaMoyenne(
  transactions: Transaction[],
  nombreMois = 6,
): ComparaisonMoyenne {
  const series = comparaisonMensuelle(transactions, nombreMois + 1);
  const courant = series[series.length - 1];
  const precedents = series.slice(0, -1).filter((m) => m.revenus > 0 || m.depenses > 0);
  const moisCourant = courant?.depenses ?? 0;
  const moyenne =
    precedents.length > 0
      ? Math.round(precedents.reduce((s, m) => s + m.depenses, 0) / precedents.length)
      : 0;
  return {
    moisCourant,
    moyenne,
    ecart: moisCourant - moyenne,
    pourcentage: moyenne > 0 ? Math.round(((moisCourant - moyenne) / moyenne) * 100) : null,
    moisComptes: precedents.length,
  };
}

/* ------------------------------------------------------------------ */
/* 7. Objectif d'épargne                                                */
/* ------------------------------------------------------------------ */

export type SuiviObjectif = {
  cible: number;
  epargneReelle: number;
  progression: number;
  manque: number;
  atteint: boolean;
};

export function suivreObjectifEpargne(transactions: Transaction[], cible: number): SuiviObjectif {
  const cleCourante = cleMois(new Date().toISOString());
  let revenus = 0;
  let depenses = 0;
  for (const t of transactions) {
    if (cleMois(t.date) !== cleCourante) continue;
    if (t.type === "revenu") revenus += t.montant;
    else depenses += t.montant;
  }
  const epargneReelle = revenus - depenses;
  const progression = cible > 0 ? Math.round((epargneReelle / cible) * 100) : 0;
  return {
    cible,
    epargneReelle,
    progression: Math.max(0, progression),
    manque: Math.max(0, cible - epargneReelle),
    atteint: cible > 0 && epargneReelle >= cible,
  };
}

/* ------------------------------------------------------------------ */
/* 8. Historique des scores de santé                                    */
/* ------------------------------------------------------------------ */

export type ScoreMois = { mois: string; label: string; score: number };

/** Score simplifié d'un mois : basé sur le taux d'épargne du mois. */
export function scoreMensuel(revenus: number, depenses: number): number {
  if (revenus <= 0) return depenses > 0 ? 20 : 50;
  const taux = (revenus - depenses) / revenus;
  return Math.max(0, Math.min(100, Math.round(50 + taux * 100)));
}

export function historiqueScores(transactions: Transaction[], nombreMois = 6): ScoreMois[] {
  return comparaisonMensuelle(transactions, nombreMois).map((m) => ({
    mois: m.mois,
    label: m.label,
    score: scoreMensuel(m.revenus, m.depenses),
  }));
}

/* ------------------------------------------------------------------ */
/* 9. Graphique circulaire : dégradé conique                            */
/* ------------------------------------------------------------------ */

export const COULEURS_SECTEURS = [
  "#e11d74",
  "#f472b6",
  "#fb7185",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
];

export function degradeCirculaire(parts: { part: number }[]): string {
  if (parts.length === 0) return "conic-gradient(#e5e7eb 0deg 360deg)";
  const segments: string[] = [];
  let angle = 0;
  parts.forEach((p, i) => {
    const taille = (Math.max(0, p.part) / 100) * 360;
    const couleur = COULEURS_SECTEURS[i % COULEURS_SECTEURS.length];
    segments.push(`${couleur} ${angle}deg ${angle + taille}deg`);
    angle += taille;
  });
  if (angle < 360) segments.push(`#e5e7eb ${angle}deg 360deg`);
  return `conic-gradient(${segments.join(", ")})`;
}

/* ------------------------------------------------------------------ */
/* 10. Export PDF du rapport (impression navigateur)                    */
/* ------------------------------------------------------------------ */

function echapper(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exporterRapportPdf(titre: string, contenu: string): boolean {
  if (typeof window === "undefined") return false;
  const fenetre = window.open("", "_blank", "width=800,height=1000");
  if (!fenetre) return false;
  fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${echapper(titre)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 28px; color: #1f2937; }
  h1 { font-size: 20px; margin-bottom: 4px; color: #be185d; }
  .date { font-size: 12px; color: #6b7280; margin-bottom: 18px; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6; }
</style></head><body>
<h1>${echapper(titre)}</h1>
<p class="date">Édité le ${new Date().toLocaleDateString("fr-FR")}</p>
<pre>${echapper(contenu)}</pre>
</body></html>`);
  fenetre.document.close();
  fenetre.focus();
  window.setTimeout(() => fenetre.print(), 350);
  return true;
}
