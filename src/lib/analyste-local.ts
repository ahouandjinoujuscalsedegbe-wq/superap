/**
 * Analyste financier 100 % local.
 *
 * Aucune connexion réseau, aucun service externe, aucun modèle téléchargé :
 * tout est calculé sur le téléphone à partir des opérations déjà enregistrées.
 * Méthodes statistiques légères (médiane, écart absolu médian, régression
 * simple) qui tiennent en quelques millisecondes, même avec des milliers
 * d'opérations.
 */
import { analyser } from "./cerveau";
import { dotationDe, etatEnveloppe } from "./enveloppe-etat";
import type { Enveloppe, Transaction } from "./store";

const JOUR_MS = 86_400_000;

function jour(date: string): string {
  return date.slice(0, 10);
}

export type PrevisionEnveloppe = {
  enveloppe: Enveloppe;
  restant: number;
  /** Dépense moyenne par jour observée sur la fenêtre analysée. */
  rythmeJour: number;
  /** Nombre de jours avant épuisement de la dotation, null si rythme nul. */
  joursAvantEpuisement: number | null;
  /** Date estimée d'épuisement au format AAAA-MM-JJ, null si non prévisible. */
  dateEpuisement: string | null;
  niveau: "bon" | "attention" | "alerte";
};

/**
 * Estime la date d'épuisement de chaque enveloppe à partir du rythme
 * de dépense observé sur les derniers jours.
 */
export function previsionEnveloppes(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  options: { fenetreJours?: number } = {},
): PrevisionEnveloppe[] {
  const fenetre = options.fenetreJours ?? 30;
  const depuis = new Date(Date.now() - fenetre * JOUR_MS).toISOString().slice(0, 10);

  return enveloppes
    .map((e) => {
      const depenses = transactions.filter((t) => t.type === "depense" && t.categorie === e.nom);
      const utilise = depenses.reduce((s, t) => s + t.montant, 0);
      const recentes = depenses
        .filter((t) => jour(t.date) >= depuis)
        .reduce((s, t) => s + t.montant, 0);
      const etat = etatEnveloppe(e, utilise);
      const rythmeJour = Math.round(recentes / fenetre);
      const joursAvantEpuisement =
        rythmeJour > 0 && etat.restant > 0 ? Math.floor(etat.restant / rythmeJour) : null;
      const dateEpuisement =
        joursAvantEpuisement === null
          ? null
          : new Date(Date.now() + joursAvantEpuisement * JOUR_MS).toISOString().slice(0, 10);

      let niveau: PrevisionEnveloppe["niveau"] = "bon";
      if (etat.epuisee || (joursAvantEpuisement !== null && joursAvantEpuisement <= 7)) {
        niveau = "alerte";
      } else if (
        etat.plafondAtteint ||
        (joursAvantEpuisement !== null && joursAvantEpuisement <= 15)
      ) {
        niveau = "attention";
      }

      return {
        enveloppe: e,
        restant: etat.restant,
        rythmeJour,
        joursAvantEpuisement,
        dateEpuisement,
        niveau,
      };
    })
    .sort((a, b) => {
      const va = a.joursAvantEpuisement ?? Number.MAX_SAFE_INTEGER;
      const vb = b.joursAvantEpuisement ?? Number.MAX_SAFE_INTEGER;
      return va - vb;
    });
}

// ------------------------------------------------------------ alertes utiles

export type AlerteLocale = {
  id: string;
  niveau: "alerte" | "attention" | "info";
  titre: string;
  texte: string;
};

/**
 * Synthèse des signaux à montrer à l'utilisateur.
 *
 * Façade : les détections ne sont plus refaites ici, elles proviennent du
 * noyau unique `src/lib/cerveau` afin que tous les écrans annoncent exactement
 * les mêmes chiffres et les mêmes alertes.
 */
export function alertesLocales(
  enveloppes: Enveloppe[],
  transactions: Transaction[],
  limite = 5,
): AlerteLocale[] {
  const { alertes } = analyser({ enveloppes, transactions });
  return alertes
    .filter((a) => a.niveau !== "bravo")
    .slice(0, limite)
    .map((a) => ({
      id: a.id,
      niveau: a.niveau as AlerteLocale["niveau"],
      titre: a.titre,
      texte: a.texte,
    }));
}

