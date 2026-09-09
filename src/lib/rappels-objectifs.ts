/**
 * Rappels des cotisations : tontines et épargnes programmées.
 *
 * À chaque fréquence choisie par l'utilisateur (semaine, quinzaine, mois),
 * l'application calcule une échéance et lui demande de confirmer — ou de
 * refuser — qu'il a bien effectué le versement. Tout est calculé et conservé
 * sur l'appareil : aucune donnée ne sort du téléphone.
 */

import type { FrequenceTontine, Objectif } from "./store";

const CLE = "SA_RAPPELS_OBJECTIFS_V1";

/** Nombre de jours entre deux cotisations, selon le rythme choisi. */
export const JOURS_FREQUENCE: Record<FrequenceTontine, number> = {
  hebdomadaire: 7,
  quinzaine: 14,
  mensuelle: 30,
};

export type ReponseRappel = "confirme" | "refuse";

export type EcheanceRappel = {
  /** Identifiant unique « objectif:date ». */
  cle: string;
  objectifId: string;
  libelle: string;
  type: "tontine" | "epargne";
  /** Date de l'échéance (YYYY-MM-DD). */
  date: string;
  /** Montant attendu pour cette échéance. */
  montant: number;
  /** Numéro de la cotisation, et total prévu quand il est connu. */
  numero: number;
  total?: number | undefined;
};

function ajouterJours(depart: string, jours: number): string {
  const d = new Date(`${depart}T00:00:00`);
  return new Date(d.getTime() + jours * 86_400_000).toISOString().slice(0, 10);
}

/** Rythme de rappel d'un objectif, ou null s'il n'en a pas. */
export function frequenceObjectif(o: Objectif): FrequenceTontine | null {
  if (o.rappelActif === false) return null;
  if (o.type === "tontine") return o.tontineFrequence ?? "mensuelle";
  if ((o.type ?? "epargne") === "epargne") return o.rappelFrequence ?? null;
  return null;
}

/** Montant attendu à chaque échéance. */
function montantEcheance(o: Objectif, total: number): number {
  if (o.type === "tontine" && o.tontineMontantTour) return o.tontineMontantTour;
  const reste = Math.max(0, o.cible - (o.deja || 0));
  return total > 0 ? Math.round(reste / total) : reste;
}

/** Toutes les échéances d'un objectif jusqu'à la date donnée (incluse). */
export function echeancesObjectif(o: Objectif, jusqua: Date): EcheanceRappel[] {
  const frequence = frequenceObjectif(o);
  if (!frequence) return [];
  const pas = JOURS_FREQUENCE[frequence];
  const debut =
    o.type === "tontine" ? (o.tontineDebut ?? o.creeLe.slice(0, 10)) : o.creeLe.slice(0, 10);
  if (!debut) return [];

  const fin = jusqua.toISOString().slice(0, 10);
  const limite = o.type === "tontine" ? (o.tontineParticipants ?? 12) : Infinity;
  const dateFin = o.type === "tontine" ? undefined : o.dateCible;
  const totalPrevu =
    o.type === "tontine"
      ? (o.tontineParticipants ?? 12)
      : Math.max(
          1,
          Math.ceil(
            (new Date(`${o.dateCible}T00:00:00`).getTime() -
              new Date(`${debut}T00:00:00`).getTime()) /
              (pas * 86_400_000),
          ),
        );
  const montant = montantEcheance(o, totalPrevu);

  const out: EcheanceRappel[] = [];
  let date = debut;
  let numero = 1;
  while (date <= fin && numero <= limite && out.length < 400) {
    if (dateFin && date > dateFin) break;
    out.push({
      cle: `${o.id}:${date}`,
      objectifId: o.id,
      libelle: o.libelle,
      type: o.type === "tontine" ? "tontine" : "epargne",
      date,
      montant,
      numero,
      total: Number.isFinite(totalPrevu) ? totalPrevu : undefined,
    });
    date = ajouterJours(date, pas);
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
        titre: e.type === "tontine" ? `Tontine : ${e.libelle}` : `Épargne : ${e.libelle}`,
        texte: `Cotisation n° ${e.numero}${e.total ? `/${e.total}` : ""} prévue aujourd'hui. Ouvrez l'application pour confirmer ou refuser.`,
        quand: new Date(`${e.date}T08:00:00`),
      });
    }
  }
  return out.sort((a, b) => a.quand.getTime() - b.quand.getTime()).slice(0, 20);
}
