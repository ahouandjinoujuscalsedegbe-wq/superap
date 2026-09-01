/**
 * Couche 2 du cerveau local : les RÈGLES.
 *
 * Chaque détection est écrite une seule fois ici. Elle transforme les faits en
 * « constats » neutres, avec une gravité et un score de confiance. Aucun texte
 * d'interface n'est décidé ici : c'est le rôle de la couche « discours ».
 */
import type { Faits } from "./faits";

export type Gravite = "alerte" | "attention" | "info" | "bravo";

export type Constat = {
  id: string;
  /** Famille du constat : sert au filtrage par écran. */
  type:
    | "enveloppe-epuisee"
    | "enveloppe-bientot-vide"
    | "enveloppe-dormante"
    | "fonds-reserves"
    | "depense-inhabituelle"
    | "derive-categorie"
    | "rythme-mois"
    | "epargne"
    | "dette"
    | "objectif"
    | "solde";
  gravite: Gravite;
  titre: string;
  /** Détail chiffré, sans mise en forme d'interface. */
  detail: string;
  /** 0-1 : à quel point le constat est fiable compte tenu des données. */
  confiance: number;
  /** Poids d'affichage : plus c'est haut, plus c'est prioritaire. */
  poids: number;
};

const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const ORDRE: Record<Gravite, number> = { alerte: 0, attention: 1, info: 2, bravo: 3 };

