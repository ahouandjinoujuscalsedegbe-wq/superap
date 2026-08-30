import { avancerDate } from "./periodes";
import { dotationDe } from "./enveloppe-etat";
import type { Budget, Enveloppe, Transaction } from "./store";

export const NB_SEMAINES = 14;
export const HORIZONS = [7, 14, 26] as const;
export type Horizon = (typeof HORIZONS)[number];

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

/** Revenu exceptionnel planifié manuellement dans le planning. */
export type RevenuPrevu = {
  id: string;
  libelle: string;
  montant: number;
  date: string;
  compte?: string;
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
  revenusPrevus: RevenuPrevu[];
  depensesPrevues: number;
  depensesReelles: number;
  revenusReels: number;
  revenusAttendus: number;
  /** Solde de trésorerie projeté à la fin de la semaine. */
  soldeProjete: number;
  /** Écart en % entre dépenses réelles et dépenses prévues (semaines passées). */
  ecartDepenses: number | null;
  /** Écart en % entre revenus réels et revenus attendus (semaines passées). */
  ecartRevenus: number | null;
  suggestions: string[];
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
  semainesPassees: SemainePlanning[];
  totalPrevu: number;
  totalRevenus: number;
  revenuHebdoMoyen: number;
  soldeFinal: number;
  alertes: AlerteEnveloppe[];
  semainesRisque: number[];
  /** Fiabilité des prévisions passées : écart moyen absolu en %. */
  fiabilite: number | null;
};

/** Revenu hebdomadaire moyen observé sur les 12 dernières semaines. */
export function revenuHebdoMoyen(transactions: Transaction[], maintenant = new Date()): number {
  const depuis = maintenant.getTime() - 12 * 7 * JOUR_MS;
  const total = transactions
    .filter((t) => t.type === "revenu" && new Date(t.date).getTime() >= depuis)
    .reduce((s, t) => s + t.montant, 0);
  return total / 12;
}

export type OptionsPlanning = {
  budgets: Budget[];
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  depensesParEnveloppe: Record<string, number>;
  soldeActuel: number;
  maintenant?: Date | undefined;
  /** Nombre de semaines projetées (7, 14 ou 26). */
  nbSemaines?: number | undefined;
  /** Date de départ du planning (par défaut aujourd'hui). */
  depart?: string | undefined;
  /** N'afficher que les échéances d'une enveloppe donnée. */
  filtreEnveloppeId?: string | null | undefined;
  /** Revenus exceptionnels planifiés manuellement. */
  revenusPrevus?: RevenuPrevu[] | undefined;
  /** Nombre de semaines passées à analyser (réel vs projeté). */
  nbSemainesPassees?: number | undefined;
};

