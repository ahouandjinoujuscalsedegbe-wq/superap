/**
 * Prévisions renforcées, utiles avec peu de données.
 *
 * La projection classique (dépenses du mois ÷ jours écoulés × jours du mois)
 * n'est fiable qu'après environ 60 jours d'historique. Ce module ajoute des
 * méthodes de repli qui donnent une estimation exploitable dès deux semaines
 * de saisie, et indique honnêtement leur degré de confiance :
 *
 *  - tendance récente : le rythme des 7 derniers jours, pondéré avec le
 *    rythme du mois, capte les changements d'habitudes ;
 *  - comparaison au mois précédent : le mois dernier aux mêmes jours sert de
 *    référence quand il existe ;
 *  - cycle hebdomadaire : la répartition des dépenses par jour de semaine
 *    (marché le samedi, semaine calme…) ajuste la fin de mois attendue.
 *
 * Tout est calculé sur l'appareil, sans aucune connexion.
 */
import type { Transaction } from "./store";

export type FiabilitePrevision = "bonne" | "estimee" | "faible";

export type PrevisionRobuste = {
  /** Projection de dépenses à la fin du mois, en FCFA. */
  projection: number;
  /** Rythme journalier retenu, en FCFA par jour. */
  rythme: number;
  /** Confiance dans cette projection. */
  fiabilite: FiabilitePrevision;
  /** Explication en clair de la méthode utilisée. */
  methode: string;
  /** Jours d'historique disponibles (toutes dates confondues). */
  joursHistorique: number;
};

