/**
 * Réseau unifié des intelligences locales.
 *
 * L'application contient plusieurs intelligences spécialisées : le cerveau
 * (faits et règles), le coach (bilans et conseils), l'analyste (prévisions),
 * le budget automatique, la lecture des SMS, la lecture des tickets, la saisie
 * intelligente, le suivi planifié/réel, les objectifs. Chacune savait faire
 * une chose. Ce module les met en réseau : il rassemble en un seul état
 * partagé ce que chacune sait, y ajoute la mémoire des habitudes de
 * l'utilisateur, et sert de source unique pour le conseiller.
 *
 * Tout est calculé sur l'appareil : aucune donnée ne sort du téléphone.
 */
import { useMemo, useSyncExternalStore } from "react";
import {
  useSuperApp,
  resteDu,
  type Budget,
  type Dette,
  type Enveloppe,
  type Objectif,
  type Transaction,
} from "./store";
import { analyser, type Analyse } from "./cerveau";
import { bilanMensuel, type BilanMensuel, type DonneesCoach } from "./coach";
import { comparerPlanifieEtReel, type ComparaisonEnveloppe } from "./suivi-planifie";
import { suivreObjectifs, type SuiviObjectif } from "./objectifs";
import { lireCollaborationIa, type CollaborationIa } from "./apprentissage-conseiller";
import {
  calculerHabitudes,
  lireJournalHabitudes,
  phrasesHabitudes,
  EVENEMENT_HABITUDE,
  type Habitudes,
} from "./memoire-utilisateur";

export type DonneesUnifiees = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  budgets: Budget[];
  dettes: Dette[];
  objectifs: Objectif[];
  comptes: string[];
  comptesExclus: string[];
  soldesParCompte: Record<string, number>;
  depensesParEnveloppe: Record<string, number>;
  solde: number;
  soldeDisponible: number;
  habitudes: Habitudes;
  collaboration: CollaborationIa;
  maintenant?: Date;
};

export type EtatIA = {
  /** Faits, constats et alertes du cerveau : la vérité chiffrée commune. */
  cerveau: Analyse;
  /** Bilan narratif du mois, produit par le coach. */
  mensuel: BilanMensuel;
  /** Comparaison planifié / réel du mois en cours. */
  suivi: ComparaisonEnveloppe[];
  /** Suivi des objectifs d'épargne. */
  objectifs: SuiviObjectif[];
  /** Ce que les autres intelligences ont appris (SMS, tickets, budget). */
  collaboration: CollaborationIa;
  /** Habitudes mémorisées de l'utilisateur. */
  habitudes: Habitudes;
  /** Données brutes, pour les réponses détaillées. */
  donnees: DonneesUnifiees;
  /** Maturité globale du réseau d'intelligences, en pourcentage. */
  maturite: number;
};

function moisDe(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Assemble l'état commun à toutes les intelligences. */
export function construireEtatIA(donnees: DonneesUnifiees): EtatIA {
  const maintenant = donnees.maintenant ?? new Date();
  const cerveau = analyser({
    transactions: donnees.transactions,
    enveloppes: donnees.enveloppes,
    dettes: donnees.dettes,
    objectifs: donnees.objectifs,
    solde: donnees.soldeDisponible,
    comptesExclus: donnees.comptesExclus,
    maintenant,
  });
  const donneesCoach: DonneesCoach = {
    transactions: donnees.transactions,
    enveloppes: donnees.enveloppes,
    budgets: donnees.budgets,
    dettes: donnees.dettes,
    depensesParEnveloppe: donnees.depensesParEnveloppe,
    solde: donnees.solde,
    objectifs: donnees.objectifs,
  };
  const mensuel = bilanMensuel(donneesCoach, maintenant);
  const suivi = comparerPlanifieEtReel(
    donnees.budgets,
    donnees.transactions,
    donnees.enveloppes,
    moisDe(maintenant),
  );
  const objectifs = suivreObjectifs(donnees.objectifs, donnees.transactions, maintenant);

  // Maturité du réseau : moyenne de ce que chaque intelligence a appris.
  const parts = [
    donnees.collaboration.maturite,
    donnees.habitudes.maturite,
    Math.min(100, donnees.transactions.length),
  ];
  const maturite = Math.round(parts.reduce((s, p) => s + p, 0) / parts.length);

  return {
    cerveau,
    mensuel,
    suivi,
    objectifs,
    collaboration: donnees.collaboration,
    habitudes: donnees.habitudes,
    donnees,
    maturite,
  };
}

/* ------------------------------------------------------------------ */
/* Accès React                                                          */
/* ------------------------------------------------------------------ */

function abonnerHabitudes(rappel: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT_HABITUDE, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT_HABITUDE, rappel);
    window.removeEventListener("storage", rappel);
  };
}

