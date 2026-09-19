/**
 * Mode multi-appareil.
 *
 * Principe : votre adresse e-mail sert de « compte ». Chaque téléphone envoie
 * à cette adresse une copie CHIFFRÉE de vos données (personne d'autre ne peut
 * l'ouvrir sans la phrase de récupération). Un autre téléphone se reconnecte
 * au même compte : il ouvre la dernière copie et FUSIONNE les données avec les
 * siennes, sans doublon et sans rien écraser.
 *
 * Aucun serveur ne conserve vos données : la copie vit uniquement dans votre
 * boîte mail, chiffrée de bout en bout.
 */

import type { Etat } from "@/lib/store";

export const CLE_MULTI = "superapp:multi-appareil:v1";

export type AppareilLie = {
  id: string;
  nom: string;
  /** Dernière fois que cet appareil a envoyé une copie au compte. */
  dernierEnvoi?: string;
  /** Dernière fois que cet appareil a repris les données du compte. */
  dernierImport?: string;
};

export type ReglagesMulti = {
  /** Mode multi-appareil accepté par l'utilisateur. */
  actif: boolean;
  /** Nom de ce téléphone. */
  cetAppareil: string;
  /** Appareils connus reliés au même compte e-mail. */
  appareils: AppareilLie[];
};

export const REGLAGES_MULTI_INITIAUX: ReglagesMulti = {
  actif: false,
  cetAppareil: "MON TÉLÉPHONE",
  appareils: [],
};

function nouvelId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function lireReglagesMulti(): ReglagesMulti {
  if (typeof window === "undefined") return REGLAGES_MULTI_INITIAUX;
  try {
    const brut = window.localStorage.getItem(CLE_MULTI);
    if (!brut) return REGLAGES_MULTI_INITIAUX;
    const objet = JSON.parse(brut) as Partial<ReglagesMulti>;
    return {
      actif: Boolean(objet.actif),
      cetAppareil:
        typeof objet.cetAppareil === "string" && objet.cetAppareil.trim()
          ? objet.cetAppareil
          : "MON TÉLÉPHONE",
      appareils: Array.isArray(objet.appareils)
        ? objet.appareils.filter((a): a is AppareilLie => Boolean(a && a.id && a.nom))
        : [],
    };
  } catch {
    return REGLAGES_MULTI_INITIAUX;
  }
}

export function ecrireReglagesMulti(r: ReglagesMulti) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CLE_MULTI,
      JSON.stringify({ ...r, appareils: r.appareils.slice(0, 12) }),
    );
  } catch {
    /* stockage indisponible */
  }
}

/** Enregistre (ou met à jour) un appareil du compte. */
export function noterAppareil(
  r: ReglagesMulti,
  nom: string,
  champs: Partial<AppareilLie>,
): ReglagesMulti {
  const propre = nom.trim() || "APPAREIL";
  const existant = r.appareils.find((a) => a.nom.toLowerCase() === propre.toLowerCase());
  if (existant) {
    return {
      ...r,
      appareils: r.appareils.map((a) => (a.id === existant.id ? { ...a, ...champs } : a)),
    };
  }
  return { ...r, appareils: [{ id: nouvelId(), nom: propre, ...champs }, ...r.appareils] };
}

// ------------------------------------------------------------------- fusion

type AvecId = { id: string };

function fusionnerListe<T extends AvecId>(
  actuel: T[],
  entrant: unknown,
): { liste: T[]; neufs: number } {
  if (!Array.isArray(entrant)) return { liste: actuel, neufs: 0 };
  const connus = new Set(actuel.map((x) => x.id));
  const nouveaux = (entrant as T[]).filter(
    (x) => x && typeof x.id === "string" && !connus.has(x.id),
  );
  return { liste: [...nouveaux, ...actuel], neufs: nouveaux.length };
}

