/**
 * Recherche globale hors ligne : retrouve instantanément une opération,
 * une enveloppe, un compte, une dette ou une dépense planifiée.
 */
import type { Budget, Dette, Enveloppe, Objectif, Transaction, Transfert } from "./store";
import { resteDu } from "./store";

export type TypeResultat =
  | "operation"
  | "enveloppe"
  | "compte"
  | "dette"
  | "budget"
  | "transfert"
  | "objectif";

export type Resultat = {
  id: string;
  type: TypeResultat;
  titre: string;
  detail: string;
  montant: number;
  /** Signe d'affichage : -1 sortie, +1 entrée, 0 neutre. */
  sens: -1 | 0 | 1;
  date?: string;
  lien: string;
  /** Pertinence, plus le score est haut plus le résultat remonte. */
  score: number;
};

export type SourcesRecherche = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  comptes: string[];
  dettes: Dette[];
  budgets: Budget[];
  transferts: Transfert[];
  objectifs: Objectif[];
  soldesParCompte: Record<string, number>;
  depensesParEnveloppe: Record<string, number>;
};

function normaliser(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Score de correspondance : 0 = aucune, 3 = correspondance exacte. */
function correspondance(texte: string, motsCles: string[]): number {
  const cible = normaliser(texte);
  if (!cible) return 0;
  let score = 0;
  for (const mot of motsCles) {
    if (cible === mot) score += 3;
    else if (cible.startsWith(mot)) score += 2;
    else if (cible.includes(mot)) score += 1;
    else return 0; // tous les mots doivent être présents
  }
  return score;
}

/** Recherche la requête dans toutes les données locales de l'application. */
export function rechercher(requete: string, s: SourcesRecherche, maximum = 40): Resultat[] {
  const mots = normaliser(requete)
    .split(/\s+/)
    .filter((m) => m.length >= 2);
  if (mots.length === 0) return [];

  const nomEnveloppe = new Map(s.enveloppes.map((e) => [e.id, `${e.emoji} ${e.nom}`]));
  const out: Resultat[] = [];
  const chiffre = Number(requete.replace(/[^\d]/g, ""));
  const rechercheMontant = Number.isFinite(chiffre) && chiffre > 0;

  for (const t of s.transactions) {
    const base = correspondance(
      `${t.libelle} ${nomEnveloppe.get(t.categorie) ?? t.categorie} ${t.compte} ${t.membre ?? ""}`,
      mots,
    );
    const parMontant = rechercheMontant && String(t.montant).includes(String(chiffre)) ? 2 : 0;
    const score = base + parMontant;
    if (score === 0) continue;
    out.push({
      id: t.id,
      type: "operation",
      titre: t.libelle || (t.type === "revenu" ? "Revenu" : "Dépense"),
      detail: `${nomEnveloppe.get(t.categorie) ?? t.categorie} · ${t.compte}${t.membre ? ` · ${t.membre}` : ""}`,
      montant: t.montant,
      sens: t.type === "revenu" ? 1 : -1,
      date: t.date,
      lien: "/",
      score: score + 1,
    });
  }

  for (const e of s.enveloppes) {
    const score = correspondance(`${e.nom} ${e.categorie ?? ""} ${e.sousCategorie ?? ""}`, mots);
    if (score === 0) continue;
    out.push({
      id: e.id,
      type: "enveloppe",
      titre: `${e.emoji} ${e.nom}`,
      detail: `${e.categorie ?? "Sans catégorie"} · ${(s.depensesParEnveloppe[e.id] ?? 0).toLocaleString("fr-FR")} FCFA utilisés`,
      montant: e.plafond,
      sens: 0,
      lien: "/enveloppes/details",
      score: score + 2,
    });
  }

  for (const c of s.comptes) {
    const score = correspondance(c, mots);
    if (score === 0) continue;
    out.push({
      id: c,
      type: "compte",
      titre: c,
      detail: "Compte",
      montant: s.soldesParCompte[c] ?? 0,
      sens: 0,
      lien: "/comptes",
      score: score + 2,
    });
  }

  for (const d of s.dettes) {
    const score = correspondance(`${d.personne} ${d.note ?? ""}`, mots);
    if (score === 0) continue;
    out.push({
      id: d.id,
      type: "dette",
      titre: d.personne,
      detail: d.sens === "dette" ? "Je dois" : "On me doit",
      montant: resteDu(d),
      sens: d.sens === "dette" ? -1 : 1,
      ...(d.dateLimite ? { date: d.dateLimite } : {}),
      lien: "/dettes",
      score: score + 1,
    });
  }

  for (const b of s.budgets) {
    const score = correspondance(`${b.libelle} ${nomEnveloppe.get(b.enveloppeId) ?? ""}`, mots);
    if (score === 0) continue;
    out.push({
      id: b.id,
      type: "budget",
      titre: b.libelle,
      detail: `Planifié · prochaine échéance ${b.prochaine}`,
      montant: b.montant,
      sens: -1,
      date: b.prochaine,
      lien: "/enveloppes/budgetisation",
      score,
    });
  }

  for (const t of s.transferts) {
    const score = correspondance(`${t.source} ${t.destination} ${t.note}`, mots);
    if (score === 0) continue;
    out.push({
      id: t.id,
      type: "transfert",
      titre: `${t.source} → ${t.destination}`,
      detail: t.note || "Transfert entre comptes",
      montant: t.montant,
      sens: 0,
      date: t.date,
      lien: "/comptes/transferts",
      score,
    });
  }

  for (const o of s.objectifs) {
    const score = correspondance(o.libelle, mots);
    if (score === 0) continue;
    out.push({
      id: o.id,
      type: "objectif",
      titre: o.libelle,
      detail: `Objectif d'épargne pour le ${o.dateCible}`,
      montant: o.cible,
      sens: 0,
      date: o.dateCible,
      lien: "/objectifs",
      score: score + 1,
    });
  }

  return out
    .sort((a, b) => b.score - a.score || (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, maximum);
}

export const LIBELLES_TYPE: Record<TypeResultat, string> = {
  operation: "Opération",
  enveloppe: "Enveloppe",
  compte: "Compte",
  dette: "Dette / créance",
  budget: "Dépense planifiée",
  transfert: "Transfert",
  objectif: "Objectif",
};