/** Version des habitudes : change à chaque action mémorisée. */
function versionHabitudes(): number {
  return lireJournalHabitudes().total;
}

/**
 * Point d'accès unique des écrans au réseau d'intelligences.
 * Toutes les pages qui affichent un chiffre, une alerte ou un conseil
 * doivent passer par ici : l'application dit ainsi partout la même chose.
 */
export function useIaUnifiee(): EtatIA {
  const {
    transactions,
    enveloppes,
    budgets,
    dettes,
    objectifs,
    comptes,
    comptesExclus,
    soldesParCompte,
    depensesParEnveloppe,
    solde,
    soldeDisponible,
  } = useSuperApp();

  const version = useSyncExternalStore(
    abonnerHabitudes,
    versionHabitudes,
    () => 0,
  );

  return useMemo(() => {
    void version; // recalcul dès qu'une nouvelle habitude est mémorisée
    return construireEtatIA({
      transactions,
      enveloppes,
      budgets,
      dettes,
      objectifs,
      comptes,
      comptesExclus,
      soldesParCompte,
      depensesParEnveloppe,
      solde,
      soldeDisponible,
      habitudes: calculerHabitudes(),
      collaboration: lireCollaborationIa(),
    });
  }, [
    version,
    transactions,
    enveloppes,
    budgets,
    dettes,
    objectifs,
    comptes,
    comptesExclus,
    soldesParCompte,
    depensesParEnveloppe,
    solde,
    soldeDisponible,
  ]);
}

/* ------------------------------------------------------------------ */
/* Résumés partagés                                                     */
/* ------------------------------------------------------------------ */

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

/** Résumé en quelques phrases de tout ce que le réseau sait aujourd'hui. */
export function resumeReseau(etat: EtatIA): string[] {
  const lignes: string[] = [etat.cerveau.resume];
  const alerte = etat.cerveau.constats.find((c) => c.gravite === "alerte");
  if (alerte) lignes.push(`Point de vigilance : ${alerte.titre} — ${alerte.detail}`);
  const depassees = etat.suivi.filter((s) => s.ecart > 0).length;
  if (etat.suivi.length > 0) {
    lignes.push(
      depassees === 0
        ? "Vos dépenses planifiées sont tenues ce mois-ci."
        : `${depassees} enveloppe(s) dépassent le montant planifié ce mois-ci.`,
    );
  }
  const enRetard = etat.objectifs.filter(
    (o) => o.etat === "en_retard" || o.etat === "en_danger",
  ).length;
  if (etat.objectifs.length > 0) {
    lignes.push(
      enRetard === 0
        ? `Vos ${etat.objectifs.length} objectif(s) d'épargne suivent le rythme prévu.`
        : `${enRetard} objectif(s) d'épargne sont en retard.`,
    );
  }
  lignes.push(...phrasesHabitudes(etat.habitudes).slice(0, 2));
  return lignes;
}

/** Ce que le réseau d'intelligences a appris, en clair. */
export function etatApprentissage(etat: EtatIA): string[] {
  const c = etat.collaboration;
  return [
    `Maturité du réseau : ${etat.maturite} %.`,
    `Lecture des tickets : ${c.ocr} % de justesse sur ${c.ticketsAppris} commerçant(s) appris.`,
    `Lecture des SMS : ${c.smsReconnaissance} % de messages reconnus, ${c.smsJustesse} % justes.`,
    `Budget automatique : ${c.budgetCorrige} enveloppe(s) ajustées d'après vos corrections.`,
    ...phrasesHabitudes(etat.habitudes),
  ];
}

/** Photographie des comptes, utilisée par les réponses du conseiller. */
export function photoComptes(etat: EtatIA): string[] {
  const { comptes, soldesParCompte, comptesExclus } = etat.donnees;
  return comptes.map(
    (c) =>
      `${c} : ${fcfa(soldesParCompte[c] ?? 0)}${comptesExclus.includes(c) ? " (hors solde disponible)" : ""}`,
  );
}

/** Photographie des dettes et créances. */
export function photoDettes(etat: EtatIA): { aPayer: number; aRecevoir: number; lignes: string[] } {
  let aPayer = 0;
  let aRecevoir = 0;
  const lignes: string[] = [];
  for (const d of etat.donnees.dettes) {
    const reste = resteDu(d);
    if (reste <= 0) continue;
    if (d.sens === "dette") aPayer += reste;
    else aRecevoir += reste;
    lignes.push(
      `${d.sens === "dette" ? "Je dois à" : "Me doit"} ${d.personne} : ${fcfa(reste)}${
        d.dateLimite ? ` (avant le ${d.dateLimite})` : ""
      }`,
    );
  }
  return { aPayer, aRecevoir, lignes };
}
