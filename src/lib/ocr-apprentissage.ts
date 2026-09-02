/**
 * Apprentissage local de la lecture des tickets et factures photographiés.
 *
 * À chaque enregistrement, on compare ce que la lecture automatique avait
 * proposé et ce que l'utilisateur a finalement validé. Les écarts deviennent
 * des règles mémorisées par commerçant : montant à privilégier (total, somme
 * des articles, paiement…), libellé propre, type d'opération et enveloppe.
 * Tout reste dans l'appareil, aucun envoi vers l'extérieur.
 */

import {
  montantsDeLigne,
  sansAccents,
  structurerTicket,
  type OperationExtraite,
} from "@/lib/extraction";

const CLE = "superapp:ocr:apprentissage:v1";

export type SourceMontant = NonNullable<OperationExtraite["sourceMontant"]>;

export type RegleCommercant = {
  /** Libellé propre validé par l'utilisateur. */
  libelle: string;
  /** Mots repérés dans le ticket qui identifient ce commerçant. */
  motsCles: string[];
  type: "revenu" | "depense";
  enveloppe?: string;
  compte?: string;
  /** Provenance du montant qui s'est révélée juste le plus souvent. */
  sourcePreferee?: SourceMontant;
  validations: number;
  corrections: number;
  majAt: string;
};

export type MemoireOcr = {
  regles: Record<string, RegleCommercant>;
  stats: {
    lectures: number;
    sansCorrection: number;
    corrigees: number;
    montantsCorriges: number;
    libellesCorriges: number;
    enveloppesCorrigees: number;
  };
  /** Tickets jamais compris (aucun montant fiable) à enseigner. */
  echecs: { texte: string; date: string }[];
};

const VIDE: MemoireOcr = {
  regles: {},
  stats: {
    lectures: 0,
    sansCorrection: 0,
    corrigees: 0,
    montantsCorriges: 0,
    libellesCorriges: 0,
    enveloppesCorrigees: 0,
  },
  echecs: [],
};

const MOTS_OUTILS = new Set([
  "total",
  "ticket",
  "facture",
  "client",
  "merci",
  "visite",
  "date",
  "caisse",
  "sarl",
  "sa",
  "shop",
  "boutique",
  "magasin",
  "recu",
  "vente",
]);

/** Clé stable d'un commerçant à partir de son libellé. */
export function cleTicket(libelle: string): string {
  return sansAccents(libelle)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/** Mots significatifs du ticket, utilisés pour reconnaître le commerçant. */
export function motsCles(texte: string, maximum = 8): string[] {
  const mots = sansAccents(texte)
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length >= 4 && !MOTS_OUTILS.has(m));
  const uniques: string[] = [];
  for (const m of mots) {
    if (!uniques.includes(m)) uniques.push(m);
    if (uniques.length >= maximum) break;
  }
  return uniques;
}

/** Stockage local disponible (navigateur ou environnement de test). */
function stockage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage;
  } catch {
    return undefined;
  }
}

export function lireMemoireOcr(): MemoireOcr {
  const local = stockage();
  if (!local) return { ...VIDE, regles: {}, echecs: [] };
  try {
    const brut = local.getItem(CLE);
    if (!brut) return { ...VIDE, regles: {}, echecs: [] };
    const lu = JSON.parse(brut) as Partial<MemoireOcr>;
    return {
      regles: lu.regles ?? {},
      stats: { ...VIDE.stats, ...(lu.stats ?? {}) },
      echecs: Array.isArray(lu.echecs) ? lu.echecs : [],
    };
  } catch {
    return { ...VIDE, regles: {}, echecs: [] };
  }
}

function ecrire(memoire: MemoireOcr): MemoireOcr {
  const local = stockage();
  if (!local) return memoire;
  try {
    local.setItem(CLE, JSON.stringify(memoire));
  } catch {
    /* quota dépassé : l'apprentissage reste optionnel */
  }
  return memoire;
}

export function reinitialiserApprentissageOcr(): MemoireOcr {
  return ecrire({ ...VIDE, regles: {}, echecs: [] });
}

export function oublierRegleOcr(cle: string): MemoireOcr {
  const memoire = lireMemoireOcr();
  delete memoire.regles[cle];
  return ecrire(memoire);
}

