/**
 * Moteurs de simulation multi-sujets : dépense, objectif d'épargne ou d'achat,
 * tontine, changement de revenu, dette et économie récurrente.
 *
 * Tous les calculs sont faits sur l'appareil, à partir des opérations, des
 * enveloppes, des dettes et des objectifs déjà enregistrés.
 */
import type { Budget, Dette, Enveloppe, Objectif, Transaction, Transfert } from "./store";
import { resteDu } from "./store";
import { revenuMensuelMoyen, rythmeJournalier, detecterFuites } from "./simulation";
import { suivreObjectifs } from "./objectifs";
import { previsionFinDeMois } from "./ia-avancee";

const JOUR = 86400000;

export type Verdict = "favorable" | "tendu" | "risque";

export type ResultatSimulation = {
  titre: string;
  verdict: Verdict;
  message: string;
  /** Chiffres clés affichés en liste. */
  lignes: { libelle: string; valeur: string }[];
  /** Trajectoire du solde disponible sur douze mois. */
  trajectoire: { label: string; solde: number }[];
  /** Conseils pratiques générés à partir des données de l'utilisateur. */
  conseils: string[];
};

function fcfa(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
}

function moisLabel(decalage: number): string {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth() + decalage, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

/** Capacité d'épargne mensuelle constatée (revenus moyens − dépenses moyennes). */
export function capaciteMensuelle(transactions: Transaction[]): number {
  return Math.round(revenuMensuelMoyen(transactions) - rythmeJournalier(transactions) * 30);
}

/** Trajectoire du solde sur douze mois avec un flux mensuel supplémentaire. */
function trajectoire(
  soldeDepart: number,
  capacite: number,
  fluxParMois: (index: number) => number,
): { label: string; solde: number }[] {
  const lignes: { label: string; solde: number }[] = [];
  let courant = soldeDepart;
  for (let i = 0; i < 12; i += 1) {
    courant += capacite + fluxParMois(i);
    lignes.push({ label: moisLabel(i), solde: Math.round(courant) });
  }
  return lignes;
}

function verdictDeTrajectoire(lignes: { solde: number }[], marge: number): Verdict {
  const creux = Math.min(...lignes.map((l) => l.solde));
  if (creux < 0) return "risque";
  if (creux < marge) return "tendu";
  return "favorable";
}

export type ContexteSimulation = {
  transactions: Transaction[];
  transferts: Transfert[];
  enveloppes: Enveloppe[];
  budgets: Budget[];
  dettes: Dette[];
  objectifs: Objectif[];
  depensesParEnveloppe: Record<string, number>;
  soldeDisponible: number;
};

/* ------------------------------------------------------------------ */
/* Dépense envisagée                                                    */
/* ------------------------------------------------------------------ */

export function simulerDepense(
  ctx: ContexteSimulation,
  saisie: { montant: number; etalementMois: number; enveloppeId?: string },
): ResultatSimulation {
  const capacite = capaciteMensuelle(ctx.transactions);
  const etalement = Math.max(1, saisie.etalementMois);
  const parMois = saisie.montant / etalement;
  const lignesTraj = trajectoire(ctx.soldeDisponible, capacite, (i) => (i < etalement ? -parMois : 0));
  const marge = Math.max(0, rythmeJournalier(ctx.transactions) * 15);
  const verdict = verdictDeTrajectoire(lignesTraj, marge);

  const conseils: string[] = [];
  if (verdict !== "favorable" && etalement === 1) {
    conseils.push(
      `Étalé sur 3 mois, l'effort tomberait à ${fcfa(saisie.montant / 3)} par mois au lieu de ${fcfa(saisie.montant)} d'un coup.`,
    );
  }
  if (capacite > 0) {
    conseils.push(
      `À votre rythme actuel, il vous faut environ ${Math.ceil(saisie.montant / capacite)} mois pour reconstituer cette somme.`,
    );
  } else {
    conseils.push(
      "Vos dépenses dépassent vos revenus sur la période récente : toute dépense supplémentaire creuse l'écart.",
    );
  }

  const lignes = [
    { libelle: "Effort chaque mois", valeur: fcfa(parMois) },
    { libelle: "Solde juste après", valeur: fcfa(ctx.soldeDisponible - parMois) },
    { libelle: "Capacité mensuelle constatée", valeur: fcfa(capacite) },
  ];

  if (saisie.enveloppeId) {
    const prevision = previsionFinDeMois({
      enveloppes: ctx.enveloppes,
      depensesParEnveloppe: {
        ...ctx.depensesParEnveloppe,
        [saisie.enveloppeId]: (ctx.depensesParEnveloppe[saisie.enveloppeId] ?? 0) + saisie.montant,
      },
    }).find((p) => p.id === saisie.enveloppeId);
    if (prevision) {
      lignes.push({
        libelle: `Enveloppe ${prevision.nom}`,
        valeur: `${fcfa(prevision.projete)} projetés sur ${fcfa(prevision.dotation)}`,
      });
      conseils.push(prevision.phrase);
    }
  }

  return {
    titre: "Dépense envisagée",
    verdict,
    message:
      verdict === "risque"
        ? "Cette dépense vous ferait passer en négatif dans l'année. Reportez-la ou étalez-la."
        : verdict === "tendu"
          ? "Cette dépense est possible mais réduit fortement votre marge de sécurité."
          : "Cette dépense reste compatible avec votre trajectoire.",
    lignes,
    trajectoire: lignesTraj,
    conseils,
  };
}

/* ------------------------------------------------------------------ */
/* Objectif d'épargne ou d'achat programmé                              */
/* ------------------------------------------------------------------ */

export function simulerObjectif(
  ctx: ContexteSimulation,
  saisie: { cible: number; deja: number; dateCible: string },
): ResultatSimulation {
  const capacite = capaciteMensuelle(ctx.transactions);
  const restant = Math.max(0, saisie.cible - saisie.deja);
  const echeance = new Date(saisie.dateCible).getTime();
  const moisRestants = Number.isFinite(echeance)
    ? Math.max(1, Math.round((echeance - Date.now()) / (JOUR * 30)))
    : 12;
  const effort = Math.ceil(restant / moisRestants);

  // Efforts déjà engagés par les objectifs existants.
  const suivis = suivreObjectifs(ctx.objectifs, ctx.transactions, new Date(), ctx.transferts);
  const effortsExistants = suivis
    .filter((s) => s.etat !== "atteint")
    .reduce((s, o) => s + o.effortMensuel, 0);
  const resteApres = capacite - effortsExistants - effort;

  const lignesTraj = trajectoire(ctx.soldeDisponible, capacite, () => -effort);
  let verdict: Verdict = "favorable";
  if (resteApres < 0) verdict = "risque";
  else if (resteApres < capacite * 0.15) verdict = "tendu";

  const dateAtteignable =
    capacite - effortsExistants > 0
      ? new Date(
          Date.now() + Math.ceil(restant / (capacite - effortsExistants)) * 30 * JOUR,
        ).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : null;

  const conseils: string[] = [];
  if (verdict === "risque") {
    const moisTenable =
      capacite - effortsExistants > 0 ? Math.ceil(restant / (capacite - effortsExistants)) : null;
    conseils.push(
      moisTenable
        ? `Avec votre capacité actuelle, une échéance dans ${moisTenable} mois serait tenable sans se serrer la ceinture.`
        : "Votre capacité d'épargne est déjà entièrement absorbée : commencez par réduire une dépense récurrente.",
    );
  }
  if (effortsExistants > 0) {
    conseils.push(
      `Vos objectifs déjà en cours mobilisent ${fcfa(effortsExistants)} par mois : ce nouvel objectif s'y ajoute.`,
    );
  }
  conseils.push(
    `Mettre de côté ${fcfa(effort)} chaque mois sur un compte d'épargne exclu du disponible évite de piocher dedans.`,
  );

  return {
    titre: "Nouvel objectif",
    verdict,
    message:
      verdict === "risque"
        ? "Cet objectif dépasse ce que vous pouvez épargner chaque mois."
        : verdict === "tendu"
          ? "Cet objectif est atteignable mais ne laisse presque aucune marge."
          : "Cet objectif est atteignable au rythme actuel.",
    lignes: [
      { libelle: "Reste à réunir", valeur: fcfa(restant) },
      { libelle: "Effort mensuel nécessaire", valeur: `${fcfa(effort)} pendant ${moisRestants} mois` },
      { libelle: "Capacité d'épargne libre", valeur: fcfa(capacite - effortsExistants) },
      {
        libelle: "Date réaliste au rythme actuel",
        valeur: dateAtteignable ?? "non atteignable sans changement",
      },
    ],
    trajectoire: lignesTraj,
    conseils,
  };
}

/* ------------------------------------------------------------------ */
/* Tontine                                                              */
/* ------------------------------------------------------------------ */

const PAR_AN: Record<string, number> = {
  jour: 365,
  semaine: 52,
  quinzaine: 26,
  mois: 12,
};

export function simulerTontine(
  ctx: ContexteSimulation,
  saisie: {
    montantTour: number;
    participants: number;
    rang: number;
    frequence: "jour" | "semaine" | "quinzaine" | "mois";
  },
): ResultatSimulation {
  const parAn = PAR_AN[saisie.frequence] ?? 12;
  const cotisationMensuelle = Math.round((saisie.montantTour * parAn) / 12);
  const participants = Math.max(1, saisie.participants);
  const rang = Math.min(Math.max(1, saisie.rang), participants);
  const totalVerse = saisie.montantTour * participants;
  const montantRecu = saisie.montantTour * participants;
  const joursAvantTour = Math.round((rang / parAn) * 365);
  const dateTour = new Date(Date.now() + joursAvantTour * JOUR).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const moisAvantTour = Math.max(1, Math.round(joursAvantTour / 30));

  const capacite = capaciteMensuelle(ctx.transactions);
  const lignesTraj = trajectoire(ctx.soldeDisponible, capacite, (i) =>
    i === moisAvantTour - 1 ? montantRecu - cotisationMensuelle : -cotisationMensuelle,
  );
  const verdict: Verdict =
    cotisationMensuelle > Math.max(0, capacite)
      ? "risque"
      : cotisationMensuelle > capacite * 0.6
        ? "tendu"
        : "favorable";

  const conseils = [
    rang <= participants / 3
      ? "Vous passez tôt : la tontine vous sert d'avance de trésorerie, mais il faudra tenir les cotisations jusqu'au bout."
      : "Vous passez tard : cet argent est immobilisé longtemps, une épargne classique resterait disponible en cas d'imprévu.",
    `Prévoyez ${fcfa(cotisationMensuelle)} par mois dans votre budget pendant toute la durée du cycle.`,
  ];

  return {
    titre: "Tontine",
    verdict,
    message:
      verdict === "risque"
        ? "Les cotisations dépassent votre capacité mensuelle : le risque de manquer un tour est réel."
        : verdict === "tendu"
          ? "Les cotisations mobilisent une grande partie de votre marge."
          : "Ces cotisations sont soutenables au vu de vos revenus.",
    lignes: [
      { libelle: "Cotisation ramenée au mois", valeur: fcfa(cotisationMensuelle) },
      { libelle: "Total versé sur le cycle", valeur: fcfa(totalVerse) },
      { libelle: "Somme reçue à votre tour", valeur: fcfa(montantRecu) },
      { libelle: "Date estimée de votre tour", valeur: dateTour },
    ],
    trajectoire: lignesTraj,
    conseils,
  };
}

/* ------------------------------------------------------------------ */
/* Changement de revenu                                                 */
/* ------------------------------------------------------------------ */

export function simulerRevenu(
  ctx: ContexteSimulation,
  saisie: { variationMensuelle: number },
): ResultatSimulation {
  const capacite = capaciteMensuelle(ctx.transactions);
  const nouvelleCapacite = capacite + saisie.variationMensuelle;
  const lignesTraj = trajectoire(ctx.soldeDisponible, nouvelleCapacite, () => 0);
  const verdict = verdictDeTrajectoire(lignesTraj, rythmeJournalier(ctx.transactions) * 15);

  const conseils =
    saisie.variationMensuelle >= 0
      ? [
          `Ce revenu supplémentaire représente ${fcfa(saisie.variationMensuelle * 12)} sur un an.`,
          "Affectez-le automatiquement à un objectif ou au remboursement d'une dette pour qu'il ne se dilue pas.",
        ]
      : [
          `Cette baisse représente ${fcfa(Math.abs(saisie.variationMensuelle) * 12)} de moins sur un an.`,
          "Identifiez dès maintenant les enveloppes à réduire pour absorber le choc.",
        ];

  return {
    titre: "Changement de revenu",
    verdict,
    message:
      nouvelleCapacite < 0
        ? "Avec ce revenu, vos dépenses dépasseraient vos entrées chaque mois."
        : "Voici votre trajectoire avec ce nouveau revenu.",
    lignes: [
      { libelle: "Capacité actuelle", valeur: fcfa(capacite) },
      { libelle: "Capacité après changement", valeur: fcfa(nouvelleCapacite) },
      { libelle: "Effet sur un an", valeur: fcfa(saisie.variationMensuelle * 12) },
    ],
    trajectoire: lignesTraj,
    conseils,
  };
}

/* ------------------------------------------------------------------ */
/* Dette : emprunter ou rembourser                                      */
/* ------------------------------------------------------------------ */

export function simulerDette(
  ctx: ContexteSimulation,
  saisie: { montant: number; mensualite: number; sens: "emprunter" | "rembourser" },
): ResultatSimulation {
  const capacite = capaciteMensuelle(ctx.transactions);
  const mensualite = Math.max(1, saisie.mensualite);
  const duree = Math.ceil(saisie.montant / mensualite);
  const emprunt = saisie.sens === "emprunter";

  const lignesTraj = trajectoire(emprunt ? ctx.soldeDisponible + saisie.montant : ctx.soldeDisponible, capacite, (i) =>
    i < duree ? -mensualite : 0,
  );
  const verdict = verdictDeTrajectoire(lignesTraj, rythmeJournalier(ctx.transactions) * 15);

  const totalDettes = ctx.dettes
    .filter((d) => d.sens === "dette")
    .reduce((s, d) => s + resteDu(d), 0);

  return {
    titre: emprunt ? "Emprunt envisagé" : "Remboursement accéléré",
    verdict,
    message: emprunt
      ? `Vous recevriez ${fcfa(saisie.montant)} tout de suite et rembourseriez ${fcfa(mensualite)} pendant ${duree} mois.`
      : `Vous solderiez ${fcfa(saisie.montant)} en ${duree} mois à raison de ${fcfa(mensualite)} par mois.`,
    lignes: [
      { libelle: "Durée estimée", valeur: `${duree} mois` },
      { libelle: "Effort mensuel", valeur: fcfa(mensualite) },
      { libelle: "Part de votre capacité", valeur: capacite > 0 ? `${Math.round((mensualite / capacite) * 100)} %` : "au-delà de votre capacité" },
      { libelle: "Dettes déjà en cours", valeur: fcfa(totalDettes) },
    ],
    trajectoire: lignesTraj,
    conseils: [
      emprunt
        ? "Un emprunt n'a de sens que si la mensualité tient sans toucher aux enveloppes du quotidien."
        : "Rembourser plus vite libère durablement votre capacité mensuelle.",
      totalDettes > 0 ? `Il vous reste ${fcfa(totalDettes)} de dettes à rembourser par ailleurs.` : "Vous n'avez aucune autre dette en cours.",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Économie récurrente                                                  */
/* ------------------------------------------------------------------ */

export function simulerEconomie(
  ctx: ContexteSimulation,
  saisie: { economieMensuelle: number },
): ResultatSimulation {
  const capacite = capaciteMensuelle(ctx.transactions);
  const lignesTraj = trajectoire(ctx.soldeDisponible, capacite + saisie.economieMensuelle, () => 0);
  return {
    titre: "Économie récurrente",
    verdict: "favorable",
    message: `Réduire ${fcfa(saisie.economieMensuelle)} par mois change nettement votre trajectoire.`,
    lignes: [
      { libelle: "Gain sur 6 mois", valeur: fcfa(saisie.economieMensuelle * 6) },
      { libelle: "Gain sur 1 an", valeur: fcfa(saisie.economieMensuelle * 12) },
      { libelle: "Gain sur 3 ans", valeur: fcfa(saisie.economieMensuelle * 36) },
      { libelle: "Nouvelle capacité mensuelle", valeur: fcfa(capacite + saisie.economieMensuelle) },
    ],
    trajectoire: lignesTraj,
    conseils: [
      "Transformez cette économie en versement automatique vers un objectif : sinon elle se dissout dans le quotidien.",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Suggestions : ce qu'il vaut la peine de simuler                      */
/* ------------------------------------------------------------------ */

export type TypeSimulation = "depense" | "objectif" | "tontine" | "revenu" | "dette" | "economie";

export type SuggestionSimulation = {
  id: string;
  type: TypeSimulation;
  titre: string;
  raison: string;
  /** Valeurs à pré-remplir dans le formulaire. */
  valeurs: Record<string, string | number>;
};

/**
 * Analyse locale de toutes les données de l'application pour proposer les
 * simulations réellement utiles avant une décision.
 */
export function suggestionsSimulation(ctx: ContexteSimulation): SuggestionSimulation[] {
  const suggestions: SuggestionSimulation[] = [];
  const capacite = capaciteMensuelle(ctx.transactions);

  // 1. Objectifs en danger
  const suivis = suivreObjectifs(ctx.objectifs, ctx.transactions, new Date(), ctx.transferts);
  const enDanger = suivis.find((s) => s.etat === "en_danger" || s.etat === "en_retard");
  if (enDanger) {
    suggestions.push({
      id: `objectif-${enDanger.objectif.id}`,
      type: "objectif",
      titre: `Revoir « ${enDanger.objectif.libelle} »`,
      raison: `Cet objectif est ${enDanger.etat === "en_danger" ? "en danger" : "en retard"} : testez une autre échéance ou un autre montant.`,
      valeurs: {
        cible: enDanger.objectif.cible,
        deja: Math.round(enDanger.reuni),
        dateCible: enDanger.objectif.dateCible,
      },
    });
  }

  // 2. Capacité d'épargne inutilisée
  const effortsEngages = suivis
    .filter((s) => s.etat !== "atteint")
    .reduce((s, o) => s + o.effortMensuel, 0);
  const libre = capacite - effortsEngages;
  if (libre > 5000) {
    const dateCible = new Date(Date.now() + 365 * JOUR).toISOString().slice(0, 10);
    suggestions.push({
      id: "objectif-libre",
      type: "objectif",
      titre: "Créer un objectif avec votre marge libre",
      raison: `Il vous reste environ ${fcfa(libre)} par mois non affectés : voyez ce que cela donnerait en un an.`,
      valeurs: { cible: Math.round(libre * 12), deja: 0, dateCible },
    });
  }

  // 3. Fuites détectées
  const fuite = detecterFuites(ctx.transactions)[0];
  if (fuite) {
    suggestions.push({
      id: `economie-${fuite.libelle}`,
      type: "economie",
      titre: `Réduire « ${fuite.libelle} »`,
      raison: `${fuite.occurrences} opérations pour ${fcfa(fuite.total)} en 30 jours : simulez l'effet d'une réduction de moitié.`,
      valeurs: { economieMensuelle: Math.round(fuite.total / 2) },
    });
  }

  // 4. Dette la plus lourde
  const dette = ctx.dettes
    .filter((d) => d.sens === "dette" && resteDu(d) > 0)
    .sort((a, b) => resteDu(b) - resteDu(a))[0];
  if (dette) {
    suggestions.push({
      id: `dette-${dette.id}`,
      type: "dette",
      titre: `Solder plus vite ${dette.personne}`,
      raison: `Il reste ${fcfa(resteDu(dette))} : testez le rythme de remboursement qui tient dans votre budget.`,
      valeurs: {
        montant: Math.round(resteDu(dette)),
        mensualite: Math.max(1000, Math.round(Math.max(capacite, 0) / 3)),
        sens: "rembourser",
      },
    });
  }

  // 5. Enveloppe en dépassement prévisible
  const depassement = previsionFinDeMois({
    enveloppes: ctx.enveloppes,
    depensesParEnveloppe: ctx.depensesParEnveloppe,
  }).find((p) => p.projete > p.dotation && p.dotation > 0);
  if (depassement) {
    suggestions.push({
      id: `depense-${depassement.id}`,
      type: "depense",
      titre: `Tester une dépense sur « ${depassement.nom} »`,
      raison: "Cette enveloppe part pour dépasser sa dotation ce mois-ci.",
      valeurs: {
        montant: Math.max(1000, Math.round(depassement.projete - depassement.dotation)),
        enveloppeId: depassement.id,
        etalementMois: 1,
      },
    });
  }

  // 6. Tontine existante ou revenu irrégulier
  const tontine = ctx.objectifs.find((o) => o.type === "tontine");
  if (tontine) {
    suggestions.push({
      id: `tontine-${tontine.id}`,
      type: "tontine",
      titre: `Vérifier la tontine « ${tontine.libelle} »`,
      raison: "Comparez ce qu'elle vous coûte chaque mois et ce qu'elle vous rapportera à votre tour.",
      valeurs: {
        montantTour: tontine.tontineMontantTour ?? 0,
        participants: tontine.tontineParticipants ?? 10,
        rang: tontine.tontineRang ?? 1,
        frequence: tontine.tontineFrequence ?? "mois",
      },
    });
  } else if (capacite < 0) {
    suggestions.push({
      id: "revenu-manque",
      type: "revenu",
      titre: "Combien de revenu en plus pour équilibrer ?",
      raison: `Vos dépenses dépassent vos revenus d'environ ${fcfa(Math.abs(capacite))} par mois.`,
      valeurs: { variationMensuelle: Math.abs(capacite) },
    });
  }

  return suggestions.slice(0, 6);
}
