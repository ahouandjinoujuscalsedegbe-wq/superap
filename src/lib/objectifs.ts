/**
 * Suivi intelligent des objectifs d'épargne, calculé entièrement sur
 * l'appareil à partir des opérations déjà enregistrées.
 */
import type { Objectif, Transaction } from "./store";

export type SuiviObjectif = {
  objectif: Objectif;
  /** Montant déjà réuni (apport initial + épargne constatée). */
  reuni: number;
  /** Montant qu'il reste à réunir. */
  restant: number;
  /** Progression en pourcentage, bornée à 100. */
  progression: number;
  /** Nombre de jours restants avant la date visée (0 si dépassée). */
  joursRestants: number;
  /** Nombre de mois restants, au minimum 1 tant que la date n'est pas passée. */
  moisRestants: number;
  /** Effort d'épargne nécessaire chaque mois pour tenir l'objectif. */
  effortMensuel: number;
  /** Rythme d'épargne réellement constaté chaque mois. */
  rythmeMensuel: number;
  /** Date prévisionnelle d'atteinte au rythme actuel (ISO), si calculable. */
  datePrevue?: string;
  etat: "atteint" | "en_avance" | "sur_la_bonne_voie" | "en_retard" | "en_danger";
  message: string;
};

const JOUR = 86400000;

function jours(a: number, b: number): number {
  return Math.max(0, Math.round((a - b) / JOUR));
}

/**
 * Calcule l'avancement d'un objectif.
 *
 * - avec une enveloppe associée : l'épargne est la somme versée dans cette
 *   enveloppe depuis la création de l'objectif ;
 * - sans enveloppe : l'épargne est le solde net (revenus − dépenses) constaté
 *   depuis la création de l'objectif.
 */
export function suivreObjectif(
  objectif: Objectif,
  transactions: Transaction[],
  maintenant = new Date(),
  transferts: Transfert[] = [],
): SuiviObjectif {
  const debut = new Date(objectif.creeLe).getTime();
  const now = maintenant.getTime();
  const echeance = new Date(objectif.dateCible).getTime();

  let epargne = 0;
  if (objectif.compteEpargne) {
    // Épargne dédiée : seuls les virements déclenchés par cet objectif comptent.
    for (const t of transferts) {
      if (t.note.startsWith(`Objectif:${objectif.id}`)) epargne += t.montant;
    }
  } else {
    for (const t of transactions) {
      const d = new Date(t.date).getTime();
      if (!Number.isFinite(d) || d < debut) continue;
      if (objectif.enveloppeId) {
        if (t.type === "depense" && t.categorie === objectif.enveloppeId) epargne += t.montant;
      } else {
        epargne += t.type === "revenu" ? t.montant : -t.montant;
      }
    }
  }

  const reuni = Math.max(0, Math.round(objectif.deja + epargne));
  const restant = Math.max(0, objectif.cible - reuni);
  const progression = Math.min(100, objectif.cible > 0 ? (reuni / objectif.cible) * 100 : 0);

  const joursRestants = jours(echeance, now);
  const moisRestants = joursRestants > 0 ? Math.max(1, joursRestants / 30.44) : 0;
  const effortMensuel = moisRestants > 0 ? Math.ceil(restant / moisRestants) : restant;

  const joursEcoules = Math.max(1, jours(now, debut));
  const rythmeMensuel = Math.round((Math.max(0, reuni - objectif.deja) / joursEcoules) * 30.44);

  const suivi: SuiviObjectif = {
    objectif,
    reuni,
    restant,
    progression,
    joursRestants,
    moisRestants: Math.ceil(moisRestants),
    effortMensuel,
    rythmeMensuel,
    etat: "sur_la_bonne_voie",
    message: "",
  };

  if (rythmeMensuel > 0 && restant > 0) {
    const joursNecessaires = (restant / rythmeMensuel) * 30.44;
    suivi.datePrevue = new Date(now + joursNecessaires * JOUR).toISOString().slice(0, 10);
  }

  if (restant === 0) {
    suivi.etat = "atteint";
    suivi.message = "Objectif atteint. Bravo !";
  } else if (joursRestants === 0) {
    suivi.etat = "en_danger";
    suivi.message = `Date dépassée : il manque ${restant.toLocaleString("fr-FR")} FCFA.`;
  } else if (rythmeMensuel >= effortMensuel * 1.15) {
    suivi.etat = "en_avance";
    suivi.message = `À ce rythme, l'objectif sera atteint avant la date visée.`;
  } else if (rythmeMensuel >= effortMensuel * 0.85) {
    suivi.etat = "sur_la_bonne_voie";
    suivi.message = `Continuez : ${effortMensuel.toLocaleString("fr-FR")} FCFA à mettre de côté chaque mois.`;
  } else if (rythmeMensuel > 0) {
    suivi.etat = "en_retard";
    suivi.message = `Rythme insuffisant : ${rythmeMensuel.toLocaleString("fr-FR")} FCFA/mois épargnés contre ${effortMensuel.toLocaleString("fr-FR")} FCFA nécessaires.`;
  } else {
    suivi.etat = "en_danger";
    suivi.message = `Aucune épargne constatée : il faut ${effortMensuel.toLocaleString("fr-FR")} FCFA chaque mois.`;
  }

  return suivi;
}

/** Suit tous les objectifs, les plus urgents en premier. */
export function suivreObjectifs(
  objectifs: Objectif[],
  transactions: Transaction[],
  maintenant = new Date(),
): SuiviObjectif[] {
  const rang: Record<SuiviObjectif["etat"], number> = {
    en_danger: 0,
    en_retard: 1,
    sur_la_bonne_voie: 2,
    en_avance: 3,
    atteint: 4,
  };
  return objectifs
    .map((o) => suivreObjectif(o, transactions, maintenant))
    .sort((a, b) => rang[a.etat] - rang[b.etat] || a.joursRestants - b.joursRestants);
}
