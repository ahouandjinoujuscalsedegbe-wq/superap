/**
 * Saisonnalité locale : l'application compare chaque mois à la même période
 * des années précédentes (climat et habitudes ouest-africaines), en déduit un
 * coefficient de saison par enveloppe et projette les mois à venir.
 *
 * Tout est calculé sur l'appareil, sans réseau.
 */

import type { Enveloppe, Transaction } from "./store";

export const MOIS_FR = [
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

/** Saison ouest-africaine du mois donné (0 = janvier). */
export function saisonDe(moisIndex: number): string {
  const m = ((moisIndex % 12) + 12) % 12;
  if ([10, 11, 0, 1, 2].includes(m)) return "grande saison sèche (harmattan, fêtes)";
  if ([3, 4, 5, 6].includes(m)) return "grande saison des pluies (travaux agricoles)";
  if ([7, 8].includes(m)) return "petite saison sèche (rentrée scolaire)";
  return "petite saison des pluies";
}

/** Repères de dépense propres à chaque saison, pour des conseils concrets. */
export function reperesSaison(moisIndex: number): string[] {
  const m = ((moisIndex % 12) + 12) % 12;
  if ([10, 11, 0].includes(m))
    return ["fêtes de fin d'année", "cadeaux et réceptions", "voyages en famille"];
  if ([1, 2].includes(m)) return ["chaleur et eau", "frais scolaires du 2e trimestre"];
  if ([3, 4, 5, 6].includes(m))
    return ["pluies et transports", "santé (paludisme)", "semences et travaux"];
  if ([7, 8].includes(m))
    return ["rentrée scolaire", "fournitures et uniformes", "frais d'inscription"];
  return ["fin des récoltes", "réparations de la maison"];
}

function moisDe(iso: string): { an: number; mois: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { an: d.getFullYear(), mois: d.getMonth() };
}

function depensesDuMois(
  transactions: Transaction[],
  an: number,
  mois: number,
  nomEnveloppe?: string,
): number {
  return transactions
    .filter((t) => {
      if (t.type !== "depense") return false;
      if (nomEnveloppe && t.categorie !== nomEnveloppe) return false;
      const d = moisDe(t.date);
      return !!d && d.an === an && d.mois === mois;
    })
    .reduce((s, t) => s + Math.abs(t.montant), 0);
}

/** Moyenne mensuelle des dépenses des années strictement antérieures. */
function moyenneMensuelleHistorique(
  transactions: Transaction[],
  anneeCourante: number,
  nomEnveloppe?: string,
): number {
  const paniers = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    if (nomEnveloppe && t.categorie !== nomEnveloppe) continue;
    const d = moisDe(t.date);
    if (!d || d.an >= anneeCourante) continue;
    const cle = `${d.an}-${d.mois}`;
    paniers.set(cle, (paniers.get(cle) ?? 0) + Math.abs(t.montant));
  }
  if (paniers.size === 0) return 0;
  let total = 0;
  for (const v of paniers.values()) total += v;
  return total / paniers.size;
}

/** Moyenne des dépenses du même mois des années précédentes. */
export function moyenneMemeMois(
  transactions: Transaction[],
  anneeCourante: number,
  mois: number,
  nomEnveloppe?: string,
): number {
  const parAnnee = new Map<number, number>();
  for (const t of transactions) {
    if (t.type !== "depense") continue;
    if (nomEnveloppe && t.categorie !== nomEnveloppe) continue;
    const d = moisDe(t.date);
    if (!d || d.mois !== mois || d.an >= anneeCourante) continue;
    parAnnee.set(d.an, (parAnnee.get(d.an) ?? 0) + Math.abs(t.montant));
  }
  if (parAnnee.size === 0) return 0;
  let total = 0;
  for (const v of parAnnee.values()) total += v;
  return Math.round(total / parAnnee.size);
}

const COEF_MIN = 0.7;
const COEF_MAX = 1.4;

/**
 * Coefficient de saison : dépenses habituelles de ce mois rapportées à la
 * dépense mensuelle moyenne. 1 quand l'historique manque, borné à ±40 %.
 */
export function coefficientSaison(
  transactions: Transaction[],
  mois: number,
  anneeCourante: number,
  nomEnveloppe?: string,
): number {
  const memeMois = moyenneMemeMois(transactions, anneeCourante, mois, nomEnveloppe);
  const moyenne = moyenneMensuelleHistorique(transactions, anneeCourante, nomEnveloppe);
  if (!(memeMois > 0) || !(moyenne > 0)) return 1;
  return Math.min(COEF_MAX, Math.max(COEF_MIN, memeMois / moyenne));
}

/** Coefficient de saison d'une enveloppe pour un mois donné. */
export function coefficientSaisonEnveloppe(
  enveloppe: Enveloppe,
  transactions: Transaction[],
  date: string | Date,
): number {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 1;
  const propre = coefficientSaison(transactions, d.getMonth(), d.getFullYear(), enveloppe.nom);
  if (propre !== 1) return propre;
  // Sans historique sur l'enveloppe, on suit la saison du budget global.
  return coefficientSaison(transactions, d.getMonth(), d.getFullYear());
}