/** Retrouve la règle apprise correspondant à un ticket. */
export function trouverRegle(
  texte: string,
  libelle: string,
  memoire = lireMemoireOcr(),
): { cle: string; regle: RegleCommercant } | undefined {
  const cle = cleTicket(libelle);
  const direct = memoire.regles[cle];
  if (direct) return { cle, regle: direct };

  const contenu = sansAccents(texte);
  let meilleur: { cle: string; regle: RegleCommercant; score: number } | undefined;
  for (const [k, regle] of Object.entries(memoire.regles)) {
    const communs = regle.motsCles.filter((m) => contenu.includes(m)).length;
    const proche = k.length >= 4 && (cle.includes(k) || k.includes(cle));
    const score = communs * 2 + (proche ? 3 : 0) + Math.min(3, regle.validations);
    if (communs === 0 && !proche) continue;
    if (!meilleur || score > meilleur.score) meilleur = { cle: k, regle, score };
  }
  return meilleur ? { cle: meilleur.cle, regle: meilleur.regle } : undefined;
}

/** Montants candidats du ticket, classés par provenance. */
export function candidatsParSource(texte: string): Partial<Record<SourceMontant, number>> {
  const s = structurerTicket(texte);
  const candidats: Partial<Record<SourceMontant, number>> = {};
  if (s.totalAnnonce !== null) candidats.total = s.totalAnnonce;
  if (s.especes !== null && s.rendu !== null && s.especes - s.rendu > 0)
    candidats.paiement = s.especes - s.rendu;
  if (s.articles.length >= 2)
    candidats.articles = s.articles.reduce((somme, a) => somme + a.montant, 0);
  const tous = s.lignes.flatMap(montantsDeLigne).filter((v) => v >= 10);
  if (tous.length > 0) candidats.maximum = Math.max(...tous);
  return candidats;
}

export type OperationAmelioree = OperationExtraite & {
  /** Ce que l'expérience passée a modifié dans la proposition. */
  ajustements: string[];
  /** Nombre de fois où ce commerçant a déjà été validé. */
  experience: number;
};

/**
 * Applique les règles apprises à une proposition de lecture : montant issu de
 * la bonne provenance, libellé propre, type et enveloppe habituels.
 */
export function appliquerApprentissage(
  extrait: OperationExtraite,
  texte: string,
  memoire = lireMemoireOcr(),
): OperationAmelioree {
  const trouve = trouverRegle(texte, extrait.libelle, memoire);
  if (!trouve) return { ...extrait, ajustements: [], experience: 0 };

  const { regle } = trouve;
  const ajustements: string[] = [];
  const resultat: OperationAmelioree = { ...extrait, ajustements, experience: regle.validations };

  if (regle.sourcePreferee && regle.sourcePreferee !== extrait.sourceMontant) {
    const candidats = candidatsParSource(texte);
    const valeur = candidats[regle.sourcePreferee];
    if (valeur && valeur > 0 && valeur !== extrait.montant) {
      resultat.montant = valeur;
      resultat.sourceMontant = regle.sourcePreferee;
      resultat.explicationMontant = `Montant repris de « ${etiquetteSource(regle.sourcePreferee)} », comme vous l'aviez corrigé pour ${regle.libelle}.`;
      ajustements.push(`Montant recalculé (${etiquetteSource(regle.sourcePreferee)})`);
    }
  }

  if (regle.libelle && cleTicket(regle.libelle) !== cleTicket(extrait.libelle)) {
    resultat.libelle = regle.libelle;
    ajustements.push(`Libellé « ${regle.libelle} »`);
  }

  if (regle.type !== extrait.type) {
    resultat.type = regle.type;
    ajustements.push(regle.type === "revenu" ? "Classé en revenu" : "Classé en dépense");
  }

  if (regle.enveloppe) {
    resultat.indiceEnveloppe = regle.enveloppe;
    ajustements.push("Enveloppe habituelle");
  }

  // L'expérience augmente la confiance, sans jamais atteindre la certitude.
  const bonus = Math.min(0.25, regle.validations * 0.05);
  resultat.confiance = Math.min(0.98, Number((extrait.confiance + bonus).toFixed(2)));
  return resultat;
}

export function etiquetteSource(source: SourceMontant): string {
  switch (source) {
    case "total":
      return "total du ticket";
    case "paiement":
      return "espèces − monnaie rendue";
    case "articles":
      return "somme des articles";
    case "devise":
      return "montant en FCFA";
    case "maximum":
      return "plus grand montant lu";
    case "mots":
      return "montant en lettres";
    default:
      return "lecture directe";
  }
}

export type ValidationTicket = {
  texte: string;
  propose: {
    montant: number;
    libelle: string;
    type: "revenu" | "depense";
    enveloppe?: string;
    sourceMontant?: SourceMontant;
  };
  valide: {
    montant: number;
    libelle: string;
    type: "revenu" | "depense";
    enveloppe?: string;
    compte?: string;
  };
};

