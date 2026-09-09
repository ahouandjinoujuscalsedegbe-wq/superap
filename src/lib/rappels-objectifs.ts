/**
 * Rappels des cotisations : tontines et épargnes programmées.
 *
 * À chaque fréquence choisie par l'utilisateur (semaine, quinzaine, mois),
 * l'application calcule une échéance et lui demande de confirmer — ou de
 * refuser — qu'il a bien effectué le versement. Tout est calculé et conservé
 * sur l'appareil : aucune donnée ne sort du téléphone.
 */

import type { FrequenceTontine, Objectif, UniteRappel } from "./store";

const CLE = "SA_RAPPELS_OBJECTIFS_V1";

/** Nombre de jours entre deux cotisations, selon l'ancien rythme enregistré. */
export const JOURS_FREQUENCE: Record<FrequenceTontine, number> = {
  hebdomadaire: 7,
  quinzaine: 14,
  mensuelle: 30,
};

/** Ancien rythme converti vers le nouveau format libre (unité + intervalle). */
const CONVERSION: Record<FrequenceTontine, Rythme> = {
  hebdomadaire: { unite: "semaine", intervalle: 1 },
  quinzaine: { unite: "semaine", intervalle: 2 },
  mensuelle: { unite: "mois", intervalle: 1 },
};

export type Rythme = { unite: UniteRappel; intervalle: number };

export type ReponseRappel = "confirme" | "refuse";

/** Intitulé affiché dans les rappels selon la nature de l'objectif. */
export function titreType(type: "tontine" | "epargne" | "achat"): string {
  if (type === "tontine") return "Tontine";
  if (type === "achat") return "Achat programmé";
  return "Épargne";
}

export type EcheanceRappel = {
  /** Identifiant unique « objectif:date ». */
  cle: string;
  objectifId: string;
  libelle: string;
  type: "tontine" | "epargne" | "achat";
  /** Date de l'échéance (YYYY-MM-DD). */
  date: string;
  /** Montant attendu pour cette échéance. */
  montant: number;
  /** Numéro de la cotisation, et total prévu quand il est connu. */
  numero: number;
  total?: number | undefined;
};

