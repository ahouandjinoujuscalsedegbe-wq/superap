/**
 * Validation et assainissement des données métier.
 *
 * Ce module est la seule porte d'entrée autorisée pour les données qui
 * arrivent dans l'état de l'application, quelle que soit leur provenance :
 * formulaires, synchronisation chiffrée, import de sauvegarde, restauration.
 *
 * Objectif : il devient impossible d'introduire un montant négatif, un NaN,
 * une date invalide ou un texte démesuré, même par un colis de synchronisation
 * forgé par un tiers.
 */

import type {
  Budget,
  CategorieEnveloppe,
  Dette,
  Enveloppe,
  Remboursement,
  Transaction,
  Transfert,
} from "./store";

/** Plafond de sécurité : 1 000 milliards de FCFA. */
export const MONTANT_MAX = 1_000_000_000_000;
const TEXTE_MAX = 200;
const LISTE_MAX = 20_000;

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** true si le montant est un nombre fini, strictement positif et raisonnable. */
export function montantValide(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MONTANT_MAX;
}

/** true si le montant est un nombre fini, positif ou nul, et raisonnable. */
export function montantPositifOuNul(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MONTANT_MAX;
}

/** Ramène une valeur quelconque à un nombre sûr (0 par défaut). */
export function nombreSur(v: unknown, defaut = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return defaut;
  return Math.min(Math.max(n, 0), MONTANT_MAX);
}

/** Nettoie un texte : chaîne, sans espaces superflus, longueur bornée. */
export function texteSur(v: unknown, max = TEXTE_MAX): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

/** true si la valeur est un identifiant exploitable. */
export function idValide(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= 100;
}

/** Normalise une date en ISO ; renvoie null si la date est inexploitable. */
export function dateSure(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  // Bornes raisonnables : 1990 → 2100.
  if (t < Date.UTC(1990, 0, 1) || t > Date.UTC(2100, 0, 1)) return null;
  return v;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/* ------------------------------------------------------------------ */
/* Assainissement des entités                                          */
/* ------------------------------------------------------------------ */

export function assainirTransaction(v: unknown): Transaction | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const montant = nombreSur(v["montant"]);
  if (!montantValide(montant)) return null;
  const date = dateSure(v["date"]);
  if (!date) return null;
  const type = v["type"] === "revenu" || v["type"] === "depense" ? v["type"] : null;
  if (!type) return null;
  const t: Transaction = {
    id: v["id"],
    type,
    montant,
    libelle: texteSur(v["libelle"]),
    categorie: texteSur(v["categorie"]),
    compte: texteSur(v["compte"], 60),
    date,
  };
  if (idValide(v["budgetId"])) t.budgetId = v["budgetId"];
  if (idValide(v["detteId"])) t.detteId = v["detteId"];
  return t;
}

export function assainirTransfert(v: unknown): Transfert | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const montant = nombreSur(v["montant"]);
  if (!montantValide(montant)) return null;
  const date = dateSure(v["date"]);
  if (!date) return null;
  const source = texteSur(v["source"], 60);
  const destination = texteSur(v["destination"], 60);
  if (!source || !destination || source === destination) return null;
  return { id: v["id"], source, destination, montant, note: texteSur(v["note"]), date };
}

export function assainirEnveloppe(v: unknown): Enveloppe | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const nom = texteSur(v["nom"], 80);
  if (!nom) return null;
  const plafond = nombreSur(v["plafond"]);
  const dotation = typeof v["dotation"] === "number" ? nombreSur(v["dotation"]) : plafond;
  return {
    id: v["id"],
    nom,
    emoji: texteSur(v["emoji"], 8) || "📦",
    plafond,
    dotation,
    categorie: texteSur(v["categorie"], 80),
    sousCategorie: texteSur(v["sousCategorie"], 80),
  };
}

export function assainirCategorie(v: unknown): CategorieEnveloppe | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const nom = texteSur(v["nom"], 80);
  if (!nom) return null;
  const brut = Array.isArray(v["sousCategories"]) ? v["sousCategories"] : [];
  const sousCategories = Array.from(
    new Set(brut.map((s) => texteSur(s, 80)).filter((s) => s !== "")),
  ).slice(0, 200);
  return { id: v["id"], nom, sousCategories };
}

const PERIODES_VALIDES = ["jour", "semaine", "mois", "trimestre", "semestre", "annee"] as const;

export function assainirBudget(v: unknown): Budget | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const montant = nombreSur(v["montant"]);
  if (!montantValide(montant)) return null;
  const periode = PERIODES_VALIDES.find((p) => p === v["periode"]);
  if (!periode) return null;
  const prochaine = dateSure(v["prochaine"]);
  if (!prochaine) return null;
  const b: Budget = {
    id: v["id"],
    libelle: texteSur(v["libelle"]),
    enveloppeId: texteSur(v["enveloppeId"], 100),
    montant,
    periode,
    compte: texteSur(v["compte"], 60),
    prochaine,
    actif: v["actif"] !== false,
  };
  const debut = dateSure(v["debut"]);
  if (debut) b.debut = debut;
  const fin = dateSure(v["fin"]);
  if (fin) b.fin = fin;
  if (typeof v["ponctuel"] === "boolean") b.ponctuel = v["ponctuel"];
  const intervalle = Math.round(nombreSur(v["intervalle"], 1));
  if (intervalle >= 1 && intervalle <= 365) b.intervalle = intervalle;
  return b;
}

export function assainirRemboursement(v: unknown): Remboursement | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const montant = nombreSur(v["montant"]);
  if (!montantValide(montant)) return null;
  const date = dateSure(v["date"]);
  if (!date) return null;
  const r: Remboursement = { id: v["id"], montant, date };
  const note = texteSur(v["note"]);
  if (note) r.note = note;
  return r;
}

export function assainirDette(v: unknown): Dette | null {
  if (!estObjet(v) || !idValide(v["id"])) return null;
  const montantInitial = nombreSur(v["montantInitial"]);
  if (!montantValide(montantInitial)) return null;
  const sens = v["sens"] === "dette" || v["sens"] === "creance" ? v["sens"] : null;
  if (!sens) return null;
  const personne = texteSur(v["personne"], 80);
  if (!personne) return null;
  const brut = Array.isArray(v["remboursements"]) ? v["remboursements"] : [];
  const remboursements = brut
    .map(assainirRemboursement)
    .filter((r): r is Remboursement => r !== null)
    .slice(0, 1000);
  const d: Dette = {
    id: v["id"],
    personne,
    sens,
    montantInitial,
    creeLe: dateSure(v["creeLe"]) ?? new Date().toISOString().slice(0, 10),
    remboursements,
  };
  const note = texteSur(v["note"]);
  if (note) d.note = note;
  const dateLimite = dateSure(v["dateLimite"]);
  if (dateLimite) d.dateLimite = dateLimite;
  return d;
}

/** Nettoie une liste de noms de comptes (uniques, non vides, bornée). */
export function assainirComptes(v: unknown): string[] {
  const brut = Array.isArray(v) ? v : [];
  return Array.from(new Set(brut.map((c) => texteSur(c, 60)).filter((c) => c !== ""))).slice(0, 200);
}

/** Applique un assainisseur à une liste inconnue et retire les éléments invalides. */
export function assainirListe<T>(v: unknown, f: (x: unknown) => T | null): T[] {
  const brut = Array.isArray(v) ? v : [];
  const out: T[] = [];
  for (const x of brut.slice(0, LISTE_MAX)) {
    const propre = f(x);
    if (propre) out.push(propre);
  }
  return out;
}
