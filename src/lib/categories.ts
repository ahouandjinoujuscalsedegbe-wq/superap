import type { CategorieEnveloppe, Enveloppe } from "./store";

/** Catégories et sous-catégories proposées par défaut au foyer. */
export const CATEGORIES_SUGGEREES: Record<string, string[]> = {
  Transport: [
    "Carburant",
    "Vidange voiture",
    "Entretien moto",
    "Taxi / Zémidjan",
    "Assurance véhicule",
  ],
  Factures: ["Facture SBEE", "Facture SONEB", "Internet", "Crédit téléphonique", "Abonnement TV"],
  Alimentation: ["Marché", "Boutique", "Restaurant", "Eau potable"],
  Logement: ["Loyer", "Réparations", "Meubles", "Gardiennage"],
  Santé: ["Pharmacie", "Consultation", "Analyses", "Mutuelle"],
  Éducation: ["Scolarité", "Fournitures", "Cours du soir", "Transport scolaire"],
  Épargne: ["Tontine", "Épargne banque", "Projet immobilier"],
  Famille: ["Cérémonies", "Aide aux proches", "Cadeaux"],
};

export const CATEGORIE_LIBRE = "Sans catégorie";

/** Liste des catégories connues : suggestions + celles déjà saisies. */
export function categoriesDisponibles(
  enveloppes: Enveloppe[],
  categories: CategorieEnveloppe[] = [],
): string[] {
  const set = new Set(categories.map((c) => c.nom));
  if (set.size === 0) for (const c of Object.keys(CATEGORIES_SUGGEREES)) set.add(c);
  for (const e of enveloppes) if (e.categorie?.trim()) set.add(e.categorie.trim());
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Sous-catégories connues pour une catégorie donnée. */
export function sousCategoriesDisponibles(
  enveloppes: Enveloppe[],
  categorie: string,
  categories: CategorieEnveloppe[] = [],
): string[] {
  const declaree = categories.find((c) => c.nom === categorie);
  const set = new Set(declaree ? declaree.sousCategories : (CATEGORIES_SUGGEREES[categorie] ?? []));
  for (const e of enveloppes) {
    if (e.categorie?.trim() === categorie && e.sousCategorie?.trim())
      set.add(e.sousCategorie.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}

/** Regroupe les enveloppes par catégorie puis sous-catégorie. */
export function grouperParCategorie(enveloppes: Enveloppe[]) {
  const groupes = new Map<string, Map<string, Enveloppe[]>>();
  for (const e of enveloppes) {
    const cat = e.categorie?.trim() || CATEGORIE_LIBRE;
    const sous = e.sousCategorie?.trim() || "Général";
    if (!groupes.has(cat)) groupes.set(cat, new Map());
    const sousGroupes = groupes.get(cat)!;
    if (!sousGroupes.has(sous)) sousGroupes.set(sous, []);
    sousGroupes.get(sous)!.push(e);
  }
  return [...groupes.entries()]
    .sort((a, b) => {
      if (a[0] === CATEGORIE_LIBRE) return 1;
      if (b[0] === CATEGORIE_LIBRE) return -1;
      return a[0].localeCompare(b[0], "fr");
    })
    .map(([categorie, sousMap]) => ({
      categorie,
      sousCategories: [...sousMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], "fr"))
        .map(([sousCategorie, items]) => ({ sousCategorie, enveloppes: items })),
    }));
}
