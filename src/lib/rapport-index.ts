/**
 * Accélération des rapports et statistiques sur un très long historique.
 *
 * Sans index, chaque mois affiché relisait la totalité des opérations : avec
 * plusieurs années de saisie, la liste des rapports devenait très lente
 * (nombre de mois × nombre d'opérations). Ici, les opérations sont rangées une
 * seule fois par mois, et le résultat est gardé en mémoire tant que la liste
 * d'opérations n'a pas changé.
 */

import type { Enveloppe, Transaction } from "./store";
import { dotationDe } from "./enveloppe-etat";

export type IndexMois = Map<string, Transaction[]>;

const cacheIndex = new WeakMap<Transaction[], IndexMois>();

/** Range les opérations effectuées par mois (AAAA-MM), en une seule passe. */
export function indexerParMois(transactions: Transaction[], aujourdHui?: string): IndexMois {
  const borne = aujourdHui ?? new Date().toISOString().slice(0, 10);
  const enCache = cacheIndex.get(transactions);
  if (enCache && !aujourdHui) return enCache;

  const index: IndexMois = new Map();
  for (const t of transactions) {
    if (t.date.slice(0, 10) > borne) continue;
    const mois = t.date.slice(0, 7);
    const liste = index.get(mois);
    if (liste) liste.push(t);
    else index.set(mois, [t]);
  }
  if (!aujourdHui) cacheIndex.set(transactions, index);
  return index;
}

/** Mois présents dans l'historique, du plus récent au plus ancien. */
export function moisDeLIndex(index: IndexMois): string[] {
  const mois = new Set(index.keys());
  mois.add(new Date().toISOString().slice(0, 7));
  return [...mois].sort().reverse();
}

export type ResumeMois = {
  mois: string;
  revenus: number;
  depenses: number;
  net: number;
  nbOperations: number;
  score: number;
};

const cacheResumes = new WeakMap<Transaction[], Map<string, ResumeMois[]>>();

/**
 * Résumés légers de tous les mois : une seule passe sur l'historique complet,
 * puis un calcul par mois. Suffisant pour la liste des rapports ; le rapport
 * détaillé reste calculé à l'ouverture du mois choisi.
 */
export function resumesMensuels(
  transactions: Transaction[],
  enveloppes: Enveloppe[],
): ResumeMois[] {
  const signature = `${enveloppes.length}:${enveloppes.map((e) => `${e.id}${dotationDe(e)}`).join("|")}`;
  const parListe = cacheResumes.get(transactions);
  const enCache = parListe?.get(signature);
  if (enCache) return enCache;

  const index = indexerParMois(transactions);
  const dotations = new Map(enveloppes.map((e) => [e.id, dotationDe(e)]));

  const resumes = moisDeLIndex(index).map((mois) => {
    const liste = index.get(mois) ?? [];
    let revenus = 0;
    let depenses = 0;
    const parEnveloppe = new Map<string, number>();
    for (const t of liste) {
      if (t.type === "revenu") revenus += t.montant;
      else if (t.type === "depense") {
        depenses += t.montant;
        parEnveloppe.set(t.categorie, (parEnveloppe.get(t.categorie) ?? 0) + t.montant);
      }
    }
    const net = revenus - depenses;
    const tauxEpargne = revenus > 0 ? (net / revenus) * 100 : 0;
    let depassees = 0;
    for (const [id, utilise] of parEnveloppe) {
      const dotation = dotations.get(id) ?? 0;
      if (dotation > 0 && utilise > dotation) depassees += 1;
    }
    let score = 50 + Math.max(-30, Math.min(30, tauxEpargne * 1.2)) - depassees * 6;
    if (net < 0) score -= 15;
    if (revenus === 0 && depenses === 0) score = 50;
    return {
      mois,
      revenus,
      depenses,
      net,
      nbOperations: liste.length,
      score: Math.max(0, Math.min(100, Math.round(score))),
    };
  });

  const table = parListe ?? new Map<string, ResumeMois[]>();
  table.set(signature, resumes);
  cacheResumes.set(transactions, table);
  return resumes;
}