const JOUR_MS = 86_400_000;

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function joursDansMois(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function dateDe(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function memeMois(d: Date, ref: Date, decalage: number): boolean {
  const cible = new Date(ref.getFullYear(), ref.getMonth() - decalage, 1);
  return d.getFullYear() === cible.getFullYear() && d.getMonth() === cible.getMonth();
}

/**
 * Calcule une projection de fin de mois plus robuste que la simple moyenne,
 * en combinant les méthodes disponibles selon la profondeur de l'historique.
 */
export function projectionRobuste(
  transactions: Transaction[],
  maintenant = new Date(),
): PrevisionRobuste {
  const depenses = transactions.filter((t) => t.type === "depense");
  const joursEcoules = Math.max(1, maintenant.getDate());
  const totalJours = joursDansMois(maintenant);
  const joursRestants = Math.max(0, totalJours - joursEcoules);

  const dates = depenses
    .map((t) => dateDe(t.date))
    .filter((d): d is Date => d !== null)
    .map((d) => Math.floor((maintenant.getTime() - d.getTime()) / JOUR_MS))
    .filter((j) => j >= 0);
  const joursHistorique = dates.length > 0 ? Math.max(...dates) : 0;

  const duMois = depenses.filter((t) => {
    const d = dateDe(t.date);
    return d !== null && memeMois(d, maintenant, 0);
  });
  const montantMois = duMois.reduce((s, t) => s + Math.abs(t.montant), 0);

  if (montantMois === 0 || joursEcoules < 2) {
    return {
      projection: 0,
      rythme: 0,
      fiabilite: "faible",
      methode:
        "Pas encore assez de dépenses saisies ce mois-ci pour projeter quoi que ce soit : enregistrez quelques opérations et je reprendrai les calculs.",
      joursHistorique,
    };
  }

  /* 1. Rythme de base : moyenne simple du mois. */
  const rythmeBase = montantMois / joursEcoules;

  /* 2. Tendance récente : les 7 derniers jours pèsent autant que le mois,
        pour capter un changement d'habitudes sans sur-réagir. */
  const recentes = duMois.filter((t) => {
    const d = dateDe(t.date);
    if (!d) return false;
    const j = Math.floor((maintenant.getTime() - d.getTime()) / JOUR_MS);
    return j <= 7;
  });
  const joursRecents = Math.min(7, joursEcoules);
  const rythmeRecent = recentes.reduce((s, t) => s + Math.abs(t.montant), 0) / joursRecents;

  /* 3. Référence du mois précédent sur la même période : si le mois dernier
        existait, on suppose que la part déjà dépensée se reproduit. */
  const moisDernier = depenses.filter((t) => {
    const d = dateDe(t.date);
    return d !== null && memeMois(d, maintenant, 1);
  });
  let projectionMoisDernier: number | null = null;
  if (moisDernier.length >= 3) {
    const totalDernier = moisDernier.reduce((s, t) => s + Math.abs(t.montant), 0);
    const debutDernier = moisDernier
      .filter((t) => {
        const d = dateDe(t.date);
        return d !== null && d.getDate() <= joursEcoules;
      })
      .reduce((s, t) => s + Math.abs(t.montant), 0);
    if (debutDernier > 0) {
      // Part du mois dernier déjà dépensée à ce stade → extrapolation.
      projectionMoisDernier = (montantMois / debutDernier) * totalDernier;
    }
  }

  /* 4. Cycle hebdomadaire : répartition moyenne des dépenses par jour de
        semaine sur tout l'historique, pour ajuster les jours restants. */
  const parJourSemaine = Array<number>(7).fill(0);
  const joursObserves = new Set<string>();
  for (const t of depenses) {
    const d = dateDe(t.date);
    if (!d) continue;
    parJourSemaine[d.getDay()] = (parJourSemaine[d.getDay()] ?? 0) + Math.abs(t.montant);
    joursObserves.add(t.date.slice(0, 10));
  }
  let facteurCycle = 1;
  if (joursObserves.size >= 10) {
    const totalPoids = parJourSemaine.reduce((s, v) => s + v, 0);
    if (totalPoids > 0) {
      const moyenneJour = totalPoids / 7;
      let poidsRestant = 0;
      for (let j = 1; j <= joursRestants; j++) {
        const futur = new Date(
          maintenant.getFullYear(),
          maintenant.getMonth(),
          maintenant.getDate() + j,
        );
        poidsRestant += parJourSemaine[futur.getDay()] ?? 0;
      }
      const attenduPlat = moyenneJour * joursRestants;
      if (attenduPlat > 0 && poidsRestant > 0) {
        facteurCycle = poidsRestant / attenduPlat;
      }
    }
  }

  /* Pondération selon la profondeur disponible. */
  let rythmeRetenu: number;
  let methode: string;
  let fiabilite: FiabilitePrevision;

  if (joursHistorique >= 60 && projectionMoisDernier !== null) {
    const rythmePondere =
      0.4 * rythmeBase + 0.3 * rythmeRecent + 0.3 * (projectionMoisDernier / totalJours);
    rythmeRetenu = rythmePondere * (0.85 + 0.15 * facteurCycle);
    fiabilite = "bonne";
    methode =
      "Projection croisant votre moyenne du mois, votre tendance des 7 derniers jours et le déroulé du mois dernier, ajustée à votre rythme hebdomadaire.";
  } else if (joursHistorique >= 14) {
    rythmeRetenu = 0.45 * rythmeBase + 0.55 * rythmeRecent;
    if (projectionMoisDernier !== null) {
      rythmeRetenu = 0.7 * rythmeRetenu + 0.3 * (projectionMoisDernier / totalJours);
    }
    fiabilite = "estimee";
    methode =
      "Estimation fondée sur votre tendance récente (7 derniers jours) et le rythme du mois, faute d'historique long ; elle se précisera de jour en jour.";
  } else {
    rythmeRetenu = 0.3 * rythmeBase + 0.7 * rythmeRecent;
    fiabilite = "faible";
    methode =
      "Première estimation provisoire, basée surtout sur vos derniers jours : avec moins de deux semaines de données, prenez-la comme un ordre de grandeur.";
  }

  const projection = Math.round(montantMois + rythmeRetenu * joursRestants);

  return {
    projection,
    rythme: Math.round(rythmeRetenu),
    fiabilite,
    methode: `${methode} (environ ${fcfa(rythmeRetenu)} par jour sur les ${joursRestants} jour(s) restants)`,
    joursHistorique,
  };
}