/** Avance une date d'un nombre d'unités, en respectant les longueurs de mois. */
export function avancerDate(depart: string, rythme: Rythme): string {
  const d = new Date(`${depart}T00:00:00`);
  const n = Math.max(1, Math.round(rythme.intervalle));
  if (rythme.unite === "jour") d.setDate(d.getDate() + n);
  else if (rythme.unite === "semaine") d.setDate(d.getDate() + 7 * n);
  else if (rythme.unite === "annee") d.setFullYear(d.getFullYear() + n);
  else {
    // Mois : on garde le jour du mois quand il existe, sinon le dernier jour.
    const jour = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(jour, dernier));
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Durée moyenne d'un intervalle, en jours (pour les estimations). */
export function joursRythme(rythme: Rythme): number {
  const n = Math.max(1, rythme.intervalle);
  if (rythme.unite === "jour") return n;
  if (rythme.unite === "semaine") return 7 * n;
  if (rythme.unite === "annee") return 365 * n;
  return 30 * n;
}

/**
 * Rythme de rappel d'un objectif, quel que soit son type (épargne, achat ou
 * tontine), ou null quand l'utilisateur n'a pas demandé de rappel.
 */
export function rythmeObjectif(o: Objectif): Rythme | null {
  if (o.rappelActif === false) return null;
  if (o.rappelUnite && o.rappelIntervalle && o.rappelIntervalle > 0) {
    return { unite: o.rappelUnite, intervalle: Math.min(31, Math.round(o.rappelIntervalle)) };
  }
  // Données créées avant le choix libre du rythme.
  if (o.type === "tontine") return CONVERSION[o.tontineFrequence ?? "mensuelle"];
  if (o.rappelFrequence) return CONVERSION[o.rappelFrequence];
  return null;
}

/** Montant attendu à chaque échéance. */
function montantEcheance(o: Objectif, total: number): number {
  if (o.type === "tontine" && o.tontineMontantTour) return o.tontineMontantTour;
  const reste = Math.max(0, o.cible - (o.deja || 0));
  return total > 0 ? Math.round(reste / total) : reste;
}

/** Date du premier rappel de l'objectif. */
function debutObjectif(o: Objectif): string {
  if (o.rappelDebut) return o.rappelDebut;
  if (o.type === "tontine" && o.tontineDebut) return o.tontineDebut;
  return o.creeLe.slice(0, 10);
}

/** Toutes les échéances d'un objectif jusqu'à la date donnée (incluse). */
export function echeancesObjectif(o: Objectif, jusqua: Date): EcheanceRappel[] {
  const rythme = rythmeObjectif(o);
  if (!rythme) return [];
  const debut = debutObjectif(o);
  if (!debut) return [];

  const fin = jusqua.toISOString().slice(0, 10);
  const limite = o.type === "tontine" ? (o.tontineParticipants ?? 12) : Infinity;
  const dateFin = o.type === "tontine" ? undefined : o.dateCible;
  const pasJours = joursRythme(rythme);
  const totalPrevu =
    o.type === "tontine"
      ? (o.tontineParticipants ?? 12)
      : Math.max(
          1,
          Math.ceil(
            (new Date(`${o.dateCible}T00:00:00`).getTime() -
              new Date(`${debut}T00:00:00`).getTime()) /
              (pasJours * 86_400_000),
          ),
        );
  const montant = montantEcheance(o, totalPrevu);
  const type: EcheanceRappel["type"] =
    o.type === "tontine" ? "tontine" : o.type === "achat" ? "achat" : "epargne";

  const out: EcheanceRappel[] = [];
  let date = debut;
  let numero = 1;
  while (date <= fin && numero <= limite && out.length < 400) {
    if (dateFin && date > dateFin) break;
    out.push({
      cle: `${o.id}:${date}`,
      objectifId: o.id,
      libelle: o.libelle,
      type,
      date,
      montant,
      numero,
      total: Number.isFinite(totalPrevu) ? totalPrevu : undefined,
    });
    date = avancerDate(date, rythme);
    numero += 1;
  }
  return out;
}

/** Prochaine échéance à venir (strictement après aujourd'hui). */
export function prochaineEcheance(o: Objectif, maintenant = new Date()): EcheanceRappel | null {
  const horizon = new Date(maintenant.getTime() + 400 * 86_400_000);
  const toutes = echeancesObjectif(o, horizon);
  const aujourdhui = maintenant.toISOString().slice(0, 10);
  return toutes.find((e) => e.date > aujourdhui) ?? null;
}

/* ------------------------------------------------------------------ */
/* Réponses de l'utilisateur (stockage local)                          */
/* ------------------------------------------------------------------ */

export function lireReponses(): Record<string, ReponseRappel> {
  if (typeof localStorage === "undefined") return {};
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return {};
    const objet = JSON.parse(brut) as Record<string, unknown>;
    const out: Record<string, ReponseRappel> = {};
    for (const [k, v] of Object.entries(objet)) {
      if (v === "confirme" || v === "refuse") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function enregistrerReponse(cle: string, reponse: ReponseRappel): void {
  if (typeof localStorage === "undefined") return;
  try {
    const tout = lireReponses();
    tout[cle] = reponse;
    localStorage.setItem(CLE, JSON.stringify(tout));
  } catch {
    /* stockage saturé : la question sera reposée plus tard */
  }
}

/** Échéances déjà arrivées et restées sans réponse. */
export function echeancesEnAttente(
  objectifs: Objectif[],
  maintenant = new Date(),
): EcheanceRappel[] {
  const repondues = lireReponses();
  const out: EcheanceRappel[] = [];
  for (const o of objectifs) {
    for (const e of echeancesObjectif(o, maintenant)) {
      if (!repondues[e.cle]) out.push(e);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Rappels à programmer sur le téléphone pour les échéances futures. */
export function rappelsAProgrammer(
  objectifs: Objectif[],
  maintenant = new Date(),
): { cle: string; titre: string; texte: string; quand: Date }[] {
  const horizon = new Date(maintenant.getTime() + 120 * 86_400_000);
  const out: { cle: string; titre: string; texte: string; quand: Date }[] = [];
  for (const o of objectifs) {
    const echeances = echeancesObjectif(o, horizon).filter(
      (e) => new Date(`${e.date}T08:00:00`).getTime() > maintenant.getTime(),
    );
    for (const e of echeances.slice(0, 6)) {
      out.push({
        cle: e.cle,
        titre: `${titreType(e.type)} : ${e.libelle}`,
        texte: `Cotisation n° ${e.numero}${e.total ? `/${e.total}` : ""} prévue aujourd'hui. Ouvrez l'application pour confirmer ou refuser.`,
        quand: new Date(`${e.date}T08:00:00`),
      });
    }
  }
  return out.sort((a, b) => a.quand.getTime() - b.quand.getTime()).slice(0, 20);
}
