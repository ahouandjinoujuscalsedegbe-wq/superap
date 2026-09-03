/**
 * Échéances planifiées arrivées à terme : elles ne deviennent JAMAIS une
 * dépense réelle sans confirmation de l'utilisateur.
 * 100 % local, aucun envoi de données.
 */

import type { Budget } from "@/lib/store";

/** Jour local au format YYYY-MM-DD (jamais décalé par le fuseau UTC). */
export function jourLocalISO(d: Date = new Date()): string {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return x.toISOString().slice(0, 10);
}

export type EcheanceDue = {
  budget: Budget;
  /** Date/heure prévue de la dépense. */
  quand: Date;
  /** Clé stable pour ne pas répéter la même alarme. */
  cle: string;
};

/** Liste des échéances dont l'heure est passée et qui attendent une confirmation. */
export function echeancesDues(budgets: Budget[], maintenant = new Date()): EcheanceDue[] {
  const dues: EcheanceDue[] = [];
  for (const b of budgets) {
    if (!b.actif) continue;
    const quand = new Date(b.prochaine);
    if (Number.isNaN(quand.getTime()) || quand.getTime() > maintenant.getTime()) continue;
    dues.push({ budget: b, quand, cle: `${b.id}-${b.prochaine}` });
  }
  return dues.sort((a, z) => a.quand.getTime() - z.quand.getTime());
}

/** Moment du rappel : jour de l'échéance, à l'heure d'alarme choisie. */
export function momentRappel(b: Budget): Date {
  const jour = new Date(b.prochaine);
  if (Number.isNaN(jour.getTime())) return new Date(0);
  const [h, m] = (b.heureRappel ?? "07:30").split(":");
  const quand = new Date(jour);
  quand.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
  return quand;
}

const CLE = "echeances-rappelees";

function lues(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Vrai si le rappel de cette échéance n'a pas encore sonné. */
export function rappelNonSonne(cle: string): boolean {
  return !lues().includes(cle);
}

/** Mémorise qu'une alarme a déjà sonné pour cette échéance. */
export function marquerRappelSonne(cle: string): void {
  if (typeof window === "undefined") return;
  const liste = [cle, ...lues().filter((c) => c !== cle)].slice(0, 200);
  try {
    window.localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    /* stockage indisponible */
  }
}
