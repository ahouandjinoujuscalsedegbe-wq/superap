/**
 * Journal local des actions sur les enveloppes (création, modification,
 * renommage, suppression). Tout reste sur l'appareil.
 */

export type ActionEnveloppe = "creation" | "renommage" | "modification" | "suppression";

export type EntreeHistoriqueEnveloppe = {
  id: string;
  /** Nom de l'enveloppe après l'action. */
  enveloppe: string;
  /** Ancien nom en cas de renommage. */
  ancienNom?: string | undefined;
  action: ActionEnveloppe;
  /** Date ISO complète. */
  date: string;
  /** Utilisateur qui a effectué l'action. */
  auteur: string;
  /** Résumé lisible des changements. */
  details: string;
};

const CLE = "superapp.historique-enveloppes";
const MAX = 300;

function stockage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function lireHistoriqueEnveloppes(): EntreeHistoriqueEnveloppe[] {
  const s = stockage();
  if (!s) return [];
  try {
    const brut = s.getItem(CLE);
    if (!brut) return [];
    const lu: unknown = JSON.parse(brut);
    if (!Array.isArray(lu)) return [];
    return lu.filter(
      (e): e is EntreeHistoriqueEnveloppe =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as EntreeHistoriqueEnveloppe).enveloppe === "string" &&
        typeof (e as EntreeHistoriqueEnveloppe).date === "string",
    );
  } catch {
    return [];
  }
}

/** Ajoute une action au journal et renvoie le journal mis à jour. */
export function enregistrerActionEnveloppe(
  entree: Omit<EntreeHistoriqueEnveloppe, "id" | "date"> & { date?: string },
): EntreeHistoriqueEnveloppe[] {
  const complete: EntreeHistoriqueEnveloppe = {
    ...entree,
    auteur: entree.auteur.trim() || "Utilisateur",
    date: entree.date ?? new Date().toISOString(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const liste = [complete, ...lireHistoriqueEnveloppes()].slice(0, MAX);
  const s = stockage();
  if (s) {
    try {
      s.setItem(CLE, JSON.stringify(liste));
    } catch {
      /* stockage plein : le journal reste en mémoire pour cette session */
    }
  }
  return liste;
}

/** Journal filtré pour une enveloppe donnée (y compris sous son ancien nom). */
export function historiqueDeLEnveloppe(nom: string): EntreeHistoriqueEnveloppe[] {
  return lireHistoriqueEnveloppes().filter((e) => e.enveloppe === nom || e.ancienNom === nom);
}

export function libelleActionEnveloppe(action: ActionEnveloppe): string {
  if (action === "creation") return "Enveloppe créée";
  if (action === "renommage") return "Enveloppe renommée";
  if (action === "suppression") return "Enveloppe supprimée";
  return "Enveloppe modifiée";
}
