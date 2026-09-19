/**
 * Journal des échecs silencieux touchant les copies chiffrées.
 *
 * Beaucoup d'opérations de sauvegarde échouent sans bruit (réseau coupé,
 * stockage saturé, dossier privé indisponible). Sans trace, l'utilisateur
 * croit être protégé alors que sa dernière copie date de plusieurs jours.
 * Chaque échec est donc noté ici, et le bandeau d'alerte s'appuie dessus.
 */

const CLE = "superapp:incidents:copies:v1";
/** Nombre d'échecs consécutifs à partir duquel on prévient l'utilisateur. */
export const SEUIL_ALERTE = 3;
const MAX = 30;

export type DomaineIncident = "coffre-local" | "coffre-nomme" | "coffre-cloud";

export type Incident = {
  domaine: DomaineIncident;
  date: string;
  detail: string;
};

export type EtatIncidents = {
  /** Échecs consécutifs par domaine (remis à zéro dès une réussite). */
  suites: Partial<Record<DomaineIncident, number>>;
  /** Derniers échecs, le plus récent d'abord. */
  derniers: Incident[];
};

const VIDE: EtatIncidents = { suites: {}, derniers: [] };

export const EVENEMENT_INCIDENT = "superapp:incident";

export function lireIncidents(): EtatIncidents {
  try {
    const brut = window.localStorage.getItem(CLE);
    if (!brut) return VIDE;
    const lu = JSON.parse(brut) as Partial<EtatIncidents>;
    return {
      suites: typeof lu.suites === "object" && lu.suites ? lu.suites : {},
      derniers: Array.isArray(lu.derniers) ? (lu.derniers as Incident[]) : [],
    };
  } catch {
    return VIDE;
  }
}

function ecrire(etat: EtatIncidents): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(etat));
    window.dispatchEvent(new Event(EVENEMENT_INCIDENT));
  } catch {
    /* stockage indisponible : l'alerte reste au moins visible en mémoire */
  }
}

/** Note un échec silencieux et renvoie le nombre d'échecs consécutifs. */
export function noterIncident(domaine: DomaineIncident, detail: string): number {
  const etat = lireIncidents();
  const suite = (etat.suites[domaine] ?? 0) + 1;
  const incident: Incident = { domaine, date: new Date().toISOString(), detail };
  ecrire({
    suites: { ...etat.suites, [domaine]: suite },
    derniers: [incident, ...etat.derniers].slice(0, MAX),
  });
  return suite;
}

/** Une réussite efface la série d'échecs du domaine concerné. */
export function noterReussite(domaine: DomaineIncident): void {
  const etat = lireIncidents();
  if (!etat.suites[domaine]) return;
  const suites = { ...etat.suites };
  delete suites[domaine];
  ecrire({ ...etat, suites });
}

export function oublierIncidents(): void {
  try {
    window.localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(EVENEMENT_INCIDENT));
  } catch {
    /* rien à retirer */
  }
}

const LIBELLES: Record<DomaineIncident, string> = {
  "coffre-local": "coffre de versions sur le téléphone",
  "coffre-nomme": "dossier que vous avez nommé",
  "coffre-cloud": "espace rattaché à votre adresse e-mail",
};

export function libelleDomaine(domaine: DomaineIncident): string {
  return LIBELLES[domaine] ?? domaine;
}

/** Domaines dont la série d'échecs mérite un avertissement visible. */
export function domainesEnAlerte(etat = lireIncidents()): DomaineIncident[] {
  return (Object.keys(etat.suites) as DomaineIncident[]).filter(
    (d) => (etat.suites[d] ?? 0) >= SEUIL_ALERTE,
  );
}
