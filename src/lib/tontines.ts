import { COMPTE_TONTINES, type Objectif, type Transfert } from "@/lib/store";
import { prochaineEcheance } from "@/lib/rappels-objectifs";

/** Un versement de cotisation observé sur le compte « Tontines ». */
export type MouvementTontine = {
  id: string;
  date: string;
  /** Montant du mouvement, positif pour une cotisation entrante. */
  montant: number;
  /** Compte d'où vient l'argent (cotisation) ou qui le reçoit (retrait). */
  contrepartie: string;
  sens: "entree" | "sortie";
  note: string;
};

/** Suivi en temps réel d'une tontine, isolée des autres dans le compte Tontines. */
export type SuiviTontine = {
  objectif: Objectif;
  /** Total cotisé vers le compte Tontines pour cette tontine. */
  cotise: number;
  /** Total ressorti du compte Tontines pour cette tontine (tour reçu, retrait). */
  retire: number;
  /** Part de cette tontine encore présente dans le compte Tontines. */
  solde: number;
  /** Nombre de cotisations enregistrées. */
  tours: number;
  /** Date de la dernière cotisation, si elle existe. */
  dernier: string | null;
  /** Part de la cible déjà cotisée, de 0 à 100. */
  progression: number;
  /** Prochaine cotisation attendue (date et montant), si un rappel est réglé. */
  prochaine: { date: string; montant: number } | null;
  mouvements: MouvementTontine[];
};

/** Rattachement d'un ancien transfert à un objectif d'après sa note. */
function objectifDeLaNote(note: string, objectifs: Objectif[]): string | null {
  const marque = /Objectif:([0-9a-zA-Z-]+)/.exec(note);
  if (marque && objectifs.some((o) => o.id === marque[1])) return marque[1] as string;
  const bas = note.toLowerCase();
  const trouve = objectifs.find((o) => o.libelle && bas.includes(o.libelle.toLowerCase()));
  return trouve ? trouve.id : null;
}

/**
 * Classe le contenu du compte « Tontines » tontine par tontine : chaque
 * cotisation reste rattachée à sa tontine, sans mélange des fonds.
 */
export function suivreTontines(
  objectifs: Objectif[],
  transferts: Transfert[],
  maintenant = new Date(),
): { suivis: SuiviTontine[]; nonClasse: number; total: number } {
  const tontines = objectifs.filter((o) => (o.type ?? "epargne") === "tontine");
  const parObjectif = new Map<string, MouvementTontine[]>();
  tontines.forEach((o) => parObjectif.set(o.id, []));
  let nonClasse = 0;
  let total = 0;

  for (const t of transferts) {
    const entree = t.destination === COMPTE_TONTINES;
    const sortie = t.source === COMPTE_TONTINES;
    if (!entree && !sortie) continue;
    const montant = Math.round(t.montant);
    total += entree ? montant : -montant;
    const id = t.objectifId ?? objectifDeLaNote(t.note ?? "", tontines);
    if (!id || !parObjectif.has(id)) {
      nonClasse += entree ? montant : -montant;
      continue;
    }
    parObjectif.get(id)?.push({
      id: t.id,
      date: t.date,
      montant,
      contrepartie: entree ? t.source : t.destination,
      sens: entree ? "entree" : "sortie",
      note: t.note ?? "",
    });
  }

  const suivis = tontines.map<SuiviTontine>((objectif) => {
    const mouvements = (parObjectif.get(objectif.id) ?? []).sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    const entrees = mouvements.filter((m) => m.sens === "entree");
    const cotise = entrees.reduce((s, m) => s + m.montant, 0);
    const retire = mouvements
      .filter((m) => m.sens === "sortie")
      .reduce((s, m) => s + m.montant, 0);
    const cible = Math.max(0, Math.round(objectif.cible));
    const suivante = prochaineEcheance(objectif, maintenant);
    return {
      objectif,
      cotise,
      retire,
      solde: cotise - retire,
      tours: entrees.length,
      dernier: entrees[0]?.date ?? null,
      progression: cible > 0 ? Math.min(100, Math.round((cotise / cible) * 100)) : 0,
      prochaine: suivante ? { date: suivante.date, montant: Math.round(suivante.montant) } : null,
      mouvements,
    };
  });

  return { suivis, nonClasse, total };
}
