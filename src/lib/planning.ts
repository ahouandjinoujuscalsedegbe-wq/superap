import { avancerDate } from "./periodes";
import { dotationDe } from "./enveloppe-etat";
import type { Budget, Enveloppe, Transaction } from "./store";

export const NB_SEMAINES = 14;

const JOUR_MS = 86400000;

function isoJour(d: Date): string {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant la date donnée. */
export function lundiDe(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const dec = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dec);
  return d;
}

export type Echeance = {
  budget: Budget;
  date: string;
  montant: number;
};

/** Occurrences d'un budget comprises entre deux jours (inclus). */
export function occurrencesEntre(b: Budget, debut: string, fin: string): string[] {
  if (!b.actif) return [];
  const liste: string[] = [];
  const finMs = new Date(`${fin}T23:59:59`).getTime();
  const debutMs = new Date(`${debut}T00:00:00`).getTime();
  const limite = b.fin ? new Date(`${b.fin}T23:59:59`).getTime() : Infinity;
  let date = b.prochaine;
  for (let i = 0; i < 500; i += 1) {
    const t = new Date(date).getTime();
    if (t > finMs || t > limite) break;
    if (t >= debutMs) liste.push(isoJour(new Date(date)));
    if (b.ponctuel) break;
    date = avancerDate(date, b.periode, b.intervalle);
  }
  return liste;
}

export type SemainePlanning = {
  index: number;
  debut: string;
  fin: string;
  libelle: string;
  echeances: Echeance[];
  depensesPrevues: number;
  depensesReelles: number;
  revenusReels: number;
  revenusAttendus: number;
  /** Solde de trésorerie projeté à la fin de la semaine. */
  soldeProjete: number;
  passee: boolean;
  courante: boolean;
  risque: boolean;
};

export type AlerteEnveloppe = {
  enveloppe: Enveloppe;
  semaine: number;
  debut: string;
  message: string;
};

export type Planning = {
  semaines: SemainePlanning[];
  totalPrevu: number;
  totalRevenus: number;
  revenuHebdoMoyen: number;
  soldeFinal: number;
  alertes: AlerteEnveloppe[];
  semainesRisque: number[];
};

/** Revenu hebdomadaire moyen observé sur les 12 dernières semaines. */
export function revenuHebdoMoyen(transactions: Transaction[], maintenant = new Date()): number {
  const depuis = maintenant.getTime() - 12 * 7 * JOUR_MS;
  const total = transactions
    .filter((t) => t.type === "revenu" && new Date(t.date).getTime() >= depuis)
    .reduce((s, t) => s + t.montant, 0);
  return total / 12;
}

export function construirePlanning(params: {
  budgets: Budget[];
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
  soldeActuel: number;
  maintenant?: Date;
}): Planning {
  const maintenant = params.maintenant ?? new Date();
  const moyenne = revenuHebdoMoyen(params.transactions, maintenant);
  const depart = lundiDe(maintenant);
  const semaines: SemainePlanning[] = [];
  let solde = params.soldeActuel;

  // Consommation projetée de chaque enveloppe, cumulée semaine après semaine.
  const consommation: Record<string, number> = { ...params.depensesParEnveloppe };
  const alertes: AlerteEnveloppe[] = [];
  const dejaAlertee = new Set<string>();

  for (let i = 0; i < NB_SEMAINES; i += 1) {
    const d = new Date(depart.getTime() + i * 7 * JOUR_MS);
    const f = new Date(d.getTime() + 6 * JOUR_MS);
    const debut = isoJour(d);
    const fin = isoJour(f);

    const echeances: Echeance[] = [];
    for (const b of params.budgets) {
      for (const date of occurrencesEntre(b, debut, fin)) {
        echeances.push({ budget: b, date, montant: b.montant });
      }
    }
    echeances.sort((a, z) => a.date.localeCompare(z.date));

    const depensesPrevues = echeances.reduce((s, e) => s + e.montant, 0);

    const dansSemaine = (t: Transaction) => {
      const j = t.date.slice(0, 10);
      return j >= debut && j <= fin;
    };
    const depensesReelles = params.transactions
      .filter((t) => t.type === "depense" && dansSemaine(t))
      .reduce((s, t) => s + t.montant, 0);
    const revenusReels = params.transactions
      .filter((t) => t.type === "revenu" && dansSemaine(t))
      .reduce((s, t) => s + t.montant, 0);

    const courante = i === 0;
    const revenusAttendus = revenusReels > 0 ? revenusReels : Math.round(moyenne);

    solde = solde + revenusAttendus - depensesPrevues;

    // Projection de la consommation des enveloppes.
    for (const e of echeances) {
      const id = e.budget.enveloppeId;
      consommation[id] = (consommation[id] ?? 0) + e.montant;
      const env = params.enveloppes.find((x) => x.id === id);
      if (!env || dejaAlertee.has(id)) continue;
      const dot = dotationDe(env);
      if (consommation[id] > dot) {
        dejaAlertee.add(id);
        alertes.push({
          enveloppe: env,
          semaine: i + 1,
          debut,
          message: `Dotation épuisée : ${Math.round(consommation[id])} FCFA prévus pour une dotation de ${Math.round(dot)} FCFA.`,
        });
      } else if (env.plafond > 0 && consommation[id] > env.plafond) {
        dejaAlertee.add(id);
        alertes.push({
          enveloppe: env,
          semaine: i + 1,
          debut,
          message: `Plafond dépassé : ${Math.round(consommation[id])} FCFA prévus pour un plafond de ${Math.round(env.plafond)} FCFA.`,
        });
      }
    }

    semaines.push({
      index: i + 1,
      debut,
      fin,
      libelle: `S${i + 1}`,
      echeances,
      depensesPrevues,
      depensesReelles,
      revenusReels,
      revenusAttendus,
      soldeProjete: solde,
      passee: false,
      courante,
      risque: solde < 0 || depensesPrevues > revenusAttendus * 1.5,
    });
  }

  return {
    semaines,
    totalPrevu: semaines.reduce((s, x) => s + x.depensesPrevues, 0),
    totalRevenus: semaines.reduce((s, x) => s + x.revenusAttendus, 0),
    revenuHebdoMoyen: moyenne,
    soldeFinal: solde,
    alertes,
    semainesRisque: semaines.filter((s) => s.risque).map((s) => s.index),
  };
}
