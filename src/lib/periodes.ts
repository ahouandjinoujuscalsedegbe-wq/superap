import type { Budget, Periode } from "./store";

export const PAR_AN: Record<Periode, number> = {
  jour: 365,
  semaine: 52,
  mois: 12,
  trimestre: 4,
  semestre: 2,
  annee: 1,
};

export function avancerDate(iso: string, periode: Periode): string {
  const d = new Date(iso);
  switch (periode) {
    case "jour":
      d.setDate(d.getDate() + 1);
      break;
    case "semaine":
      d.setDate(d.getDate() + 7);
      break;
    case "mois":
      d.setMonth(d.getMonth() + 1);
      break;
    case "trimestre":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semestre":
      d.setMonth(d.getMonth() + 6);
      break;
    case "annee":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString();
}

/** Nombre d'échéances arrivées à terme mais pas encore converties. */
export function nombreEcheancesDues(b: Budget, maintenant = new Date()): number {
  let n = 0;
  let date = b.prochaine;
  while (new Date(date).getTime() <= maintenant.getTime() && n < 240) {
    n += 1;
    date = avancerDate(date, b.periode);
  }
  return n;
}

export function totalDu(budgets: Budget[], maintenant = new Date()): number {
  return budgets
    .filter((b) => b.actif)
    .reduce((s, b) => s + nombreEcheancesDues(b, maintenant) * b.montant, 0);
}

/** Prochaines échéances à venir, triées par date. */
export function prochainesEcheances(
  budgets: Budget[],
  nombre = 12,
  maintenant = new Date(),
): { budget: Budget; date: string }[] {
  const liste: { budget: Budget; date: string }[] = [];
  for (const b of budgets) {
    if (!b.actif) continue;
    let date = b.prochaine;
    for (let i = 0; i < 6; i += 1) {
      if (new Date(date).getTime() >= maintenant.getTime()) liste.push({ budget: b, date });
      date = avancerDate(date, b.periode);
    }
  }
  return liste.sort((a, z) => +new Date(a.date) - +new Date(z.date)).slice(0, nombre);
}

export function equivalentMensuel(b: Budget): number {
  return (b.montant * PAR_AN[b.periode]) / 12;
}