/**
 * Enregistre une leçon : ce qui avait été proposé et ce qui a été validé.
 * Retourne la mémoire mise à jour.
 */
export function apprendreTicket(entree: ValidationTicket, memoire = lireMemoireOcr()): MemoireOcr {
  const { texte, propose, valide } = entree;
  const cle = cleTicket(valide.libelle) || cleTicket(propose.libelle);
  if (!cle) return memoire;

  const montantCorrige = Math.abs(valide.montant - propose.montant) > 1;
  const libelleCorrige = cleTicket(valide.libelle) !== cleTicket(propose.libelle);
  const enveloppeCorrigee = Boolean(valide.enveloppe) && valide.enveloppe !== propose.enveloppe;
  const typeCorrige = valide.type !== propose.type;
  const corrige = montantCorrige || libelleCorrige || enveloppeCorrigee || typeCorrige;

  memoire.stats.lectures += 1;
  if (corrige) memoire.stats.corrigees += 1;
  else memoire.stats.sansCorrection += 1;
  if (montantCorrige) memoire.stats.montantsCorriges += 1;
  if (libelleCorrige) memoire.stats.libellesCorriges += 1;
  if (enveloppeCorrigee) memoire.stats.enveloppesCorrigees += 1;

  const existante = memoire.regles[cle] ?? trouverRegle(texte, valide.libelle, memoire)?.regle;

  // Quelle provenance donnait le montant validé ? Elle devient la préférée.
  let sourcePreferee = existante?.sourcePreferee;
  if (montantCorrige) {
    const candidats = candidatsParSource(texte);
    const juste = (Object.entries(candidats) as [SourceMontant, number][]).find(
      ([, v]) => Math.abs(v - valide.montant) <= 1,
    );
    if (juste) sourcePreferee = juste[0];
  } else if (propose.sourceMontant && propose.sourceMontant !== "aucun") {
    sourcePreferee = propose.sourceMontant;
  }

  const cles = motsCles(texte);
  memoire.regles[cle] = {
    libelle: valide.libelle.trim() || existante?.libelle || propose.libelle,
    motsCles: Array.from(new Set([...(existante?.motsCles ?? []), ...cles])).slice(0, 12),
    type: valide.type,
    ...(valide.enveloppe ? { enveloppe: valide.enveloppe } : {}),
    ...(valide.compte ? { compte: valide.compte } : {}),
    ...(sourcePreferee ? { sourcePreferee } : {}),
    validations: (existante?.validations ?? 0) + (corrige ? 0 : 1),
    corrections: (existante?.corrections ?? 0) + (corrige ? 1 : 0),
    majAt: new Date().toISOString(),
  };

  if (propose.montant <= 0) {
    memoire.echecs = [
      { texte: texte.slice(0, 400), date: new Date().toISOString() },
      ...memoire.echecs,
    ].slice(0, 15);
  }

  return ecrire(memoire);
}

export type FiabiliteOcr = {
  lectures: number;
  tauxSansCorrection: number;
  regles: number;
  montantsCorriges: number;
  libellesCorriges: number;
  enveloppesCorrigees: number;
  echecs: number;
  conseil: string;
};

export function fiabiliteOcr(memoire = lireMemoireOcr()): FiabiliteOcr {
  const { lectures, sansCorrection } = memoire.stats;
  const taux = lectures > 0 ? Math.round((sansCorrection / lectures) * 100) : 0;
  const regles = Object.keys(memoire.regles).length;
  let conseil: string;
  if (lectures === 0) conseil = "Photographiez un premier ticket pour lancer l'apprentissage.";
  else if (taux >= 85)
    conseil = "La lecture est fiable : continuez simplement à valider vos tickets.";
  else if (memoire.stats.montantsCorriges > memoire.stats.libellesCorriges)
    conseil = "Corrigez le montant avant d'enregistrer : la bonne ligne du ticket sera mémorisée.";
  else
    conseil = "Corrigez libellé et enveloppe avant d'enregistrer pour accélérer l'apprentissage.";
  return {
    lectures,
    tauxSansCorrection: taux,
    regles,
    montantsCorriges: memoire.stats.montantsCorriges,
    libellesCorriges: memoire.stats.libellesCorriges,
    enveloppesCorrigees: memoire.stats.enveloppesCorrigees,
    echecs: memoire.echecs.length,
    conseil,
  };
}
