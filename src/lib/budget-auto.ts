/**
 * Budget auto-proposé : l'application observe les mois écoulés et propose
 * elle-même la dotation de chaque enveloppe pour le mois suivant.
 *
 * Tout est calculé sur l'appareil, à partir des seules opérations validées
 * par l'utilisateur. Aucun service extérieur n'est sollicité.
 */
import type { Enveloppe, Transaction } from "./store";
import { dotationDe } from "./enveloppe-etat";

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

const MOIS_OBSERVES = 3;

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

  const propositions: PropositionDotation[] = enveloppes.map((e) => {
    const carte = parEnveloppe.get(e.id) ?? new Map<string, number>();
    const valeurs = mois.map((m) => carte.get(m) ?? 0);
    const observes = valeurs.filter((v) => v > 0).length;
    const moyenne = observes > 0 ? valeurs.reduce((s, v) => s + v, 0) / Math.max(1, observes) : 0;
    const maxi = Math.max(0, ...valeurs);
    const actuelle = dotationDe(e);

    // Base : moyenne majorée de 10 %, sans jamais descendre sous le plus gros
    // mois observé diminué de 10 % (pour absorber les mois irréguliers).
    const base = observes === 0 ? actuelle : Math.max(moyenne * 1.1, maxi * 0.9);
    const proposee = arrondir(base);

    const raison =
      observes === 0
        ? "Aucune dépense observée : la dotation actuelle est conservée."
        : observes === 1
          ? `Un seul mois observé (${Math.round(moyenne).toLocaleString("fr-FR")} FCFA) : proposition prudente.`
          : `Moyenne de ${observes} mois : ${Math.round(moyenne).toLocaleString("fr-FR")} FCFA, marge de sécurité incluse.`;

    return {
      enveloppeId: e.id,
      nom: e.nom,
      emoji: e.emoji,
      actuelle,
      proposee,
      moyenne: Math.round(moyenne),
      moisObserves: observes,
      ecart: proposee - actuelle,
      raison,
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
