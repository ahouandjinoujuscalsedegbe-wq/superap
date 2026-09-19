/**
 * Description libre d'une opération → suggestion d'enveloppe, de compte et de
 * type de mouvement.
 *
 * Deux niveaux :
 *  1. le moteur local (aucun réseau) devine toujours quelque chose ;
 *  2. si le réseau répond, un modèle affine la proposition via AI Gateway.
 *
 * Seuls la phrase écrite et les NOMS d'enveloppes/comptes sortent du téléphone :
 * jamais un montant, un solde ni un historique.
 */

import { suggererEnveloppes } from "@/lib/classement-enveloppe";
import { analyserTexte } from "@/lib/extraction";
import type { Enveloppe, Transaction } from "@/lib/store";
import { RELAIS_MAJ } from "@/lib/version";

export type SuggestionOperation = {
  type: "depense" | "revenu" | "transfert" | "inconnu";
  montant: number | null;
  libelle: string;
  /** Identifiant d'enveloppe existant, ou null. */
  enveloppe: string | null;
  /** Nom de compte existant, ou null. */
  compte: string | null;
  /** Source de revenu existante, ou null. */
  source: string | null;
  confiance: number;
  raison: string;
  /** Origine de la suggestion affichée à l'utilisateur. */
  origine: "locale" | "modele";
};

function adresseIa(): string {
  if (typeof window === "undefined") return `${RELAIS_MAJ}/api/public/ia/operation`;
  const pont = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const embarquee =
    !window.location.protocol.startsWith("http") || pont?.isNativePlatform?.() === true;
  const base = embarquee ? RELAIS_MAJ : window.location.origin;
  return `${base}/api/public/ia/operation`;
}

/** Suggestion calculée sur le téléphone, sans aucun réseau. */
export function suggestionLocale(
  texte: string,
  enveloppes: Enveloppe[],
  comptes: string[],
  sources: string[],
  transactions: Transaction[] = [],
): SuggestionOperation {
  const lu = analyserTexte(texte, enveloppes);
  const pistes = suggererEnveloppes(texte, enveloppes, transactions, 1);
  const piste = pistes[0];
  const enveloppe = piste?.enveloppe ?? lu.indiceEnveloppe ?? null;
  const transfert = /\btransf[eè]r|vire(?:ment)?\b/i.test(texte);
  const enveloppeChoisie = enveloppes.find((e) => e.id === enveloppe);
  return {
    type: transfert ? "transfert" : lu.type,
    montant: lu.montant > 0 ? lu.montant : null,
    libelle: lu.libelle,
    enveloppe: enveloppe ?? null,
    compte: enveloppeChoisie?.compteSource ?? comptes[0] ?? null,
    source: lu.type === "revenu" ? (sources[0] ?? null) : null,
    confiance: Math.round(Math.max(lu.confiance * 100, piste?.confiance ?? 0)),
    raison: piste?.raison ?? "Lecture des mots de votre phrase sur le téléphone.",
    origine: "locale",
  };
}

/**
 * Suggestion affinée par le modèle. En cas d'erreur ou d'absence de réseau,
 * la suggestion locale est renvoyée : la fonctionnalité ne bloque jamais.
 */
export async function suggererOperation(
  texte: string,
  enveloppes: Enveloppe[],
  comptes: string[],
  sources: string[],
  transactions: Transaction[] = [],
): Promise<{ suggestion: SuggestionOperation; avertissement?: string }> {
  const locale = suggestionLocale(texte, enveloppes, comptes, sources, transactions);
  try {
    const http = await fetch(adresseIa(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texte,
        enveloppes: enveloppes.map((e) => ({
          id: e.id,
          nom: e.nom,
          categorie: e.categorie ?? "",
          sousCategorie: e.sousCategorie ?? "",
        })),
        comptes,
        sources,
      }),
    });
    const corps = (await http.json().catch(() => null)) as
      | { ok?: boolean; raison?: string; suggestion?: Partial<SuggestionOperation> }
      | null;
    if (!http.ok || !corps?.ok || !corps.suggestion) {
      return { suggestion: locale, avertissement: messageAvertissement(corps?.raison) };
    }
    const s = corps.suggestion;
    const enveloppeValide =
      typeof s.enveloppe === "string" && enveloppes.some((e) => e.id === s.enveloppe)
        ? s.enveloppe
        : locale.enveloppe;
    const compteValide =
      typeof s.compte === "string" && comptes.includes(s.compte) ? s.compte : locale.compte;
    const sourceValide =
      typeof s.source === "string" && sources.includes(s.source) ? s.source : locale.source;
    const type =
      s.type === "depense" || s.type === "revenu" || s.type === "transfert" || s.type === "inconnu"
        ? s.type
        : locale.type;
    return {
      suggestion: {
        type,
        montant: typeof s.montant === "number" && s.montant > 0 ? Math.round(s.montant) : locale.montant,
        libelle: typeof s.libelle === "string" && s.libelle.trim() ? s.libelle.trim() : locale.libelle,
        enveloppe: enveloppeValide,
        compte: compteValide,
        source: sourceValide,
        confiance:
          typeof s.confiance === "number"
            ? Math.max(0, Math.min(100, Math.round(s.confiance)))
            : locale.confiance,
        raison: typeof s.raison === "string" && s.raison.trim() ? s.raison.trim() : locale.raison,
        origine: "modele",
      },
    };
  } catch {
    return {
      suggestion: locale,
      avertissement: "Sans connexion : proposition calculée sur votre téléphone.",
    };
  }
}

function messageAvertissement(raison?: string): string {
  switch (raison) {
    case "credits_epuises":
      return "L'assistant en ligne est momentanément indisponible (crédits épuisés) : proposition calculée sur votre téléphone.";
    case "trop_de_requetes":
      return "Trop de demandes d'un coup : proposition calculée sur votre téléphone. Réessayez dans une minute.";
    case "texte_trop_court":
      return "Décrivez l'opération un peu plus précisément.";
    default:
      return "L'assistant en ligne n'a pas répondu : proposition calculée sur votre téléphone.";
  }
}