export function construirePlanning(params: OptionsPlanning): Planning {
  const maintenant = params.maintenant ?? new Date();
  const nb = params.nbSemaines ?? NB_SEMAINES;
  const nbPassees = params.nbSemainesPassees ?? 4;
  const moyenne = revenuHebdoMoyen(params.transactions, maintenant);
  const base = params.depart ? new Date(`${params.depart}T12:00:00`) : maintenant;
  const depart = lundiDe(base);
  const revenusPrevus = params.revenusPrevus ?? [];

  const budgets = params.filtreEnveloppeId
    ? params.budgets.filter((b) => b.enveloppeId === params.filtreEnveloppeId)
    : params.budgets;

  const consommation: Record<string, number> = { ...params.depensesParEnveloppe };
  const alertes: AlerteEnveloppe[] = [];
  const dejaAlertee = new Set<string>();

  function bornes(offset: number): { debut: string; fin: string; d: Date; f: Date } {
    const d = new Date(depart.getTime() + offset * 7 * JOUR_MS);
    const f = new Date(d.getTime() + 6 * JOUR_MS);
    return { d, f, debut: isoJour(d), fin: isoJour(f) };
  }

  function reels(debut: string, fin: string) {
    const dans = (t: Transaction) => {
      const j = t.date.slice(0, 10);
      return j >= debut && j <= fin;
    };
    const depensesReelles = params.transactions
      .filter((t) => t.type === "depense" && dans(t))
      .reduce((s, t) => s + t.montant, 0);
    const revenusReels = params.transactions
      .filter((t) => t.type === "revenu" && dans(t))
      .reduce((s, t) => s + t.montant, 0);
    return { depensesReelles, revenusReels };
  }

  function echeancesDe(debut: string, fin: string): Echeance[] {
    const liste: Echeance[] = [];
    for (const b of budgets) {
      for (const date of occurrencesEntre(b, debut, fin)) {
        liste.push({ budget: b, date, montant: b.montant });
      }
    }
    liste.sort((a, z) => a.date.localeCompare(z.date));
    return liste;
  }

  // --- Semaines passées : réel vs projeté -----------------------------------
  const semainesPassees: SemainePlanning[] = [];
  for (let k = nbPassees; k >= 1; k -= 1) {
    const { debut, fin } = bornes(-k);
    const echeances = echeancesDe(debut, fin);
    const depensesPrevues = echeances.reduce((s, e) => s + e.montant, 0);
    const { depensesReelles, revenusReels } = reels(debut, fin);
    const revenusAttendus = Math.round(moyenne);
    semainesPassees.push({
      index: -k,
      debut,
      fin,
      libelle: `S-${k}`,
      echeances,
      revenusPrevus: [],
      depensesPrevues,
      depensesReelles,
      revenusReels,
      revenusAttendus,
      soldeProjete: 0,
      ecartDepenses:
        depensesPrevues > 0
          ? Math.round(((depensesReelles - depensesPrevues) / depensesPrevues) * 100)
          : null,
      ecartRevenus:
        revenusAttendus > 0
          ? Math.round(((revenusReels - revenusAttendus) / revenusAttendus) * 100)
          : null,
      suggestions: [],
      passee: true,
      courante: false,
      risque: false,
    });
  }

  const ecarts = semainesPassees
    .map((s) => s.ecartDepenses)
    .filter((x): x is number => x !== null)
    .map(Math.abs);
  const fiabilite = ecarts.length
    ? Math.round(ecarts.reduce((a, b) => a + b, 0) / ecarts.length)
    : null;

  // --- Semaines à venir ------------------------------------------------------
  const semaines: SemainePlanning[] = [];
  let solde = params.soldeActuel;

  for (let i = 0; i < nb; i += 1) {
    const { debut, fin } = bornes(i);
    const echeances = echeancesDe(debut, fin);
    const depensesPrevues = echeances.reduce((s, e) => s + e.montant, 0);
    const { depensesReelles, revenusReels } = reels(debut, fin);

    const exceptionnels = revenusPrevus.filter((r) => r.date >= debut && r.date <= fin);
    const sommeExceptionnels = exceptionnels.reduce((s, r) => s + r.montant, 0);

    const courante = i === 0;
    const revenusAttendus =
      (revenusReels > 0 ? revenusReels : Math.round(moyenne)) + sommeExceptionnels;

    solde = solde + revenusAttendus - depensesPrevues;

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

    const risque = solde < 0 || depensesPrevues > revenusAttendus * 1.5;
    const suggestions: string[] = [];
    if (risque) {
      const manque =
        solde < 0 ? Math.abs(solde) : depensesPrevues - Math.round(revenusAttendus * 1.5);
      suggestions.push(`Réduire ou reporter ${Math.round(manque)} FCFA de dépenses cette semaine.`);
      const plusGrosse = [...echeances].sort((a, z) => z.montant - a.montant)[0];
      if (plusGrosse) {
        suggestions.push(
          `Reporter « ${plusGrosse.budget.libelle} » (${Math.round(plusGrosse.montant)} FCFA) à une semaine suivante.`,
        );
      }
      suggestions.push(
        `Ajouter un revenu exceptionnel d'au moins ${Math.round(manque)} FCFA ou puiser dans la réserve.`,
      );
    }

    semaines.push({
      index: i + 1,
      debut,
      fin,
      libelle: `S${i + 1}`,
      echeances,
      revenusPrevus: exceptionnels,
      depensesPrevues,
      depensesReelles,
      revenusReels,
      revenusAttendus,
      soldeProjete: solde,
      ecartDepenses: null,
      ecartRevenus: null,
      suggestions,
      passee: false,
      courante,
      risque,
    });
  }

  return {
    semaines,
    semainesPassees,
    totalPrevu: semaines.reduce((s, x) => s + x.depensesPrevues, 0),
    totalRevenus: semaines.reduce((s, x) => s + x.revenusAttendus, 0),
    revenuHebdoMoyen: moyenne,
    soldeFinal: solde,
    alertes,
    semainesRisque: semaines.filter((s) => s.risque).map((s) => s.index),
    fiabilite,
  };
}