function fusionnerTextes(actuel: string[], entrant: unknown): { liste: string[]; neufs: number } {
  if (!Array.isArray(entrant)) return { liste: actuel, neufs: 0 };
  const nouveaux = (entrant as unknown[]).filter(
    (x): x is string => typeof x === "string" && !actuel.includes(x),
  );
  return { liste: [...actuel, ...nouveaux], neufs: nouveaux.length };
}

export type ResultatFusion = {
  /** Champs à passer à remplacerEtat. */
  etat: Partial<Etat>;
  /** Nombre d'éléments réellement ajoutés, par rubrique. */
  ajouts: { rubrique: string; nombre: number }[];
  total: number;
};

/**
 * Fusionne les données reçues du compte e-mail avec celles de ce téléphone :
 * tout ce qui manque est ajouté, rien de local n'est effacé ni remplacé.
 */
export function fusionnerDonneesCompte(local: Etat, recu: Partial<Etat>): ResultatFusion {
  const etat: Record<string, unknown> = {};
  const ajouts: { rubrique: string; nombre: number }[] = [];
  let total = 0;

  const listes: { cle: keyof Etat; rubrique: string }[] = [
    { cle: "transactions", rubrique: "Opérations" },
    { cle: "transferts", rubrique: "Transferts" },
    { cle: "enveloppes", rubrique: "Enveloppes" },
    { cle: "categories", rubrique: "Catégories" },
    { cle: "budgets", rubrique: "Planifications" },
    { cle: "dettes", rubrique: "Dettes et créances" },
    { cle: "objectifs", rubrique: "Objectifs" },
    { cle: "remplissages", rubrique: "Remplissages" },
    { cle: "membres", rubrique: "Membres" },
    { cle: "corbeille", rubrique: "Corbeille" },
    { cle: "reglesTransfert", rubrique: "Règles de transfert" },
  ];

  for (const { cle, rubrique } of listes) {
    const actuel = local[cle];
    if (!Array.isArray(actuel)) continue;
    const r = fusionnerListe(actuel as AvecId[], recu[cle]);
    if (r.neufs > 0) {
      etat[cle] = r.liste;
      ajouts.push({ rubrique, nombre: r.neufs });
      total += r.neufs;
    }
  }

  const textes: { cle: keyof Etat; rubrique: string }[] = [
    { cle: "comptes", rubrique: "Comptes" },
    { cle: "comptesExclus", rubrique: "Comptes hors disponible" },
    { cle: "comptesReserves", rubrique: "Comptes réservés" },
  ];

  for (const { cle, rubrique } of textes) {
    const actuel = local[cle];
    const r = fusionnerTextes(Array.isArray(actuel) ? (actuel as string[]) : [], recu[cle]);
    if (r.neufs > 0) {
      etat[cle] = r.liste;
      ajouts.push({ rubrique, nombre: r.neufs });
      total += r.neufs;
    }
  }

  // Détails d'affichage : rien n'est écrasé, seuls les manquants sont repris.
  const iconesRecues = recu.iconesComptes;
  if (iconesRecues && typeof iconesRecues === "object") {
    const fusion = { ...(iconesRecues as Record<string, string>), ...(local.iconesComptes ?? {}) };
    if (Object.keys(fusion).length > Object.keys(local.iconesComptes ?? {}).length) {
      etat["iconesComptes"] = fusion;
    }
  }
  const relaisRecus = recu.comptesRelais;
  if (relaisRecus && typeof relaisRecus === "object") {
    const fusion = { ...(relaisRecus as Record<string, string>), ...(local.comptesRelais ?? {}) };
    if (Object.keys(fusion).length > Object.keys(local.comptesRelais ?? {}).length) {
      etat["comptesRelais"] = fusion;
    }
  }
  if (!local.nomUtilisateur && typeof recu.nomUtilisateur === "string" && recu.nomUtilisateur) {
    etat["nomUtilisateur"] = recu.nomUtilisateur;
  }

  return { etat: etat as Partial<Etat>, ajouts, total };
}
