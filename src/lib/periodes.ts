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

/** Bornes (YYYY-MM-DD) de la période contenant le jour donné. */
export function bornesPeriode(jour: string, periode: Periode): { debut: string; fin: string } {
  const d = new Date(`${jour}T12:00:00`);
  const iso = (x: Date) => {
    const y = new Date(x.getTime() - x.getTimezoneOffset() * 60000);
    return y.toISOString().slice(0, 10);
  };
  let debut = new Date(d);
  let fin = new Date(d);
  switch (periode) {
    case "jour":
      break;
    case "semaine": {
      const dec = (d.getDay() + 6) % 7;
      debut = new Date(d);
      debut.setDate(d.getDate() - dec);
      fin = new Date(debut);
      fin.setDate(debut.getDate() + 6);
      break;
    }
    case "mois":
      debut = new Date(d.getFullYear(), d.getMonth(), 1, 12);
      fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
      break;
    case "trimestre": {
      const t = Math.floor(d.getMonth() / 3) * 3;
      debut = new Date(d.getFullYear(), t, 1, 12);
      fin = new Date(d.getFullYear(), t + 3, 0, 12);
      break;
    }
    case "semestre": {
      const s = d.getMonth() < 6 ? 0 : 6;
      debut = new Date(d.getFullYear(), s, 1, 12);
      fin = new Date(d.getFullYear(), s + 6, 0, 12);
      break;
    }
    case "annee":
      debut = new Date(d.getFullYear(), 0, 1, 12);
      fin = new Date(d.getFullYear(), 11, 31, 12);
      break;
  }
  return { debut: iso(debut), fin: iso(fin) };
}

const FMT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

/** Libellé lisible d'une plage de période. */
export function libellePlage(plage: { debut: string; fin: string }): string {
  if (plage.debut === plage.fin) return FMT.format(new Date(`${plage.debut}T12:00:00`));
  return `${FMT.format(new Date(`${plage.debut}T12:00:00`))} → ${FMT.format(new Date(`${plage.fin}T12:00:00`))}`;
}
