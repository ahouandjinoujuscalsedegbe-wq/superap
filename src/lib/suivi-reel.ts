/**
 * Suivi des dépenses réelles mois par mois, comparées à ce que la
 * « Prévision mois par mois » annonçait pour ces mêmes mois.
 *
 * Tout est calculé sur l'appareil : pour chaque mois vécu, on rejoue la
 * prévision telle qu'elle aurait été faite au début de ce mois (habitudes
 * observées avant lui + projets futurs saisis + effort d'épargne des
 * objectifs), puis on la confronte aux opérations réellement enregistrées.
 */

import type { Enveloppe, Objectif, Transaction } from "./store";
import { revenuMensuelMoyen } from "./budget-mensuel";
import {
  depenseMensuelleMoyenne,
  effortObjectifs,
  libelleMoisPrevu,
  type ProjetFutur,
} from "./previsions";

export type EcartEnveloppe = {
  enveloppeId: string;
  nom: string;
  emoji: string;
  /** Budget mensuel attendu pour l'enveloppe. */
  prevu: number;
  reel: number;
  ecart: number;
};

export type EcartCategorie = {
  /** Catégorie de dépense (Alimentation, Transport, Loisirs...). */
  categorie: string;
  emoji: string;
  prevu: number;
  reel: number;
  ecart: number;
  /** Part de la catégorie dans les dépenses réelles du mois, en %. */
  part: number;
  /** Enveloppes rattachées à la catégorie. */
  enveloppes: EcartEnveloppe[];
};

export type MoisSuivi = {
  mois: string;
  libelle: string;
  /** Réel observé. */
  revenusReels: number;
  depensesReelles: number;
  netReel: number;
  operations: number;
  /** Prévision reconstituée pour ce mois. */
  revenusPrevus: number;
  depensesPrevues: number;
  netPrevu: number;
  /** depensesReelles - depensesPrevues (positif = dépassement). */
  ecartDepenses: number;
  /** Écart en % des dépenses prévues. */
  ecartPourcent: number;
  statut: "sous" | "conforme" | "depassement";
  /** Mois encore en cours : la comparaison est partielle. */
  enCours: boolean;
  ecartsEnveloppes: EcartEnveloppe[];
  /** Même comparaison, regroupée par catégorie de dépense. */
  ecartsCategories: EcartCategorie[];
};

export type SuiviReel = {
  mois: MoisSuivi[];
  /** Moyenne des écarts de dépenses sur les mois terminés. */
  ecartMoyen: number;
  /** Part des mois terminés respectant la prévision (±10 %). */
  fiabilite: number;
  resume: string;
};

const SEUIL = 0.1;

/** Icône par catégorie usuelle ; repli sur une étiquette neutre. */
const EMOJI_CATEGORIE: Record<string, string> = {
  alimentation: "🍚",
  transport: "🚌",
  loisirs: "🎉",
  logement: "🏠",
  factures: "🧾",
  sante: "💊",
  education: "🎓",
  epargne: "🏦",
  famille: "👪",
  vetements: "👕",
  communication: "📱",
  divers: "📦",
};

