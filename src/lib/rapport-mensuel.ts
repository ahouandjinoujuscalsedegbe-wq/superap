/**
 * Rapport mensuel automatique : bilan complet du mois, calculé localement.
 *
 * Règle métier : le rapport ne compte QUE les opérations déjà effectuées
 * (date passée ou du jour). Les dépenses planifiées non encore réalisées
 * n'entrent pas dans les totaux ; celles dont l'échéance est dépassée sont
 * listées à part comme « dépenses prévues en retard ».
 */
import type { Budget, Dette, Enveloppe, Transaction } from "./store";
import { resteDu } from "./store";
import { dotationDe } from "./enveloppe-etat";

export type LigneEnveloppe = {
  id: string;
  nom: string;
  emoji: string;
  dotation: number;
  depense: number;
  ecart: number;
  depassee: boolean;
};

/** Dépense planifiée dont l'échéance est passée sans qu'elle soit effectuée. */
export type DepenseEnRetard = {
  id: string;
  libelle: string;
  montant: number;
  echeance: string;
  emoji: string;
  enveloppe: string;
  /** Nombre de jours de retard. */
  joursRetard: number;
};

export type RapportMensuel = {
  /** Mois au format AAAA-MM. */
  mois: string;
  libelleMois: string;
  revenus: number;
  depenses: number;
  net: number;
  /** Taux d'épargne en pourcentage du revenu. */
  tauxEpargne: number;
  nbOperations: number;
  /** Variation des dépenses par rapport au mois précédent, en pourcentage. */
  variationDepenses: number;
  enveloppes: LigneEnveloppe[];
  plusGrossesDepenses: Transaction[];
  /** Dépenses répétées qui pèsent sur le budget. */
  fuites: { libelle: string; total: number; occurrences: number }[];
  /** Dépenses prévues, non effectuées, dont l'échéance est déjà passée. */
  enRetard: DepenseEnRetard[];
  totalEnRetard: number;
  detteRestante: number;
  creanceRestante: number;
  /** Note globale sur 100. */
  score: number;
  conseils: string[];
};


const MOIS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Libellé lisible d'un mois AAAA-MM. */
export function libelleMois(mois: string): string {
  const [a, m] = mois.split("-");
  const index = Number(m) - 1;
  return `${MOIS_FR[index] ?? m} ${a}`;
}

