/**
 * Journal local des opérations sensibles sur les données :
 * exports chiffrés, purges complètes et restaurations.
 *
 * Le journal est volontairement conservé après une purge (il est réécrit
 * juste après l'effacement) afin de garder une trace horodatée.
 */

export const CLE_JOURNAL = "superapp:journal-donnees:v1";
const MAX_ENTREES = 100;

export type TypeEvenement = "export-chiffre" | "purge" | "restauration";

export type EntreeJournal = {
  id: string;
  type: TypeEvenement;
  horodatage: string;
  details: string;
};

export function lireJournal(): EntreeJournal[] {
  try {
    const brut = window.localStorage.getItem(CLE_JOURNAL);
    if (!brut) return [];
    const liste = JSON.parse(brut) as EntreeJournal[];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

export function ecrireJournal(entrees: EntreeJournal[]) {
  try {
    window.localStorage.setItem(CLE_JOURNAL, JSON.stringify(entrees.slice(0, MAX_ENTREES)));
  } catch {
    /* noop */
  }
}

export function consigner(type: TypeEvenement, details: string): EntreeJournal {
  const entree: EntreeJournal = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    horodatage: new Date().toISOString(),
    details,
  };
  ecrireJournal([entree, ...lireJournal()]);
  return entree;
}

export function viderJournal() {
  try {
    window.localStorage.removeItem(CLE_JOURNAL);
  } catch {
    /* noop */
  }
}

export const LIBELLES: Record<TypeEvenement, string> = {
  "export-chiffre": "Export chiffré",
  purge: "Purge complète",
  restauration: "Restauration",
};

export function formaterHorodatage(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}
