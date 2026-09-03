/**
 * Journal local des actions sur les comptes (création, renommage, suppression).
 * Tout reste sur l'appareil : aucune donnée n'est envoyée à l'extérieur.
 */

export type ActionCompte = "creation" | "renommage" | "suppression" | "modification";

export type EntreeHistoriqueCompte = {
  /** Identifiant stable. */
  id: string;
  /** Nom du compte concerné après l'action. */
  compte: string;
  /** Ancien nom en cas de renommage. */
  ancienNom?: string | undefined;
  action: ActionCompte;
  /** Date ISO complète de l'action. */
  date: string;
  /** Nom de l'utilisateur qui a effectué l'action. */
  auteur: string;
  /** Résumé lisible des changements. */
  details: string;
};

const CLE = "superapp.historique-comptes";
const MAX = 300;

function stockage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function lireHistoriqueComptes(): EntreeHistoriqueCompte[] {
  const s = stockage();
  if (!s) return [];
  try {
    const brut = s.getItem(CLE);
    if (!brut) return [];
    const lu: unknown = JSON.parse(brut);
    if (!Array.isArray(lu)) return [];
    return lu.filter(
      (e): e is EntreeHistoriqueCompte =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as EntreeHistoriqueCompte).compte === "string" &&
        typeof (e as EntreeHistoriqueCompte).date === "string",
    );
  } catch {
    return [];
  }
}

/** Ajoute une action au journal et renvoie le journal mis à jour. */
export function enregistrerActionCompte(
  entree: Omit<EntreeHistoriqueCompte, "id" | "date"> & { date?: string },
): EntreeHistoriqueCompte[] {
  const s = stockage();
  const complete: EntreeHistoriqueCompte = {
    ...entree,
    auteur: entree.auteur.trim() || "Utilisateur",
    date: entree.date ?? new Date().toISOString(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const liste = [complete, ...lireHistoriqueComptes()].slice(0, MAX);
  if (s) {
    try {
      s.setItem(CLE, JSON.stringify(liste));
    } catch {
      /* stockage plein : le journal reste en mémoire pour cette session */
    }
  }
  return liste;
}

/** Journal filtré pour un compte donné (y compris sous son ancien nom). */
export function historiqueDuCompte(nom: string): EntreeHistoriqueCompte[] {
  return lireHistoriqueComptes().filter((e) => e.compte === nom || e.ancienNom === nom);
}

export function libelleAction(action: ActionCompte): string {
  if (action === "creation") return "Compte créé";
  if (action === "renommage") return "Compte renommé";
  if (action === "suppression") return "Compte supprimé";
  return "Compte modifié";
}