// --- Revenus exceptionnels : persistance locale -----------------------------

const CLE_REVENUS = "superapp:planning:revenus:v1";
const CLE_PREFS = "superapp:planning:prefs:v1";

export function lireRevenusPrevus(): RevenuPrevu[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE_REVENUS);
    const liste = brut ? (JSON.parse(brut) as RevenuPrevu[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

export function ecrireRevenusPrevus(liste: RevenuPrevu[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_REVENUS, JSON.stringify(liste));
  } catch {
    /* stockage indisponible */
  }
}

export type PrefsPlanning = {
  horizon: number;
  condense: boolean;
  depart: string | null;
  filtreEnveloppeId: string | null;
};

export const PREFS_DEFAUT: PrefsPlanning = {
  horizon: NB_SEMAINES,
  condense: false,
  depart: null,
  filtreEnveloppeId: null,
};

export function lirePrefsPlanning(): PrefsPlanning {
  if (typeof window === "undefined") return PREFS_DEFAUT;
  try {
    const brut = window.localStorage.getItem(CLE_PREFS);
    if (!brut) return PREFS_DEFAUT;
    return { ...PREFS_DEFAUT, ...(JSON.parse(brut) as Partial<PrefsPlanning>) };
  } catch {
    return PREFS_DEFAUT;
  }
}

export function ecrirePrefsPlanning(p: PrefsPlanning): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLE_PREFS, JSON.stringify(p));
  } catch {
    /* stockage indisponible */
  }
}

// --- Export du planning ------------------------------------------------------

export function planningEnTexte(p: Planning): string {
  const lignes = [
    `PLANNING SUR ${p.semaines.length} SEMAINES`,
    `Dépenses prévues : ${Math.round(p.totalPrevu)} FCFA`,
    `Revenus attendus : ${Math.round(p.totalRevenus)} FCFA`,
    `Solde projeté final : ${Math.round(p.soldeFinal)} FCFA`,
    "",
  ];
  for (const s of p.semaines) {
    lignes.push(
      `${s.libelle} (${s.debut} → ${s.fin}) · prévu ${Math.round(s.depensesPrevues)} · revenus ${Math.round(s.revenusAttendus)} · solde ${Math.round(s.soldeProjete)}${s.risque ? " ⚠ à risque" : ""}`,
    );
    for (const e of s.echeances) {
      lignes.push(`   - ${e.date} · ${e.budget.libelle} · ${Math.round(e.montant)} FCFA`);
    }
  }
  if (p.alertes.length) {
    lignes.push("", "ALERTES ENVELOPPES");
    for (const a of p.alertes) {
      lignes.push(`   - ${a.enveloppe.nom} (S${a.semaine}) : ${a.message}`);
    }
  }
  return lignes.join("\n");
}

export function planningEnCsv(p: Planning): string {
  const entete = "semaine;debut;fin;depenses_prevues;revenus_attendus;solde_projete;risque";
  const lignes = p.semaines.map((s) =>
    [
      s.libelle,
      s.debut,
      s.fin,
      Math.round(s.depensesPrevues),
      Math.round(s.revenusAttendus),
      Math.round(s.soldeProjete),
      s.risque ? "oui" : "non",
    ].join(";"),
  );
  return [entete, ...lignes].join("\n");
}