export type LigneSaisonEnveloppe = {
  id: string;
  nom: string;
  emoji: string;
  actuel: number;
  anneePrecedente: number;
  ecart: number;
  ecartPct: number;
  coefficient: number;
};

export type BilanSaisonnier = {
  mois: string;
  saison: string;
  reperes: string[];
  depenses: number;
  depensesAnneePrecedente: number;
  revenus: number;
  revenusAnneePrecedente: number;
  ecart: number;
  ecartPct: number;
  coefficient: number;
  historique: boolean;
  enveloppes: LigneSaisonEnveloppe[];
  conseils: string[];
};

function fcfa(m: number): string {
  return `${Math.round(m).toLocaleString("fr-FR")} FCFA`;
}

/**
 * Bilan saisonnier : le mois en cours face au même mois de l'année passée,
 * enveloppe par enveloppe, avec des conseils adaptés à la saison.
 */
export function bilanSaisonnier(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  maintenant = new Date(),
): BilanSaisonnier {
  const an = maintenant.getFullYear();
  const mois = maintenant.getMonth();

  const depenses = depensesDuMois(transactions, an, mois);
  const depensesAnneePrecedente = depensesDuMois(transactions, an - 1, mois);
  const revenus = transactions
    .filter((t) => {
      const d = moisDe(t.date);
      return t.type === "revenu" && !!d && d.an === an && d.mois === mois;
    })
    .reduce((s, t) => s + Math.abs(t.montant), 0);
  const revenusAnneePrecedente = transactions
    .filter((t) => {
      const d = moisDe(t.date);
      return t.type === "revenu" && !!d && d.an === an - 1 && d.mois === mois;
    })
    .reduce((s, t) => s + Math.abs(t.montant), 0);

  const ecart = depenses - depensesAnneePrecedente;
  const ecartPct =
    depensesAnneePrecedente > 0 ? Math.round((ecart / depensesAnneePrecedente) * 100) : 0;

  const lignes: LigneSaisonEnveloppe[] = enveloppes
    .map((e) => {
      const actuel = depensesDuMois(transactions, an, mois, e.nom);
      const precedent = depensesDuMois(transactions, an - 1, mois, e.nom);
      const diff = actuel - precedent;
      return {
        id: e.id,
        nom: e.nom,
        emoji: e.emoji,
        actuel,
        anneePrecedente: precedent,
        ecart: diff,
        ecartPct: precedent > 0 ? Math.round((diff / precedent) * 100) : 0,
        coefficient: coefficientSaisonEnveloppe(e, transactions, maintenant),
      };
    })
    .filter((l) => l.actuel > 0 || l.anneePrecedente > 0 || l.coefficient !== 1)
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
    .slice(0, 6);

  const saison = saisonDe(mois);
  const reperes = reperesSaison(mois);
  const coefficient = coefficientSaison(transactions, mois, an);
  const historique = depensesAnneePrecedente > 0;

  const conseils: string[] = [];
  if (!historique) {
    conseils.push(
      `Première ${MOIS_FR[mois]} suivie dans l'application : je mémorise vos chiffres pour comparer l'an prochain.`,
    );
  } else if (ecart > 0) {
    conseils.push(
      `Vous dépensez ${fcfa(Math.abs(ecart))} de plus (${ecartPct} %) qu'en ${MOIS_FR[mois]} ${an - 1}. Freinez d'abord les postes ci-dessous.`,
    );
  } else if (ecart < 0) {
    conseils.push(
      `Vous dépensez ${fcfa(Math.abs(ecart))} de moins (${ecartPct} %) qu'en ${MOIS_FR[mois]} ${an - 1}. Mettez cette économie en épargne avant qu'elle ne se dilue.`,
    );
  } else {
    conseils.push(`Vous êtes au même niveau qu'en ${MOIS_FR[mois]} ${an - 1}.`);
  }
  if (coefficient > 1.05)
    conseils.push(
      `${MOIS_FR[mois]} est un mois chargé pour vous (+${Math.round((coefficient - 1) * 100)} % par rapport à un mois ordinaire) : ${reperes.join(", ")}. Renforcez ces enveloppes dès le début du mois.`,
    );
  else if (coefficient < 0.95)
    conseils.push(
      `${MOIS_FR[mois]} est un mois calme (${Math.round((coefficient - 1) * 100)} % par rapport à un mois ordinaire) : profitez-en pour épargner ou avancer sur vos dettes.`,
    );
  else conseils.push(`Nous sommes en ${saison} : surveillez ${reperes.join(", ")}.`);

  const forte = lignes.find((l) => l.ecart > 0 && l.anneePrecedente > 0);
  if (forte)
    conseils.push(
      `${forte.emoji} ${forte.nom} pèse ${fcfa(forte.ecart)} de plus que l'an dernier à la même période : plafonnez-la ce mois-ci.`,
    );
  if (revenusAnneePrecedente > 0 && revenus < revenusAnneePrecedente)
    conseils.push(
      `Vos revenus de saison sont inférieurs de ${fcfa(revenusAnneePrecedente - revenus)} à l'an dernier : ajustez vos renouvellements en conséquence.`,
    );

  return {
    mois: `${MOIS_FR[mois]} ${an}`,
    saison,
    reperes,
    depenses,
    depensesAnneePrecedente,
    revenus,
    revenusAnneePrecedente,
    ecart,
    ecartPct,
    coefficient,
    historique,
    enveloppes: lignes,
    conseils,
  };
}