function cleCategorie(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function emojiCategorie(nom: string): string {
  return EMOJI_CATEGORIE[cleCategorie(nom)] ?? "🗂️";
}

/** Regroupe les écarts d'enveloppes par catégorie de dépense. */
export function regrouperParCategorie(
  ecarts: EcartEnveloppe[],
  enveloppes: Enveloppe[],
): EcartCategorie[] {
  const categorieDe = new Map(
    enveloppes.map((e) => [e.id, (e.categorie ?? "").trim() || "Non classé"]),
  );
  const groupes = new Map<string, EcartCategorie>();
  for (const e of ecarts) {
    const nom = categorieDe.get(e.enveloppeId) ?? "Non classé";
    const g =
      groupes.get(nom) ??
      ({
        categorie: nom,
        emoji: emojiCategorie(nom),
        prevu: 0,
        reel: 0,
        ecart: 0,
        part: 0,
        enveloppes: [],
      } satisfies EcartCategorie);
    g.prevu += e.prevu;
    g.reel += e.reel;
    g.ecart += e.ecart;
    g.enveloppes.push(e);
    groupes.set(nom, g);
  }
  const total = [...groupes.values()].reduce((s, g) => s + g.reel, 0);
  return [...groupes.values()]
    .map((g) => ({
      ...g,
      part: total > 0 ? Math.round((g.reel / total) * 100) : 0,
      enveloppes: [...g.enveloppes].sort((a, b) => b.reel - a.reel),
    }))
    .sort((a, b) => b.reel - a.reel || Math.abs(b.ecart) - Math.abs(a.ecart));
}

function moisDe(date: string): string {
  return date.slice(0, 7);
}

function fcfa(v: number): string {
  return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
}

function projetsDuMois(projets: ProjetFutur[], mois: string): ProjetFutur[] {
  return projets.filter((p) => (p.recurrent ? p.mois <= mois : p.mois === mois));
}

/** Mois (AAAA-MM) présents dans l'historique, du plus ancien au plus récent. */
export function moisAvecDonnees(transactions: Transaction[]): string[] {
  const set = new Set(transactions.map((t) => moisDe(t.date)));
  return [...set].sort();
}

/**
 * Compare le réel et le prévu, mois par mois.
 * @param limite nombre de mois affichés, en partant du plus récent.
 */
export function suivreDepensesReelles(args: {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  objectifs: Objectif[];
  projets: ProjetFutur[];
  limite?: number;
  maintenant?: Date;
}): SuiviReel {
  const maintenant = args.maintenant ?? new Date();
  const moisCourant = maintenant.toISOString().slice(0, 7);
  const limite = Math.max(1, Math.min(24, args.limite ?? 12));

  const liste = moisAvecDonnees(args.transactions);
  if (!liste.includes(moisCourant)) liste.push(moisCourant);
  const retenus = liste.slice(-limite);

  const parEnveloppe = new Map(args.enveloppes.map((e) => [e.id, e]));
  const mois: MoisSuivi[] = [];

  for (const m of retenus) {
    const anterieures = args.transactions.filter((t) => moisDe(t.date) < m);
    const duMois = args.transactions.filter((t) => moisDe(t.date) === m);

    const revenusReels = duMois
      .filter((t) => t.type === "revenu")
      .reduce((s, t) => s + t.montant, 0);
    const depensesReelles = duMois
      .filter((t) => t.type === "depense")
      .reduce((s, t) => s + t.montant, 0);

    /* Prévision reconstituée : habitudes connues avant ce mois + projets + épargne. */
    const projets = projetsDuMois(args.projets, m);
    const revenusProjets = projets
      .filter((p) => p.sens === "revenu")
      .reduce((s, p) => s + p.montant, 0);
    const depensesProjets = projets
      .filter((p) => p.sens === "depense")
      .reduce((s, p) => s + p.montant, 0);
    const base = anterieures.length > 0 ? anterieures : args.transactions;
    const revenusPrevus = revenuMensuelMoyen(base) + revenusProjets;
    const depensesPrevues =
      Math.round(depenseMensuelleMoyenne(base, args.enveloppes)) +
      depensesProjets +
      Math.round(effortObjectifs(args.objectifs, base, m));

    const ecartDepenses = Math.round(depensesReelles - depensesPrevues);
    const ecartPourcent =
      depensesPrevues > 0 ? Math.round((ecartDepenses / depensesPrevues) * 100) : 0;

    /* Détail par enveloppe : budget attendu contre dépenses réellement imputées. */
    const reelParEnv = new Map<string, number>();
    for (const t of duMois) {
      if (t.type !== "depense") continue;
      reelParEnv.set(t.categorie, (reelParEnv.get(t.categorie) ?? 0) + t.montant);
    }
    const ids = new Set<string>([...reelParEnv.keys(), ...args.enveloppes.map((e) => e.id)]);
    const ecartsEnveloppes: EcartEnveloppe[] = [...ids]
      .map((id) => {
        const e = parEnveloppe.get(id);
        const prevu = Math.round(e?.dotation ?? e?.plafond ?? 0);
        const reel = Math.round(reelParEnv.get(id) ?? 0);
        return {
          enveloppeId: id,
          nom: e?.nom ?? id,
          emoji: e?.emoji ?? "📦",
          prevu,
          reel,
          ecart: reel - prevu,
        };
      })
      .filter((x) => x.prevu > 0 || x.reel > 0)
      .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));

    mois.push({
      mois: m,
      libelle: libelleMoisPrevu(m),
      revenusReels: Math.round(revenusReels),
      depensesReelles: Math.round(depensesReelles),
      netReel: Math.round(revenusReels - depensesReelles),
      operations: duMois.length,
      revenusPrevus: Math.round(revenusPrevus),
      depensesPrevues: Math.round(depensesPrevues),
      netPrevu: Math.round(revenusPrevus - depensesPrevues),
      ecartDepenses,
      ecartPourcent,
      statut:
        Math.abs(ecartPourcent) <= SEUIL * 100
          ? "conforme"
          : ecartDepenses > 0
            ? "depassement"
            : "sous",
      enCours: m === moisCourant,
      ecartsEnveloppes,
      ecartsCategories: regrouperParCategorie(ecartsEnveloppes, args.enveloppes),
    });
  }

  mois.reverse();

  const termines = mois.filter((m) => !m.enCours && m.depensesPrevues > 0);
  const ecartMoyen =
    termines.length > 0
      ? Math.round(termines.reduce((s, m) => s + m.ecartDepenses, 0) / termines.length)
      : 0;
  const fiabilite =
    termines.length > 0
      ? Math.round(
          (termines.filter((m) => m.statut === "conforme").length / termines.length) * 100,
        )
      : 0;

  const resume =
    termines.length === 0
      ? "Pas encore de mois terminé à comparer : la comparaison s'affinera dès le mois prochain."
      : ecartMoyen > 0
        ? `Vous dépensez en moyenne ${fcfa(ecartMoyen)} de plus que prévu chaque mois (${fiabilite} % des mois tenus).`
        : `Vous restez en moyenne ${fcfa(-ecartMoyen)} sous la prévision chaque mois (${fiabilite} % des mois tenus).`;

  return { mois, ecartMoyen, fiabilite, resume };
}
