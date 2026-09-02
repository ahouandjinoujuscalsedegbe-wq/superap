/**
 * Budget auto-proposé : l'application observe les mois écoulés et propose
 * elle-même la dotation de chaque enveloppe pour le mois suivant.
 *
 * Tout est calculé sur l'appareil, à partir des seules opérations validées
 * par l'utilisateur. Aucun service extérieur n'est sollicité.
 */
import type { Enveloppe, Transaction } from "./store";
import { dotationDe } from "./enveloppe-etat";

export type Tendance = "hausse" | "baisse" | "stable";

export type PropositionDotation = {
  enveloppeId: string;
  nom: string;
  emoji: string;
  /** Dotation actuellement enregistrée. */
  actuelle: number;
  /** Dotation proposée pour le mois suivant. */
  proposee: number;
  /** Dépense moyenne observée par mois. */
  moyenne: number;
  /** Nombre de mois réellement observés. */
  moisObserves: number;
  /** Sens d'évolution des dépenses sur cette enveloppe. */
  tendance: Tendance;
  /** true quand la dépense est régulière (charge fixe). */
  reguliere: boolean;
  /** Écart entre la proposition et la dotation actuelle. */
  ecart: number;
  /** Explication en français, affichée à l'utilisateur. */
  raison: string;
};

export type BudgetPropose = {
  propositions: PropositionDotation[];
  /** Total des dotations proposées. */
  totalPropose: number;
  /** Total des dotations actuelles. */
  totalActuel: number;
  /** Revenu mensuel moyen observé. */
  revenuMoyen: number;
  /** true quand les données sont trop maigres pour un vrai conseil. */
  donneesInsuffisantes: boolean;
};

const MOIS_OBSERVES = 6;

function moisDe(iso: string): string {
  return iso.slice(0, 7);
}

