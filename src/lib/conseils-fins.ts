/**
 * Conseils fins : détection de ce qui mérite l'attention de l'utilisateur.
 *
 * Au-delà des bilans, ce module repère dans les opérations récentes :
 *  - les dépenses inhabituelles (nettement au-dessus de l'habitude du poste) ;
 *  - les petites fuites : de petits montants répétés qui, additionnés,
 *    pèsent lourd sur le mois ;
 *  - les économies possibles : les enveloppes qui gardent un surplus
 *    confortable en fin de mois, à rediriger vers un objectif ;
 *  - les revenus irréguliers, pour baser le budget sur le revenu prudent.
 *
 * Chaque conseil est chiffré et actionnable. Tout reste sur l'appareil.
 */
import type { DonneesUnifiees } from "./ia-unifiee";

const JOUR_MS = 86_400_000;

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function joursDepuis(date: string, maintenant: Date): number {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((maintenant.getTime() - t) / JOUR_MS);
}

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0
    ? ((triees[milieu - 1] ?? 0) + (triees[milieu] ?? 0)) / 2
    : (triees[milieu] ?? 0);
}

/**
 * Produit les conseils fins du moment, du plus important au plus léger.
 * Renvoie une liste vide quand rien de notable n'est détecté.
 */
export function conseilsFins(donnees: DonneesUnifiees, maintenant = new Date()): string[] {
  const conseils: string[] = [];
  const depenses = donnees.transactions.filter((t) => t.type === "depense");
  const recentes = depenses.filter((t) => joursDepuis(t.date, maintenant) <= 30);
  const nomEnveloppe = new Map(donnees.enveloppes.map((e) => [e.id, e.nom]));
  const nomPoste = (cle: string) => nomEnveloppe.get(cle) ?? (cle || "Divers");

  /* 1. Dépenses inhabituelles : au moins 2,5× la médiane du même poste,
        avec un plancher pour ne pas crier pour 200 FCFA. */
  const parPoste = new Map<string, number[]>();
  for (const t of depenses) {
    const cle = t.categorie || "divers";
    const liste = parPoste.get(cle) ?? [];
    liste.push(Math.abs(t.montant));
    parPoste.set(cle, liste);
  }
  const inhabituelles: { libelle: string; poste: string; montant: number; habitude: number }[] =
    [];
  for (const t of recentes) {
    const cle = t.categorie || "divers";
    const montant = Math.abs(t.montant);
    const historique = (parPoste.get(cle) ?? []).filter((v) => Math.abs(v - montant) > 1);
    if (historique.length < 3) continue;
    const habitude = mediane(historique);
    if (habitude >= 500 && montant >= Math.max(2.5 * habitude, habitude + 2000)) {
      inhabituelles.push({
        libelle: t.libelle || "Sans libellé",
        poste: nomPoste(cle),
        montant,
        habitude,
      });
    }
  }
  for (const u of inhabituelles
    .sort((a, b) => b.montant / b.habitude - a.montant / a.habitude)
    .slice(0, 3)) {
    conseils.push(
      `Dépense inhabituelle : « ${u.libelle} » à ${fcfa(u.montant)} dans ${u.poste}, soit ${
        Math.round((u.montant / u.habitude) * 10) / 10
      }× votre habitude (${fcfa(u.habitude)}). Était-ce prévu ?`,
    );
  }

  /* 2. Petites fuites : même libellé répété en petits montants dont le total
        mensuel devient significatif. */
  const petites = new Map<string, { fois: number; total: number; poste: string }>();
  for (const t of recentes) {
    const montant = Math.abs(t.montant);
    if (montant > 3000) continue;
    const cle = (t.libelle || "sans libelle")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30);
    if (cle.length < 3) continue;
    const entree = petites.get(cle) ?? { fois: 0, total: 0, poste: nomPoste(t.categorie) };
    entree.fois += 1;
    entree.total += montant;
    petites.set(cle, entree);
  }
  for (const [libelle, p] of [...petites.entries()]
    .filter(([, p]) => p.fois >= 4 && p.total >= 4000)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 2)) {
    conseils.push(
      `Petite fuite possible : « ${libelle} » revient ${p.fois} fois ce mois-ci pour ${fcfa(
        p.total,
      )} au total (${p.poste}). De petits montants répétés finissent par peser.`,
    );
  }

  /* 3. Économies possibles : enveloppes avec un surplus confortable tard dans
        le mois, alors qu'un objectif d'épargne existe. */
  const jourDuMois = maintenant.getDate();
  if (jourDuMois >= 20 && donnees.objectifs.length > 0) {
    const surplus = donnees.enveloppes
      .map((e) => {
        const dotation = e.dotation ?? e.plafond ?? 0;
        const utilise = donnees.depensesParEnveloppe[e.id] ?? 0;
        return { nom: e.nom, restant: dotation - utilise, dotation };
      })
      .filter((l) => l.dotation > 0 && l.restant / l.dotation >= 0.35 && l.restant >= 5000)
      .sort((a, b) => b.restant - a.restant);
    const premier = surplus[0];
    if (premier) {
      conseils.push(
        `Économie possible : l'enveloppe ${premier.nom} garde ${fcfa(
          premier.restant,
        )} en fin de mois. Vous pourriez verser ce surplus à un objectif plutôt que le laisser fondre.`,
      );
    }
  }

  /* 4. Revenus irréguliers : forte variation d'un mois à l'autre. */
  const revenus = donnees.transactions.filter((t) => t.type === "revenu");
  const parMois = new Map<string, number>();
  for (const t of revenus) {
    const mois = t.date.slice(0, 7);
    parMois.set(mois, (parMois.get(mois) ?? 0) + Math.abs(t.montant));
  }
  const mensuels = [...parMois.values()];
  if (mensuels.length >= 3) {
    const min = Math.min(...mensuels);
    const max = Math.max(...mensuels);
    if (min > 0 && max / min >= 1.8) {
      conseils.push(
        `Revenus irréguliers : entre ${fcfa(min)} et ${fcfa(
          max,
        )} selon les mois. Basez votre budget sur ${fcfa(
          min,
        )} (votre mois le plus bas) et épargnez le surplus des bons mois.`,
      );
    }
  }

  return conseils.slice(0, 5);
}