export type MoisProjete = {
  cle: string; // AAAA-MM
  libelle: string;
  saison: string;
  coefficient: number;
  revenus: number;
  depenses: number;
  solde: number;
  soldeCumule: number;
  conseil: string;
};

/**
 * Projette le bilan mensuel vers l'avant en appliquant, mois par mois, le
 * coefficient de saison appris sur l'historique.
 */
export function projectionSaisonniere(
  transactions: Transaction[],
  soldeActuel: number,
  nbMois = 6,
  maintenant = new Date(),
): MoisProjete[] {
  const an = maintenant.getFullYear();
  const moisCourant = maintenant.getMonth();

  /* Base : moyenne des 6 derniers mois réellement observés. */
  let totalDep = 0;
  let totalRev = 0;
  let moisObserves = 0;
  for (let i = 1; i <= 6; i += 1) {
    const ref = new Date(an, moisCourant - i, 1);
    const dep = depensesDuMois(transactions, ref.getFullYear(), ref.getMonth());
    const rev = transactions
      .filter((t) => {
        const d = moisDe(t.date);
        return (
          t.type === "revenu" && !!d && d.an === ref.getFullYear() && d.mois === ref.getMonth()
        );
      })
      .reduce((s, t) => s + Math.abs(t.montant), 0);
    if (dep > 0 || rev > 0) {
      totalDep += dep;
      totalRev += rev;
      moisObserves += 1;
    }
  }
  const baseDepenses = moisObserves > 0 ? totalDep / moisObserves : 0;
  const baseRevenus = moisObserves > 0 ? totalRev / moisObserves : 0;

  const sortie: MoisProjete[] = [];
  let cumul = soldeActuel;
  for (let i = 1; i <= nbMois; i += 1) {
    const ref = new Date(an, moisCourant + i, 1);
    const m = ref.getMonth();
    const coefficient = coefficientSaison(transactions, m, an);
    const depenses = Math.round(baseDepenses * coefficient);
    const revenus = Math.round(baseRevenus);
    const solde = revenus - depenses;
    cumul += solde;
    const reperes = reperesSaison(m);
    const conseil =
      baseDepenses === 0
        ? "Pas encore assez d'historique : la projection s'affinera avec vos prochaines saisies."
        : coefficient > 1.05
          ? `Mois chargé (${reperes.join(", ")}) : mettez ${fcfa(Math.round(baseDepenses * (coefficient - 1)))} de côté dès maintenant.`
          : coefficient < 0.95
            ? `Mois calme : profitez-en pour épargner environ ${fcfa(Math.round(baseDepenses * (1 - coefficient)))}.`
            : solde < 0
              ? `Mois à l'équilibre fragile : réduisez de ${fcfa(Math.abs(solde))} pour rester positif.`
              : "Mois ordinaire : gardez le rythme actuel.";
    sortie.push({
      cle: `${ref.getFullYear()}-${String(m + 1).padStart(2, "0")}`,
      libelle: `${MOIS_FR[m]} ${ref.getFullYear()}`,
      saison: saisonDe(m),
      coefficient,
      revenus,
      depenses,
      solde,
      soldeCumule: Math.round(cumul),
      conseil,
    });
  }
  return sortie;
}

/** Texte prêt à être lu à voix haute pour le bilan saisonnier. */
export function texteBilanSaisonnier(b: BilanSaisonnier): string {
  return [
    `Bilan saisonnier de ${b.mois}, ${b.saison}.`,
    `Dépenses du mois : ${fcfa(b.depenses)}, contre ${fcfa(b.depensesAnneePrecedente)} à la même période l'an dernier.`,
    ...b.conseils,
  ].join(" ");
}

/** Texte prêt à être lu à voix haute pour la projection. */
export function texteProjection(mois: MoisProjete[]): string {
  if (mois.length === 0) return "Aucune projection disponible pour le moment.";
  return [
    "Projection des prochains mois.",
    ...mois.map(
      (m) =>
        `${m.libelle}, ${m.saison} : ${fcfa(m.revenus)} de revenus, ${fcfa(m.depenses)} de dépenses, solde ${fcfa(m.solde)}. ${m.conseil}`,
    ),
  ].join(" ");
}