function derniersMois(nb: number, reference = new Date()): string[] {
  const out: string[] = [];
  for (let i = 1; i <= nb; i++) {
    const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** Arrondi « humain » : au millier le plus proche, au minimum 500 FCFA. */
function arrondir(montant: number): number {
  if (montant <= 0) return 0;
  if (montant < 1000) return Math.max(500, Math.round(montant / 500) * 500);
  return Math.round(montant / 1000) * 1000;
}

/**
 * Propose une dotation par enveloppe à partir de la dépense moyenne des
 * derniers mois complets, majorée d'une petite marge de sécurité.
 */
export function proposerDotations(
  transactions: Transaction[],
  enveloppes: Enveloppe[],
  reference = new Date(),
): BudgetPropose {
  const mois = derniersMois(MOIS_OBSERVES, reference);
  const cible = new Set(mois);

  const parEnveloppe = new Map<string, Map<string, number>>();
  const revenusParMois = new Map<string, number>();

  for (const t of transactions) {
    const m = moisDe(t.date);
    if (!cible.has(m)) continue;
    if (t.type === "revenu") {
      revenusParMois.set(m, (revenusParMois.get(m) ?? 0) + t.montant);
      continue;
    }
    const carte = parEnveloppe.get(t.categorie) ?? new Map<string, number>();
    carte.set(m, (carte.get(m) ?? 0) + t.montant);
    parEnveloppe.set(t.categorie, carte);
  }

  const moisAvecDonnees = new Set<string>();
  for (const carte of parEnveloppe.values()) for (const m of carte.keys()) moisAvecDonnees.add(m);
  for (const m of revenusParMois.keys()) moisAvecDonnees.add(m);

  const memoire = chargerPreferencesBudget();

  const propositions: PropositionDotation[] = enveloppes.map((e) => {
    const carte = parEnveloppe.get(e.id) ?? new Map<string, number>();
    // Les mois sont rangés du plus récent au plus ancien : on pondère les
    // mois récents plus fortement, car ils décrivent mieux les habitudes
    // actuelles de l'utilisateur.
    const valeurs = mois.map((m) => carte.get(m) ?? 0);
    const observes = valeurs.filter((v) => v > 0).length;
    let sommePond = 0;
    let poidsTotal = 0;
    valeurs.forEach((v, i) => {
      if (v <= 0) return;
      const poids = 1 / (i + 1);
      sommePond += v * poids;
      poidsTotal += poids;
    });
    const moyenne = poidsTotal > 0 ? sommePond / poidsTotal : 0;
    const maxi = Math.max(0, ...valeurs);
    const actuelle = dotationDe(e);

    // Tendance : trois derniers mois observés contre les précédents.
    const recents = valeurs.slice(0, 3).filter((v) => v > 0);
    const anciens = valeurs.slice(3).filter((v) => v > 0);
    const moyRecent = recents.length ? recents.reduce((s, v) => s + v, 0) / recents.length : 0;
    const moyAncien = anciens.length ? anciens.reduce((s, v) => s + v, 0) / anciens.length : 0;
    const tendance: Tendance =
      moyAncien > 0 && moyRecent > 0
        ? moyRecent > moyAncien * 1.15
          ? "hausse"
          : moyRecent < moyAncien * 0.85
            ? "baisse"
            : "stable"
        : "stable";

    // Régularité : une enveloppe payée chaque mois avec un montant proche
    // est une charge fixe, on ne lui ajoute pas de marge de sécurité.
    // L'écart-type se mesure autour de la moyenne des mois observés
    // (et non autour de la moyenne des seuls mois récents).
    const observees = valeurs.filter((v) => v > 0);
    const moyenneSimple = observees.length
      ? observees.reduce((s, v) => s + v, 0) / observees.length
      : 0;
    const ecartType =
      observes > 1
        ? Math.sqrt(
            observees.reduce((s, v) => s + (v - moyenneSimple) ** 2, 0) / observees.length,
          )
        : 0;
    const reguliere = observes >= 3 && moyenneSimple > 0 && ecartType / moyenneSimple < 0.15;


    const marge = reguliere ? 1.02 : tendance === "hausse" ? 1.15 : 1.08;
    let base = observes === 0 ? actuelle : Math.max(moyenne * marge, maxi * (reguliere ? 1 : 0.9));

    // Apprentissage : si l'utilisateur a déjà corrigé cette enveloppe à la
    // main, le moteur applique le même sens de correction la fois suivante.
    const appris = memoire[e.id];
    if (appris && observes > 0 && appris.facteur > 0) base *= appris.facteur;

    const proposee = arrondir(base);

    const raisonBase =
      observes === 0
        ? "Aucune dépense observée : la dotation actuelle est conservée."
        : observes === 1
          ? `Un seul mois observé (${Math.round(moyenne).toLocaleString("fr-FR")} FCFA) : proposition prudente.`
          : reguliere
            ? `Charge régulière sur ${observes} mois (${Math.round(moyenne).toLocaleString("fr-FR")} FCFA) : montant conservé au plus juste.`
            : `Moyenne pondérée de ${observes} mois : ${Math.round(moyenne).toLocaleString("fr-FR")} FCFA, marge de sécurité incluse.`;

    const raisonTendance =
      tendance === "hausse"
        ? " Vos dépenses augmentent sur cette enveloppe."
        : tendance === "baisse"
          ? " Vos dépenses diminuent sur cette enveloppe."
          : "";

    const raisonAppris = appris ? " Ajusté selon vos corrections précédentes." : "";

    return {
      enveloppeId: e.id,
      nom: e.nom,
      emoji: e.emoji,
      actuelle,
      proposee,
      moyenne: Math.round(moyenne),
      moisObserves: observes,
      tendance,
      reguliere,
      ecart: proposee - actuelle,
      raison: `${raisonBase}${raisonTendance}${raisonAppris}`,
    };
  });

  const revenus = [...revenusParMois.values()];
  const revenuMoyen =
    revenus.length > 0 ? Math.round(revenus.reduce((s, v) => s + v, 0) / revenus.length) : 0;

  return {
    propositions,
    totalPropose: propositions.reduce((s, p) => s + p.proposee, 0),
    totalActuel: propositions.reduce((s, p) => s + p.actuelle, 0),
    revenuMoyen,
    donneesInsuffisantes: moisAvecDonnees.size === 0,
  };
}

/**
 * Ajuste les propositions pour qu'elles tiennent dans le revenu moyen :
 * si le total dépasse, chaque enveloppe est réduite proportionnellement.
 */
export function ajusterAuRevenu(budget: BudgetPropose): BudgetPropose {
  if (budget.revenuMoyen <= 0 || budget.totalPropose <= budget.revenuMoyen) return budget;
  const facteur = budget.revenuMoyen / budget.totalPropose;
  const propositions = budget.propositions.map((p) => {
    const proposee = arrondir(p.proposee * facteur);
    return {
      ...p,
      proposee,
      ecart: proposee - p.actuelle,
      raison: `${p.raison} Réduit pour tenir dans le revenu moyen.`,
    };
  });
  return {
    ...budget,
    propositions,
    totalPropose: propositions.reduce((s, p) => s + p.proposee, 0),
  };
}


/* ------------------------------------------------------------------ *
 * Apprentissage local des corrections de l'utilisateur
 * ------------------------------------------------------------------ */

const CLE_PREFERENCES = "superapp.budget.preferences";

export type PreferenceBudget = {
  /** Rapport entre le montant retenu par l'utilisateur et celui proposé. */
  facteur: number;
  /** Nombre de corrections observées. */
  corrections: number;
  /** Dernière correction (ISO). */
  le: string;
};

export function chargerPreferencesBudget(): Record<string, PreferenceBudget> {
  if (typeof window === "undefined") return {};
  try {
    const brut = window.localStorage.getItem(CLE_PREFERENCES);
    return brut ? (JSON.parse(brut) as Record<string, PreferenceBudget>) : {};
  } catch {
    return {};
  }
}

/**
 * Mémorise la façon dont l'utilisateur corrige les propositions afin que le
 * moteur s'en approche de lui-même les mois suivants.
 */
export function apprendreCorrections(
  corrections: { enveloppeId: string; proposee: number; retenue: number }[],
): void {
  if (typeof window === "undefined") return;
  const memoire = chargerPreferencesBudget();
  for (const c of corrections) {
    if (c.proposee <= 0 || c.retenue <= 0) continue;
    const brut = c.retenue / c.proposee;
    if (!Number.isFinite(brut) || brut <= 0) continue;
    // On borne l'apprentissage pour éviter les emballements.
    const facteurObserve = Math.min(2, Math.max(0.5, brut));
    const ancien = memoire[c.enveloppeId];
    const facteur = ancien
      ? (ancien.facteur * ancien.corrections + facteurObserve) / (ancien.corrections + 1)
      : facteurObserve;
    memoire[c.enveloppeId] = {
      facteur: Math.round(facteur * 1000) / 1000,
      corrections: (ancien?.corrections ?? 0) + 1,
      le: new Date().toISOString(),
    };
  }
  try {
    window.localStorage.setItem(CLE_PREFERENCES, JSON.stringify(memoire));
  } catch {
    /* stockage saturé : l'apprentissage reprendra plus tard */
  }
}
