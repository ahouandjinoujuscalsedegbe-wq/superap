/**
 * Opérations favorites : l'application repère seule les dépenses que
 * l'utilisateur répète (zémidjan, marché, crédit téléphonique…) et propose
 * de les ressaisir en un seul appui, avec un montant appris.
 */
import type { Transaction } from "./store";

export type Favori = {
  /** Clé stable, utilisable comme identifiant React. */
  cle: string;
  libelle: string;
  /** Enveloppe (dépense) ou source (revenu) habituelle. */
  categorie: string;
  compte: string;
  type: Transaction["type"];
  /** Montant le plus représentatif (médiane des montants observés). */
  montant: number;
  /** Nombre de fois où l'opération a été enregistrée. */
  occurrences: number;
  /** Date de la dernière occurrence (ISO). */
  derniere: string;
};

const JOUR = 86400000;

function normaliser(libelle: string): string {
  return libelle
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function mediane(valeurs: number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  if (tri.length === 0) return 0;
  const bas = tri[milieu - 1];
  const haut = tri[milieu];
  if (tri.length % 2 === 0 && bas !== undefined && haut !== undefined) {
    return Math.round((bas + haut) / 2);
  }
  return Math.round(haut ?? 0);
}

/**
 * Renvoie les opérations les plus fréquentes des derniers mois.
 * Une opération devient favorite à partir de deux occurrences.
 */
export function operationsFrequentes(
  transactions: Transaction[],
  options: { type?: Transaction["type"]; jours?: number; maximum?: number } = {},
): Favori[] {
  const { type, jours = 120, maximum = 6 } = options;
  const limite = Date.now() - jours * JOUR;

  const groupes = new Map<
    string,
    { libelle: string; montants: number[]; comptes: string[]; derniere: string }
  >();

  for (const t of transactions) {
    if (type && t.type !== type) continue;
    if (t.detteId || t.budgetId) continue; // générées automatiquement
    const libelle = t.libelle.trim();
    if (!libelle) continue;
    const d = new Date(t.date).getTime();
    if (!Number.isFinite(d) || d < limite) continue;

    const cle = `${t.type}|${normaliser(libelle)}|${t.categorie}`;
    const g = groupes.get(cle) ?? { libelle, montants: [], comptes: [], derniere: t.date };
    g.montants.push(t.montant);
    g.comptes.push(t.compte);
    if (t.date > g.derniere) {
      g.derniere = t.date;
      g.libelle = libelle;
    }
    groupes.set(cle, g);
  }

  const favoris: Favori[] = [];
  for (const [cle, g] of groupes) {
    if (g.montants.length < 2) continue;
    const [typeOp, , categorie] = cle.split("|");
    // Compte le plus utilisé pour cette opération.
    const compteur = new Map<string, number>();
    for (const c of g.comptes) compteur.set(c, (compteur.get(c) ?? 0) + 1);
    const compte = [...compteur.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

    favoris.push({
      cle,
      libelle: g.libelle,
      categorie: categorie ?? "",
      compte,
      type: typeOp === "revenu" ? "revenu" : "depense",
      montant: mediane(g.montants),
      occurrences: g.montants.length,
      derniere: g.derniere,
    });
  }

  return favoris
    .sort(
      (a, b) => b.occurrences - a.occurrences || (a.derniere < b.derniere ? 1 : -1),
    )
    .slice(0, maximum);
}
