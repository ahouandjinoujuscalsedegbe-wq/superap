/**
 * Alarme intelligente 100 % locale.
 *
 * - Rappels sonores des dépenses planifiées dans la Budgétisation.
 * - Alarmes prédictives : enveloppes bientôt vides, risque de découvert.
 * - Aucun réseau : tout est calculé sur l'appareil à partir des données
 *   validées par l'utilisateur.
 */

import type { Budget, Enveloppe, Transaction } from "./store";
import { previsionEnveloppes } from "./analyste-local";
import { risqueDecouvert } from "./ia-locale";

const JOUR_MS = 86_400_000;
const CLE_REGLAGES = "SA_ALARME_REGLAGES_V1";
const CLE_REPORTS = "SA_ALARME_REPORTS_V1";

export type ReglagesAlarme = {
  /** Alarme activée globalement. */
  active: boolean;
  /** Son activé (sinon simple notification visuelle). */
  son: boolean;
  /** Volume de 0 à 100. */
  volume: number;
  /** Nombre de jours d'avance pour prévenir d'une dépense planifiée. */
  avanceJours: number;
  /** Alarmes prédictives (épuisement, découvert). */
  predictions: boolean;
};

export const REGLAGES_ALARME_DEFAUT: ReglagesAlarme = {
  active: true,
  son: true,
  volume: 70,
  avanceJours: 2,
  predictions: true,
};

export function lireReglagesAlarme(): ReglagesAlarme {
  if (typeof localStorage === "undefined") return REGLAGES_ALARME_DEFAUT;
  try {
    const brut = localStorage.getItem(CLE_REGLAGES);
    if (!brut) return REGLAGES_ALARME_DEFAUT;
    const objet = JSON.parse(brut) as Partial<ReglagesAlarme>;
    return {
      active: objet.active ?? true,
      son: objet.son ?? true,
      volume: Math.min(100, Math.max(0, Number(objet.volume ?? 70))),
      avanceJours: Math.min(15, Math.max(0, Number(objet.avanceJours ?? 2))),
      predictions: objet.predictions ?? true,
    };
  } catch {
    return REGLAGES_ALARME_DEFAUT;
  }
}

export function ecrireReglagesAlarme(r: ReglagesAlarme) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(r));
  } catch {
    /* stockage plein : les réglages restent ceux de la session */
  }
}

// ------------------------------------------------------------------ reports

type Reports = Record<string, number>;

function lireReports(): Reports {
  if (typeof localStorage === "undefined") return {};
  try {
    const brut = localStorage.getItem(CLE_REPORTS);
    const objet: unknown = brut ? JSON.parse(brut) : {};
    if (!objet || typeof objet !== "object") return {};
    const maintenant = Date.now();
    const propre: Reports = {};
    for (const [id, fin] of Object.entries(objet as Reports)) {
      if (typeof fin === "number" && fin > maintenant) propre[id] = fin;
    }
    return propre;
  } catch {
    return {};
  }
}

/** Met une alarme en veille pendant un certain nombre d'heures. */
export function reporterAlarme(id: string, heures = 6) {
  if (typeof localStorage === "undefined") return;
  const reports = lireReports();
  reports[id] = Date.now() + heures * 3_600_000;
  try {
    localStorage.setItem(CLE_REPORTS, JSON.stringify(reports));
  } catch {
    /* ignoré */
  }
}

function estReportee(id: string, reports: Reports): boolean {
  const fin = reports[id];
  return typeof fin === "number" && fin > Date.now();
}

// ------------------------------------------------------------------ alarmes

export type Alarme = {
  id: string;
  type: "echeance" | "prediction";
  niveau: "alerte" | "attention" | "info";
  titre: string;
  texte: string;
  /** Date concernée au format AAAA-MM-JJ, si applicable. */
  date?: string;
};

function jour(iso: string): string {
  return iso.slice(0, 10);
}

function ajouterJours(base: Date, n: number): string {
  return new Date(base.getTime() + n * JOUR_MS).toISOString().slice(0, 10);
}

