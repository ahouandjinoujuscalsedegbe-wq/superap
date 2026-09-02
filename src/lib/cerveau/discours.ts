/**
 * Couche 3 du cerveau local : le DISCOURS.
 *
 * Un même constat doit pouvoir s'exprimer en alerte courte, en phrase de coach,
 * en ligne de rapport ou en message vocal. Toute la mise en mots est ici : les
 * couches « faits » et « règles » restent purement chiffrées.
 */
import type { Faits } from "./faits";
import type { Constat, Gravite } from "./regles";

const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

export type AlerteAffichable = {
  id: string;
  niveau: Gravite;
  titre: string;
  texte: string;
};

/** Format court pour les bandeaux d'alerte et le centre de notifications. */
export function enAlerte(constat: Constat): AlerteAffichable {
  return {
    id: constat.id,
    niveau: constat.gravite,
    titre: constat.titre,
    texte: constat.detail,
  };
}

const OUVERTURES: Record<Gravite, string> = {
  alerte: "Attention",
  attention: "Point de vigilance",
  info: "À noter",
  bravo: "Bonne nouvelle",
};

/** Phrase parlée par le coach, avec une nuance selon la confiance. */
export function enPhraseCoach(constat: Constat): string {
  const nuance =
    constat.confiance < 0.5 ? " (avec peu d'historique, cette lecture reste à confirmer)" : "";
  return `${OUVERTURES[constat.gravite]} : ${constat.titre.toLowerCase()}. ${constat.detail}${nuance}`;
}

/** Ligne compacte pour les rapports et exports texte. */
export function enLigneRapport(constat: Constat): string {
  return `- [${constat.gravite}] ${constat.titre} : ${constat.detail}`;
}

/** Version simplifiée, sans emoji ni ponctuation superflue, pour la lecture vocale. */
export function enTexteVocal(constat: Constat): string {
  return `${constat.titre}. ${constat.detail}`
    .replace(/[\p{Extended_Pictographic}]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/FCFA/g, "francs CFA")
    .trim();
}

/** Résumé global du mois, en une à trois phrases. */
export function resumeDuMois(faits: Faits, constats: Constat[]): string {
  const phrases: string[] = [
    `Ce mois-ci : ${f(faits.moisCourant.revenus)} de revenus, ${f(faits.moisCourant.depenses)} de dépenses, soit un solde de ${f(faits.moisCourant.net)}.`,
  ];
  const majeur = constats.find((c) => c.gravite === "alerte");
  if (majeur) phrases.push(enPhraseCoach(majeur));
  else {
    const bravo = constats.find((c) => c.gravite === "bravo");
    if (bravo) phrases.push(enPhraseCoach(bravo));
  }
  if (faits.categories[0]) {
    phrases.push(
      `Premier poste de dépenses : ${faits.categories[0].nom} avec ${f(faits.categories[0].montant)} (${faits.categories[0].part} %).`,
    );
  }
  return phrases.join(" ");
}

/** Rapport texte complet, prêt à copier ou partager. */
export function enRapportTexte(faits: Faits, constats: Constat[]): string {
  return [
    `RAPPORT FINANCIER — ${faits.moisCourant.mois}`,
    resumeDuMois(faits, constats),
    "",
    "Répartition des dépenses :",
    ...faits.categories.map((c) => `- ${c.nom} : ${f(c.montant)} (${c.part} %)`),
    "",
    "Constats :",
    ...constats.map(enLigneRapport),
  ].join("\n");
}