/** Applique toutes les règles du noyau et retourne les constats triés. */
export function evaluerRegles(faits: Faits): Constat[] {
  const c: Constat[] = [];
  const conf = faits.confiance;

  // ---- fonds réservés : argent volontairement mis de côté
  // Règle apprise : un compte exclu du solde disponible sert un projet, une
  // épargne ou un usage précis. Son argent n'est pas de l'argent du quotidien,
  // on ne le propose donc jamais pour combler une dépense courante.
  if (faits.fondsReserves > 0) {
    c.push({
      id: "fonds-reserves",
      type: "fonds-reserves",
      gravite: "info",
      titre: "Fonds réservés protégés",
      detail: `${f(faits.fondsReserves)} sont réservés dans ${faits.nbEnveloppesReservees} enveloppe(s) alimentée(s) par des comptes hors solde disponible (projet, épargne ou usage précis). Cet argent est exclu des conseils du quotidien ; ${f(faits.fondsQuotidiens)} restent pour les dépenses habituelles.`,
      confiance: 1,
      poids: 40,
    });
  }

  // ---- enveloppes
  for (const e of faits.enveloppes) {
    // Une enveloppe réservée suit sa propre logique : on ne l'alarme pas comme
    // une enveloppe du quotidien, on signale seulement si elle est entamée.
    if (e.reservee) {
      if (e.epuisee && e.dotation > 0) {
        c.push({
          id: `reserve-consommee-${e.id}`,
          type: "fonds-reserves",
          gravite: "attention",
          titre: `${e.emoji} ${e.nom} : réserve consommée`,
          detail: `Cette enveloppe réservée (compte ${e.compteSource ?? "hors solde disponible"}) est entièrement utilisée : ${f(e.dotation)} affectés à son projet.`,
          confiance: 1,
          poids: 55,
        });
      }
      continue;
    }
    if (e.epuisee && e.dotation > 0) {
      c.push({
        id: `enveloppe-epuisee-${e.id}`,
        type: "enveloppe-epuisee",
        gravite: "alerte",
        titre: `${e.emoji} ${e.nom} épuisée`,
        detail: `La dotation de ${f(e.dotation)} est entièrement consommée.`,
        confiance: 1,
        poids: 100,
      });
      continue;
    }
    if (e.joursAvantEpuisement !== null && e.joursAvantEpuisement <= 15) {
      c.push({
        id: `enveloppe-bientot-vide-${e.id}`,
        type: "enveloppe-bientot-vide",
        gravite: e.joursAvantEpuisement <= 7 ? "alerte" : "attention",
        titre: `${e.emoji} ${e.nom}`,
        detail: `Au rythme de ${f(e.rythmeJour)}/jour, il reste environ ${e.joursAvantEpuisement} jour(s) avant épuisement.`,
        confiance: Math.min(1, conf + 0.2),
        poids: 90 - e.joursAvantEpuisement,
      });
      continue;
    }
    if (e.plafondAtteint) {
      c.push({
        id: `enveloppe-plafond-${e.id}`,
        type: "enveloppe-bientot-vide",
        gravite: "attention",
        titre: `${e.emoji} ${e.nom} au plafond`,
        detail: `Le plafond de dépenses est atteint ; il reste ${f(e.restant)} en réserve.`,
        confiance: 1,
        poids: 80,
      });
      continue;
    }
    if (e.dormante) {
      c.push({
        id: `enveloppe-dormante-${e.id}`,
        type: "enveloppe-dormante",
        gravite: "info",
        titre: `${e.emoji} ${e.nom} inutilisée`,
        detail: `Aucune dépense depuis plus de 60 jours alors que ${f(e.dotation)} y dorment.`,
        confiance: conf,
        poids: 30,
      });
    }
  }

  // ---- dépenses inhabituelles
  for (const a of faits.inhabituelles.slice(0, 3)) {
    c.push({
      id: `depense-inhabituelle-${a.id}`,
      type: "depense-inhabituelle",
      gravite: a.facteur >= 4 ? "alerte" : "attention",
      titre: "Dépense inhabituelle",
      detail: `${a.transaction.libelle} : ${f(a.transaction.montant)}, soit ${a.facteur}× l'habitude (${f(a.habituel)}).`,
      confiance: Math.min(1, conf + 0.3),
      poids: 70 + a.facteur,
    });
  }

  // ---- dérives de catégorie
  for (const cat of faits.categories.slice(0, 6)) {
    if (cat.variation !== null && cat.variation >= 30 && cat.montant > 0) {
      c.push({
        id: `derive-${cat.nom}`,
        type: "derive-categorie",
        gravite: cat.variation >= 60 ? "attention" : "info",
        titre: `${cat.nom} en hausse`,
        detail: `${f(cat.montant)} ce mois-ci, soit +${cat.variation} % par rapport à l'habitude.`,
        confiance: conf,
        poids: 50 + Math.min(20, cat.variation / 5),
      });
    }
    if (cat.variation !== null && cat.variation <= -25 && cat.montant > 0) {
      c.push({
        id: `baisse-${cat.nom}`,
        type: "derive-categorie",
        gravite: "bravo",
        titre: `${cat.nom} en baisse`,
        detail: `${f(cat.montant)} ce mois-ci, soit ${cat.variation} % par rapport à l'habitude.`,
        confiance: conf,
        poids: 20,
      });
    }
  }

  // ---- rythme du mois
  if (faits.moyenneDepensesMensuelles > 0 && faits.joursEcoules >= 5) {
    const ecart =
      ((faits.projectionFinDeMois - faits.moyenneDepensesMensuelles) /
        faits.moyenneDepensesMensuelles) *
      100;
    if (ecart >= 20) {
      c.push({
        id: "rythme-mois-haut",
        type: "rythme-mois",
        gravite: ecart >= 45 ? "alerte" : "attention",
        titre: "Rythme de dépenses élevé",
        detail: `À ce rythme, le mois finira à ${f(faits.projectionFinDeMois)}, soit +${Math.round(ecart)} % par rapport à la moyenne.`,
        confiance: conf,
        poids: 85,
      });
    } else if (ecart <= -15) {
      c.push({
        id: "rythme-mois-bas",
        type: "rythme-mois",
        gravite: "bravo",
        titre: "Mois bien maîtrisé",
        detail: `Projection à ${f(faits.projectionFinDeMois)}, soit ${Math.round(ecart)} % sous la moyenne habituelle.`,
        confiance: conf,
        poids: 25,
      });
    }
  }

  // ---- épargne
  if (faits.tauxEpargne !== null && faits.moisCourant.revenus > 0) {
    if (faits.tauxEpargne < 0) {
      c.push({
        id: "epargne-negative",
        type: "epargne",
        gravite: "alerte",
        titre: "Vous dépensez plus que vous ne gagnez",
        detail: `Les dépenses dépassent les revenus de ${f(faits.moisCourant.depenses - faits.moisCourant.revenus)} ce mois-ci.`,
        confiance: 1,
        poids: 99,
      });
    } else if (faits.tauxEpargne < 10) {
      c.push({
        id: "epargne-faible",
        type: "epargne",
        gravite: "attention",
        titre: "Épargne faible",
        detail: `Seulement ${faits.tauxEpargne} % des revenus sont mis de côté ce mois-ci.`,
        confiance: 0.9,
        poids: 60,
      });
    } else if (faits.tauxEpargne >= 20) {
      c.push({
        id: "epargne-solide",
        type: "epargne",
        gravite: "bravo",
        titre: "Bonne épargne",
        detail: `${faits.tauxEpargne} % des revenus sont conservés ce mois-ci.`,
        confiance: 0.9,
        poids: 20,
      });
    }
  }

  // ---- solde et découvert prévisible
  const depenseJour =
    faits.joursEcoules > 0 ? faits.moisCourant.depenses / faits.joursEcoules : 0;
  if (depenseJour > 0 && faits.solde > 0) {
    const joursTenue = Math.floor(faits.solde / depenseJour);
    if (joursTenue < faits.joursRestants) {
      c.push({
        id: "solde-insuffisant",
        type: "solde",
        gravite: "alerte",
        titre: "Risque de manque avant la fin du mois",
        detail: `Le solde de ${f(faits.solde)} couvre environ ${joursTenue} jour(s) alors qu'il en reste ${faits.joursRestants}.`,
        confiance: conf,
        poids: 98,
      });
    }
  }

  // ---- dettes
  if (faits.detteTotale > 0 && faits.moyenneRevenusMensuels > 0) {
    const part = (faits.detteTotale / faits.moyenneRevenusMensuels) * 100;
    if (part >= 40) {
      c.push({
        id: "dette-lourde",
        type: "dette",
        gravite: part >= 100 ? "alerte" : "attention",
        titre: "Endettement à surveiller",
        detail: `Vous devez ${f(faits.detteTotale)}, soit ${Math.round(part)} % d'un mois de revenus.`,
        confiance: 0.9,
        poids: 75,
      });
    }
  }

  // ---- objectifs
  for (const o of faits.objectifsEnRetard) {
    c.push({
      id: `objectif-${o.libelle}`,
      type: "objectif",
      gravite: o.joursRestants <= 0 ? "alerte" : "attention",
      titre: `Objectif « ${o.libelle} »`,
      detail:
        o.joursRestants <= 0
          ? `Échéance dépassée, il manque ${f(o.manque)}.`
          : `Il manque ${f(o.manque)} et il reste ${o.joursRestants} jour(s).`,
      confiance: 1,
      poids: 65,
    });
  }

  return c.sort(
    (a, b) => ORDRE[a.gravite] - ORDRE[b.gravite] || b.poids - a.poids,
  );
}