function fcfa(v: number): string {
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

/** Rappels des dépenses planifiées dues ou imminentes. */
export function alarmesEcheances(
  budgets: Budget[],
  enveloppes: Enveloppe[],
  avanceJours: number,
  maintenant = new Date(),
): Alarme[] {
  const aujourdHui = maintenant.toISOString().slice(0, 10);
  const limite = ajouterJours(maintenant, avanceJours);

  return budgets
    .filter((b) => b.actif && b.prochaine && jour(b.prochaine) <= limite)
    .map((b) => {
      const env = enveloppes.find((e) => e.id === b.enveloppeId);
      const date = jour(b.prochaine);
      const enRetard = date < aujourdHui;
      const aujourd = date === aujourdHui;
      const quand = enRetard
        ? "en retard depuis le"
        : aujourd
          ? "à effectuer aujourd'hui,"
          : "prévue le";
      return {
        id: `echeance-${b.id}-${date}`,
        type: "echeance" as const,
        niveau: enRetard || aujourd ? ("alerte" as const) : ("attention" as const),
        titre: `${env ? `${env.emoji} ` : "📌 "}${b.libelle}`,
        texte: `Dépense planifiée de ${fcfa(b.montant)} ${quand} ${date}${
          env ? ` — enveloppe ${env.nom}` : ""
        }.`,
        date,
      };
    })
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

/** Alarmes prédictives : ce qui risque d'arriver dans les prochains jours. */
export function alarmesPredictives(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  solde: number,
): Alarme[] {
  const alarmes: Alarme[] = [];

  for (const p of previsionEnveloppes(enveloppes, transactions)) {
    if (p.niveau === "bon") continue;
    if (p.restant <= 0) {
      alarmes.push({
        id: `prev-vide-${p.enveloppe.id}`,
        type: "prediction",
        niveau: "alerte",
        titre: `${p.enveloppe.emoji} ${p.enveloppe.nom} épuisée`,
        texte: "Cette enveloppe n'a plus de disponible : réapprovisionnez-la ou stoppez les dépenses.",
      });
    } else if (p.joursAvantEpuisement !== null && p.joursAvantEpuisement <= 15) {
      alarmes.push({
        id: `prev-env-${p.enveloppe.id}-${p.joursAvantEpuisement}`,
        type: "prediction",
        niveau: p.joursAvantEpuisement <= 7 ? "alerte" : "attention",
        titre: `${p.enveloppe.emoji} ${p.enveloppe.nom} bientôt vide`,
        texte: `Au rythme de ${fcfa(p.rythmeJour)}/jour, il reste environ ${p.joursAvantEpuisement} jour(s)${
          p.dateEpuisement ? ` (vers le ${p.dateEpuisement})` : ""
        }.`,
        ...(p.dateEpuisement ? { date: p.dateEpuisement } : {}),
      });
    }
  }

  if (transactions.length >= 5) {
    const risque = risqueDecouvert(transactions, solde, 30);
    if (risque.niveau !== "bon") {
      alarmes.push({
        id: `prev-decouvert-${risque.niveau}-${risque.jourMedian ?? "x"}`,
        type: "prediction",
        niveau: risque.niveau === "alerte" ? "alerte" : "attention",
        titre: "Risque de solde négatif",
        texte: `${risque.probabilite}% de risque de passer sous zéro d'ici 30 jours${
          risque.jourMedian ? `, vers le jour ${risque.jourMedian}` : ""
        }. Solde médian estimé : ${fcfa(risque.soldeMedian)}.`,
      });
    }
  }

  return alarmes;
}

/** Toutes les alarmes actives, hors celles mises en veille par l'utilisateur. */
export function calculerAlarmes(
  donnees: {
    budgets: Budget[];
    enveloppes: Enveloppe[];
    transactions: Transaction[];
    solde: number;
  },
  reglages: ReglagesAlarme,
): Alarme[] {
  if (!reglages.active) return [];
  const reports = lireReports();
  const liste = [
    ...alarmesEcheances(donnees.budgets, donnees.enveloppes, reglages.avanceJours),
    ...(reglages.predictions
      ? alarmesPredictives(donnees.enveloppes, donnees.transactions, donnees.solde)
      : []),
  ];
  const rang = { alerte: 0, attention: 1, info: 2 };
  return liste
    .filter((a) => !estReportee(a.id, reports))
    .sort((a, b) => rang[a.niveau] - rang[b.niveau]);
}

// ------------------------------------------------------- son et vibration

export {
  debloquerAlarme,
  declencherAlarmeAppareil,
  jouerSonAlarme,
  notifierAlarme,
  vibrerAlarme,
} from "./alarme-appareil";