/** Mois précédent au format AAAA-MM. */
function moisPrecedent(mois: string): string {
  const a = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7));
  const d = new Date(Date.UTC(a, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** Liste des mois où au moins une opération a été enregistrée, du plus récent au plus ancien. */
export function moisDisponibles(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(t.date.slice(0, 7));
  set.add(new Date().toISOString().slice(0, 7));
  return [...set].sort().reverse();
}

function normaliser(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Construit le bilan complet d'un mois donné. */
export function construireRapport(
  mois: string,
  donnees: {
    transactions: Transaction[];
    enveloppes: Enveloppe[];
    dettes: Dette[];
    budgets?: Budget[];
  },
): RapportMensuel {
  // Aujourd'hui : borne au-delà de laquelle une opération n'est pas encore effectuée.
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const effectuees = donnees.transactions.filter((t) => t.date.slice(0, 10) <= aujourdHui);
  const duMois = effectuees.filter((t) => t.date.slice(0, 7) === mois);
  const precedent = moisPrecedent(mois);
  const duPrecedent = effectuees.filter((t) => t.date.slice(0, 7) === precedent);

  // Dépenses planifiées dont l'échéance est passée et qui n'ont pas d'opération
  // correspondante déjà enregistrée dans l'enveloppe concernée.
  const enRetard: DepenseEnRetard[] = (donnees.budgets ?? [])
    .filter((b) => b.actif && b.prochaine.slice(0, 10) < aujourdHui)
    .map((b) => {
      const env = donnees.enveloppes.find((e) => e.id === b.enveloppeId);
      const jours = Math.max(
        0,
        Math.round(
          (Date.parse(aujourdHui) - Date.parse(b.prochaine.slice(0, 10))) / 86400000,
        ),
      );
      return {
        id: b.id,
        libelle: b.libelle,
        montant: b.montant,
        echeance: b.prochaine.slice(0, 10),
        emoji: env?.emoji ?? "🗓️",
        enveloppe: env?.nom ?? "Sans enveloppe",
        joursRetard: jours,
      };
    })
    .filter((r) => {
      // Écarte celles déjà payées : même enveloppe, même montant, depuis l'échéance.
      return !effectuees.some(
        (t) =>
          t.type === "depense" &&
          t.date.slice(0, 10) >= r.echeance &&
          Math.abs(t.montant - r.montant) < 1 &&
          (t.categorie === (donnees.budgets ?? []).find((b) => b.id === r.id)?.enveloppeId),
      );
    })
    .sort((a, b) => b.joursRetard - a.joursRetard);


  const somme = (liste: Transaction[], type: Transaction["type"]) =>
    liste.filter((t) => t.type === type).reduce((s, t) => s + t.montant, 0);

  const revenus = somme(duMois, "revenu");
  const depenses = somme(duMois, "depense");
  const depensesAvant = somme(duPrecedent, "depense");
  const net = revenus - depenses;

  const parEnveloppe = new Map<string, number>();
  for (const t of duMois) {
    if (t.type !== "depense") continue;
    parEnveloppe.set(t.categorie, (parEnveloppe.get(t.categorie) ?? 0) + t.montant);
  }

  const enveloppes: LigneEnveloppe[] = donnees.enveloppes
    .map((e) => {
      const dotation = dotationDe(e);
      const depense = parEnveloppe.get(e.id) ?? 0;
      return {
        id: e.id,
        nom: e.nom,
        emoji: e.emoji,
        dotation,
        depense,
        ecart: dotation - depense,
        depassee: depense > dotation && dotation > 0,
      };
    })
    .sort((a, b) => b.depense - a.depense);

  // Dépenses répétées : même libellé au moins trois fois dans le mois.
  const groupes = new Map<string, { libelle: string; total: number; occurrences: number }>();
  for (const t of duMois) {
    if (t.type !== "depense" || !t.libelle.trim()) continue;
    const cle = normaliser(t.libelle);
    const g = groupes.get(cle) ?? { libelle: t.libelle, total: 0, occurrences: 0 };
    g.total += t.montant;
    g.occurrences += 1;
    groupes.set(cle, g);
  }
  const fuites = [...groupes.values()]
    .filter((g) => g.occurrences >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const tauxEpargne = revenus > 0 ? (net / revenus) * 100 : 0;
  const variationDepenses =
    depensesAvant > 0 ? ((depenses - depensesAvant) / depensesAvant) * 100 : 0;

  /* Score : épargne, respect des enveloppes, régularité. */
  let score = 50;
  score += Math.max(-30, Math.min(30, tauxEpargne * 1.2));
  const depassees = enveloppes.filter((e) => e.depassee).length;
  score -= depassees * 6;
  if (net < 0) score -= 15;
  if (revenus === 0 && depenses === 0) score = 50;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const conseils: string[] = [];
  if (net < 0) {
    conseils.push(
      `Vos dépenses dépassent vos revenus de ${Math.abs(Math.round(net)).toLocaleString("fr-FR")} FCFA : réduisez le poste le plus lourd le mois prochain.`,
    );
  } else if (tauxEpargne < 10 && revenus > 0) {
    conseils.push(
      "Votre taux d'épargne est inférieur à 10 % : visez au moins un dixième de vos revenus.",
    );
  } else if (revenus > 0) {
    conseils.push(
      `Bon mois : ${Math.round(tauxEpargne)} % de vos revenus ont été mis de côté. Gardez ce rythme.`,
    );
  }
  for (const e of enveloppes.filter((x) => x.depassee).slice(0, 3)) {
    conseils.push(
      `${e.emoji} ${e.nom} a dépassé sa dotation de ${Math.abs(Math.round(e.ecart)).toLocaleString("fr-FR")} FCFA : revoyez son montant ou ses dépenses.`,
    );
  }
  if (variationDepenses > 20 && depensesAvant > 0) {
    conseils.push(
      `Vos dépenses ont augmenté de ${Math.round(variationDepenses)} % par rapport à ${libelleMois(precedent)}.`,
    );
  }
  for (const f of fuites.slice(0, 2)) {
    conseils.push(
      `« ${f.libelle} » revient ${f.occurrences} fois pour ${Math.round(f.total).toLocaleString("fr-FR")} FCFA : une petite habitude qui pèse.`,
    );
  }
  const totalEnRetard = enRetard.reduce((s, r) => s + r.montant, 0);
  if (enRetard.length > 0) {
    conseils.push(
      `${enRetard.length} dépense(s) prévue(s) non effectuée(s) pour ${Math.round(totalEnRetard).toLocaleString("fr-FR")} FCFA : leur échéance est déjà passée.`,
    );
  }
  if (conseils.length === 0) conseils.push("Rien à signaler ce mois-ci.");

  return {
    mois,
    libelleMois: libelleMois(mois),
    revenus,
    depenses,
    net,
    tauxEpargne,
    nbOperations: duMois.length,
    variationDepenses,
    enveloppes,
    plusGrossesDepenses: [...duMois]
      .filter((t) => t.type === "depense")
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 5),
    fuites,
    enRetard,
    totalEnRetard,

    detteRestante: donnees.dettes
      .filter((d) => d.sens === "dette")
      .reduce((s, d) => s + resteDu(d), 0),
    creanceRestante: donnees.dettes
      .filter((d) => d.sens === "creance")
      .reduce((s, d) => s + resteDu(d), 0),
    score,
    conseils,
  };
}

/** Version texte du rapport, pour l'export ou le partage. */
export function rapportEnTexte(r: RapportMensuel): string {
  const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
  const lignes = [
    `RAPPORT MENSUEL — ${r.libelleMois.toUpperCase()}`,
    "",
    `Revenus       : ${f(r.revenus)}`,
    `Dépenses      : ${f(r.depenses)}`,
    `Solde du mois : ${f(r.net)}`,
    `Taux d'épargne: ${Math.round(r.tauxEpargne)} %`,
    `Score         : ${r.score}/100`,
    `Opérations    : ${r.nbOperations}`,
    "",
    "ENVELOPPES",
    ...r.enveloppes.map(
      (e) => `- ${e.nom} : ${f(e.depense)} sur ${f(e.dotation)}${e.depassee ? "  (dépassée)" : ""}`,
    ),
    "",
    "PLUS GROSSES DÉPENSES",
    ...r.plusGrossesDepenses.map((t) => `- ${t.libelle} : ${f(t.montant)} (${t.date.slice(0, 10)})`),
    "",
    "CONSEILS",
    ...r.conseils.map((c) => `- ${c}`),
  ];
  return lignes.join("\n");
}
