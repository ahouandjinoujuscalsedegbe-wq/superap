import { COMPTE_TONTINES, type Objectif, type Transfert } from "@/lib/store";
import { prochaineEcheance } from "@/lib/rappels-objectifs";

/** Un mouvement observé pour un objectif d'épargne ou d'achat programmé. */
export type MouvementObjectif = {
  id: string;
  date: string;
  montant: number;
  /** Compte d'où vient l'argent (versement) ou qui le reçoit (retrait). */
  contrepartie: string;
  sens: "entree" | "sortie";
  note: string;
};

/** Suivi en temps réel d'un objectif d'épargne ou d'achat programmé. */
export type SuiviObjectif = {
  objectif: Objectif;
  /** Compte qui accueille l'épargne de cet objectif ("" si aucun n'est choisi). */
  compte: string;
  /** Total versé vers le compte d'épargne pour cet objectif. */
  verse: number;
  /** Total ressorti du compte d'épargne pour cet objectif. */
  retire: number;
  /** Part de cet objectif encore présente sur le compte d'épargne. */
  solde: number;
  /** Montant réellement réuni : mise de départ + part restante. */
  reuni: number;
  /** Ce qu'il reste à réunir pour atteindre la cible (0 si atteinte). */
  restant: number;
  /** Nombre de versements enregistrés. */
  versements: number;
  /** Date du dernier versement, si elle existe. */
  dernier: string | null;
  /** Part de la cible déjà réunie, de 0 à 100. */
  progression: number;
  /** Prochain versement attendu (date et montant), si un rappel est réglé. */
  prochain: { date: string; montant: number } | null;
  mouvements: MouvementObjectif[];
};

/** Rattachement d'un transfert à un objectif d'après sa note. */
function objectifDeLaNote(note: string, objectifs: Objectif[]): string | null {
  const marque = /Objectif:([0-9a-zA-Z-]+)/.exec(note);
  if (marque && objectifs.some((o) => o.id === marque[1])) return marque[1] as string;
  const bas = note.toLowerCase();
  const trouve = objectifs.find((o) => o.libelle && bas.includes(o.libelle.toLowerCase()));
  return trouve ? trouve.id : null;
}

/**
 * Classe les mouvements d'épargne objectif par objectif (épargne et achat
 * programmé) : chaque versement reste rattaché à son objectif, sans mélange
 * avec les autres fonds du même compte d'épargne.
 */
export function suivreObjectifs(
  objectifs: Objectif[],
  transferts: Transfert[],
  maintenant = new Date(),
): SuiviObjectif[] {
  const suivis = objectifs.filter((o) => (o.type ?? "epargne") !== "tontine");
  const parObjectif = new Map<string, MouvementObjectif[]>();
  suivis.forEach((o) => parObjectif.set(o.id, []));

  for (const t of transferts) {
    if (t.destination === COMPTE_TONTINES || t.source === COMPTE_TONTINES) continue;
    const id = t.objectifId ?? objectifDeLaNote(t.note ?? "", suivis);
    if (!id || !parObjectif.has(id)) continue;
    const objectif = suivis.find((o) => o.id === id);
    if (!objectif) continue;
    const cible = objectif.compteEpargne ?? "";
    const entree = cible ? t.destination === cible : false;
    const sortie = cible ? t.source === cible : false;
    if (!entree && !sortie) continue;
    parObjectif.get(id)?.push({
      id: t.id,
      date: t.date,
      montant: Math.round(t.montant),
      contrepartie: entree ? t.source : t.destination,
      sens: entree ? "entree" : "sortie",
      note: t.note ?? "",
    });
  }

  return suivis.map<SuiviObjectif>((objectif) => {
    const mouvements = (parObjectif.get(objectif.id) ?? []).sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    const entrees = mouvements.filter((m) => m.sens === "entree");
    const verse = entrees.reduce((s, m) => s + m.montant, 0);
    const retire = mouvements
      .filter((m) => m.sens === "sortie")
      .reduce((s, m) => s + m.montant, 0);
    const solde = verse - retire;
    const reuni = Math.max(0, Math.round(objectif.deja) + solde);
    const cible = Math.max(0, Math.round(objectif.cible));
    const suivant = prochaineEcheance(objectif, maintenant);
    return {
      objectif,
      compte: objectif.compteEpargne ?? "",
      verse,
      retire,
      solde,
      reuni,
      restant: Math.max(0, cible - reuni),
      versements: entrees.length,
      dernier: entrees[0]?.date ?? null,
      progression: cible > 0 ? Math.min(100, Math.round((reuni / cible) * 100)) : 0,
      prochain: suivant ? { date: suivant.date, montant: Math.round(suivant.montant) } : null,
      mouvements,
    };
  });
}
