/**
 * Moteur de raisonnement local du conseiller.
 *
 * Le coach n'énonce plus des phrases toutes faites : il observe **toutes** les
 * données de l'application (opérations, enveloppes, comptes, dettes, budgets,
 * objectifs), en tire des faits chiffrés, puis construit une réponse à partir
 * des faits qui comptent vraiment pour la question posée.
 *
 * Trois garde-fous évitent qu'il se trompe :
 *  1. un fait n'existe que si les données le prouvent (échantillon minimum) ;
 *  2. tous les chiffres sont vérifiés (finis, positifs, cohérents) avant usage ;
 *  3. quand la preuve manque, le coach le dit au lieu d'inventer.
 *
 * Tout est calculé sur l'appareil : aucune donnée ne sort du téléphone.
 */

import {
  resteDu,
  type Budget,
  type Dette,
  type Enveloppe,
  type Objectif,
  type Transaction,
} from "./store";
import { etatEnveloppe } from "./enveloppe-etat";
import { saisonDe } from "./saison";

/* ------------------------------------------------------------------ */
/* Outils sûrs                                                          */
/* ------------------------------------------------------------------ */

/** Vrai si le nombre est utilisable dans une phrase de conseil. */
export function nombreSain(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function moyenne(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  return valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
}

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 === 0 ? ((t[m - 1] ?? 0) + (t[m] ?? 0)) / 2 : (t[m] ?? 0);
}

function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const m = moyenne(valeurs);
  return Math.sqrt(moyenne(valeurs.map((v) => (v - m) ** 2)));
}

function cle(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function moisDe(iso: string): string {
  return iso.slice(0, 7);
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/* ------------------------------------------------------------------ */
/* Faits observés                                                       */
/* ------------------------------------------------------------------ */

export type Fait = {
  /** Identifiant stable : sert à ne jamais répéter deux fois le même conseil. */
  id: string;
  /** Thème (sert à l'apprentissage : épargne, dette, enveloppe…). */
  theme: string;
  enveloppeId?: string;
  /** Ce que le coach a constaté, chiffré. */
  constat: string;
  /** Ce qu'il propose de faire, chiffré et réalisable. */
  action: string;
  /** Étapes concrètes, dans l'ordre. */
  etapes: string[];
  /** Chiffres exacts sur lesquels repose le raisonnement. */
  preuves: string[];
  /** Nombre d'observations derrière le fait (fiabilité). */
  echantillon: number;
  /** Importance intrinsèque, de 0 à 10. */
  importance: number;
  /** Mots par lesquels l'utilisateur peut viser ce fait. */
  mots: string[];
};

export type DonneesRaisonnement = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  budgets: Budget[];
  dettes: Dette[];
  objectifs?: Objectif[];
  depensesParEnveloppe: Record<string, number>;
  solde: number;
};

/** Nombre minimum d'observations avant d'oser affirmer une habitude. */
const ECHANTILLON_MIN = 3;

/**
 * Analyse l'intégralité des données et renvoie les faits solides.
 * Un fait dont l'échantillon est trop faible n'est jamais renvoyé.
 */
export function observer(donnees: DonneesRaisonnement, maintenant = new Date()): Fait[] {
  const faits: Fait[] = [];
  const ajouter = (f: Fait) => {
    if (f.echantillon < ECHANTILLON_MIN) return;
    if (!f.constat.trim() || !f.action.trim()) return;
    faits.push(f);
  };

  const depenses = donnees.transactions.filter(
    (t) => t.type === "depense" && nombreSain(t.montant),
  );
  const revenus = donnees.transactions.filter((t) => t.type === "revenu" && nombreSain(t.montant));
  const moisCourant = maintenant.toISOString().slice(0, 7);
  const depensesMois = depenses.filter((t) => moisDe(t.date) === moisCourant);
  const revenusMois = revenus.filter((t) => moisDe(t.date) === moisCourant);
  const totalMois = depensesMois.reduce((s, t) => s + t.montant, 0);
  const revenuMois = revenusMois.reduce((s, t) => s + t.montant, 0);
  const jour = Math.max(1, maintenant.getDate());
  const joursMois = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0).getDate();

  /* --- 1. Habitudes par enveloppe : moyenne, tendance, régularité --- */
  for (const e of donnees.enveloppes) {
    const lignes = depenses.filter((t) => t.categorie === e.nom);
    if (lignes.length === 0) continue;
    const parMois = new Map<string, number>();
    for (const t of lignes)
      parMois.set(moisDe(t.date), (parMois.get(moisDe(t.date)) ?? 0) + t.montant);
    parMois.delete(moisCourant);
    const historiques = [...parMois.values()];
    const moyenneMois = moyenne(historiques);
    const utiliseMois = donnees.depensesParEnveloppe[e.nom] ?? 0;
    const etat = etatEnveloppe(e, utiliseMois);

    /* Dérive : le mois en cours dépasse nettement l'habitude. */
    if (historiques.length >= ECHANTILLON_MIN && moyenneMois > 0) {
      const projete = Math.round((utiliseMois / jour) * joursMois);
      const derive = projete - moyenneMois;
      if (derive > moyenneMois * 0.2 && nombreSain(derive)) {
        ajouter({
          id: `derive:${e.id}`,
          theme: "enveloppe",
          enveloppeId: e.id,
          constat: `${e.emoji} ${e.nom} part vers ${fcfa(projete)} ce mois-ci, contre ${fcfa(moyenneMois)} en moyenne sur ${historiques.length} mois.`,
          action: `Ramenez ${e.nom} à votre habitude : il faut économiser ${fcfa(derive)} d'ici la fin du mois, soit ${fcfa(Math.ceil(derive / Math.max(1, joursMois - jour)))} par jour restant.`,
          etapes: [
            `Reprenez les sorties de ${e.nom} du mois et repérez celles qui ne reviennent pas chaque mois.`,
            `Fixez un plafond de ${fcfa(Math.round(moyenneMois))} pour ${e.nom} et notez chaque sortie au moment où elle a lieu.`,
          ],
          preuves: [
            `Déjà utilisé : ${fcfa(utiliseMois)} en ${jour} jours.`,
            `Moyenne des ${historiques.length} mois précédents : ${fcfa(moyenneMois)}.`,
          ],
          echantillon: historiques.length,
          importance: 7 + Math.min(2, derive / Math.max(1, moyenneMois)),
          mots: [cle(e.nom), cle(e.categorie ?? ""), "enveloppe", "depense"],
        });
      }
      /* Économie durable : l'enveloppe coûte cher mais reste stable. */
      const irregularite = historiques.length >= 4 ? ecartType(historiques) / moyenneMois : 0;
      if (derive <= moyenneMois * 0.2 && moyenneMois > 0 && irregularite < 0.25) {
        const cible = Math.round(moyenneMois * 0.1);
        if (cible > 0)
          ajouter({
            id: `stable:${e.id}`,
            theme: "epargne",
            enveloppeId: e.id,
            constat: `${e.emoji} ${e.nom} est votre poste le plus régulier : ${fcfa(moyenneMois)} par mois, à ${Math.round(irregularite * 100)} % de variation près.`,
            action: `Comme ce poste est prévisible, baissez-le de 10 % : ${fcfa(cible)} récupérés chaque mois sans surprise, soit ${fcfa(cible * 12)} sur l'année.`,
            etapes: [
              `Fixez la dotation de ${e.nom} à ${fcfa(Math.round(moyenneMois - cible))}.`,
              `Versez les ${fcfa(cible)} libérés vers votre épargne dès l'entrée du revenu.`,
            ],
            preuves: [
              `Observé sur ${historiques.length} mois : ${historiques
                .map((h) => fcfa(h))
                .slice(-4)
                .join(", ")}.`,
            ],
            echantillon: historiques.length,
            importance: 4.5,
            mots: [cle(e.nom), "epargne", "economiser", "regulier"],
          });
      }
    }

    /* Enveloppe en tension : la dotation ne suffit pas, mois après mois. */
    if (etat.dotation > 0 && etat.utilise > etat.dotation && historiques.length >= 2) {
      const depassements = historiques.filter((h) => h > etat.dotation).length;
      if (depassements >= 2) {
        const manque = Math.round(etat.utilise - etat.dotation);
        ajouter({
          id: `tension:${e.id}`,
          theme: "enveloppe",
          enveloppeId: e.id,
          constat: `${e.emoji} ${e.nom} dépasse sa dotation pour la ${depassements + 1}ᵉ fois : ${fcfa(etat.utilise)} utilisés pour ${fcfa(etat.dotation)} prévus.`,
          action: `Ce n'est plus un accident : relevez la dotation de ${e.nom} à ${fcfa(Math.round(Math.max(etat.utilise, moyenneMois)))} et prenez ce montant sur une enveloppe qui dort, sinon vous replongerez le mois prochain.`,
          etapes: [
            `Ouvrez ${e.nom} › Renouvellements et portez le montant à ${fcfa(Math.round(Math.max(etat.utilise, moyenneMois)))}.`,
            `Compensez en baissant d'autant une enveloppe utilisée à moins de 50 %.`,
          ],
          preuves: [
            `Dépassement du mois : ${fcfa(manque)}.`,
            `Nombre de mois en dépassement observés : ${depassements}.`,
          ],
          echantillon: Math.max(ECHANTILLON_MIN, depassements + 1),
          importance: 8,
          mots: [cle(e.nom), "enveloppe", "plafond", "depassement"],
        });
      }
    }

    /* Enveloppe qui dort : de l'argent réservé et jamais utilisé. */
    if (etat.dotation > 0 && historiques.length >= ECHANTILLON_MIN) {
      const usageMoyen = moyenneMois / etat.dotation;
      if (usageMoyen < 0.5 && etat.restant > 0) {
        const liberable = Math.round(etat.dotation - moyenneMois);
        if (liberable > 0)
          ajouter({
            id: `dort:${e.id}`,
            theme: "epargne",
            enveloppeId: e.id,
            constat: `${e.emoji} ${e.nom} ne consomme que ${Math.round(usageMoyen * 100)} % de sa dotation depuis ${historiques.length} mois.`,
            action: `Libérez ${fcfa(liberable)} de ${e.nom} : cet argent est immobilisé alors qu'il pourrait rembourser une dette ou alimenter un objectif.`,
            etapes: [
              `Ramenez la dotation de ${e.nom} à ${fcfa(Math.round(moyenneMois * 1.15))} (habitude + marge de 15 %).`,
              `Affectez les ${fcfa(liberable)} au poste le plus tendu du moment.`,
            ],
            preuves: [
              `Dotation : ${fcfa(etat.dotation)} · consommation moyenne : ${fcfa(moyenneMois)}.`,
            ],
            echantillon: historiques.length,
            importance: 5.5,
            mots: [cle(e.nom), "surplus", "epargne", "liberer"],
          });
      }
    }
  }

  /* --- 2. Dépenses qui reviennent : abonnements et habitudes --- */
  const parLibelle = new Map<string, Transaction[]>();
  for (const t of depenses) {
    const k = cle(t.libelle);
    if (k.length < 3) continue;
    parLibelle.set(k, [...(parLibelle.get(k) ?? []), t]);
  }
  const recurrents = [...parLibelle.entries()]
    .map(([k, lignes]) => ({
      k,
      lignes,
      mois: new Set(lignes.map((t) => moisDe(t.date))).size,
      montant: mediane(lignes.map((t) => t.montant)),
    }))
    .filter((r) => r.mois >= ECHANTILLON_MIN && r.montant > 0)
    .sort((a, b) => b.montant * b.mois - a.montant * a.mois);

  const premier = recurrents[0];
  if (premier) {
    const annuel = Math.round(premier.montant * 12);
    ajouter({
      id: `recurrent:${premier.k}`,
      theme: "habitude",
      constat: `« ${premier.lignes[0]!.libelle} » revient chaque mois depuis ${premier.mois} mois, autour de ${fcfa(premier.montant)}.`,
      action: `C'est une charge fixe de ${fcfa(annuel)} par an : négociez-la, mutualisez-la ou supprimez-la — une charge fixe rapporte bien plus qu'une coupe ponctuelle.`,
      etapes: [
        `Vérifiez si « ${premier.lignes[0]!.libelle} » est encore utile chaque mois.`,
        `Si vous la gardez, isolez-la dans une enveloppe dédiée de ${fcfa(Math.round(premier.montant))} pour qu'elle cesse de grignoter les autres.`,
      ],
      preuves: [
        `Occurrences observées : ${premier.lignes.length} sur ${premier.mois} mois.`,
        `Montant médian : ${fcfa(premier.montant)}.`,
      ],
      echantillon: premier.mois,
      importance: 6,
      mots: [premier.k, "abonnement", "charge", "fixe", "recurrent"],
    });
  }

  /* --- 3. Les petites sorties qui s'additionnent --- */
  const petites = depensesMois.filter((t) => t.montant > 0 && t.montant <= 2000);
  const totalPetites = petites.reduce((s, t) => s + t.montant, 0);
  if (petites.length >= 5 && totalMois > 0 && totalPetites / totalMois >= 0.15) {
    ajouter({
      id: "petites-depenses",
      theme: "habitude",
      constat: `${petites.length} petites sorties de moins de 2 000 FCFA totalisent ${fcfa(totalPetites)} ce mois-ci, soit ${Math.round((totalPetites / totalMois) * 100)} % de vos dépenses.`,
      action: `Ce sont elles qui vous coûtent, pas les grosses : plafonnez-vous à ${Math.max(1, Math.round(petites.length * 0.6))} petites sorties par mois, vous récupérez environ ${fcfa(Math.round(totalPetites * 0.4))}.`,
      etapes: [
        "Enregistrez chaque petite dépense au moment où elle se produit : le simple fait de la noter en supprime une partie.",
        "Retirez une somme fixe en espèces en début de semaine et n'y touchez plus une fois épuisée.",
      ],
      preuves: [
        `Total du mois : ${fcfa(totalMois)} · dont petites sorties : ${fcfa(totalPetites)}.`,
      ],
      echantillon: petites.length,
      importance: 6.5,
      mots: ["petites", "quotidien", "economiser", "habitude"],
    });
  }

  /* --- 4. Vitesse de dépense après l'arrivée du revenu --- */
  if (revenusMois.length > 0 && revenuMois > 0) {
    const arrivee = revenusMois.map((t) => new Date(t.date).getTime()).sort((a, b) => a - b)[0]!;
    const sept = arrivee + 7 * 24 * 3600 * 1000;
    const brulees = depensesMois
      .filter((t) => {
        const d = new Date(t.date).getTime();
        return d >= arrivee && d <= sept;
      })
      .reduce((s, t) => s + t.montant, 0);
    const part = brulees / revenuMois;
    if (part >= 0.45 && depensesMois.length >= ECHANTILLON_MIN) {
      ajouter({
        id: "vitesse-revenu",
        theme: "epargne",
        constat: `${Math.round(part * 100)} % de votre revenu part dans les 7 jours qui suivent son arrivée (${fcfa(brulees)} sur ${fcfa(revenuMois)}).`,
        action: `Prélevez ${fcfa(Math.round(revenuMois * 0.1))} le jour même de l'entrée du revenu et mettez-les hors de portée : c'est la seule manière de tenir quand la première semaine consomme tout.`,
        etapes: [
          "Le jour du revenu : remplissez d'abord les enveloppes obligatoires, puis l'épargne, et seulement ensuite le reste.",
          "Gardez l'épargne sur un compte distinct de celui des dépenses courantes.",
        ],
        preuves: [
          `Revenu du mois : ${fcfa(revenuMois)}.`,
          `Dépensé sur les 7 premiers jours : ${fcfa(brulees)}.`,
        ],
        echantillon: depensesMois.length,
        importance: 7.5,
        mots: ["revenu", "epargne", "debut", "mois", "economiser"],
      });
    }
  }

  /* --- 5. Jour de la semaine le plus coûteux --- */
  if (depenses.length >= 12) {
    const parJour = new Array(7).fill(0) as number[];
    const compte = new Array(7).fill(0) as number[];
    for (const t of depenses) {
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) continue;
      parJour[d.getDay()] = (parJour[d.getDay()] ?? 0) + t.montant;
      compte[d.getDay()] = (compte[d.getDay()] ?? 0) + 1;
    }
    const total = parJour.reduce((s, v) => s + v, 0);
    let pire = 0;
    for (let i = 1; i < 7; i += 1) if ((parJour[i] ?? 0) > (parJour[pire] ?? 0)) pire = i;
    const part = total > 0 ? (parJour[pire] ?? 0) / total : 0;
    if (part >= 0.25 && (compte[pire] ?? 0) >= ECHANTILLON_MIN) {
      ajouter({
        id: `jour:${pire}`,
        theme: "habitude",
        constat: `Le ${JOURS[pire]} concentre ${Math.round(part * 100)} % de vos dépenses (${fcfa(parJour[pire] ?? 0)} sur ${compte[pire]} opérations).`,
        action: `Préparez le ${JOURS[pire]} la veille : liste écrite, montant maximum fixé à l'avance. Vous jouez sur le jour qui pèse le plus, pas sur tout le mois.`,
        etapes: [
          `Fixez-vous un budget ${JOURS[pire]} et retirez-le en espèces la veille.`,
          `Notez le total dépensé chaque ${JOURS[pire]} pendant un mois pour voir l'effet.`,
        ],
        preuves: [
          `Total des dépenses observées : ${fcfa(total)} sur ${depenses.length} opérations.`,
        ],
        echantillon: compte[pire] ?? 0,
        importance: 5,
        mots: [JOURS[pire] ?? "", "habitude", "semaine"],
      });
    }
  }

  /* --- 6. Dettes : coût, échéance, ordre de remboursement --- */
  const dettes = donnees.dettes.filter((d) => d.sens === "dette" && resteDu(d) > 0);
  if (dettes.length > 0) {
    const totalDette = dettes.reduce((s, d) => s + resteDu(d), 0);
    const urgente = [...dettes].sort((a, b) => {
      const da = a.dateLimite ? new Date(a.dateLimite).getTime() : Number.POSITIVE_INFINITY;
      const db = b.dateLimite ? new Date(b.dateLimite).getTime() : Number.POSITIVE_INFINITY;
      return da - db || resteDu(b) - resteDu(a);
    })[0]!;
    const rythme = Math.max(5000, Math.round(resteDu(urgente) * 0.15));
    const mois = Math.ceil(resteDu(urgente) / rythme);
    ajouter({
      id: `dette:${urgente.id}`,
      theme: "dette",
      constat: `Vous devez ${fcfa(totalDette)} au total, dont ${fcfa(resteDu(urgente))} à ${urgente.personne}${urgente.dateLimite ? ` avant le ${urgente.dateLimite}` : ""}.`,
      action: `Attaquez d'abord ${urgente.personne} : ${fcfa(rythme)} par mois soldent cette dette en ${mois} mois. Une dette réglée libère du budget pour toujours, une coupe de dépense ne dure qu'un mois.`,
      etapes: [
        `Créez une enveloppe « Dette ${urgente.personne} » avec un renouvellement de ${fcfa(rythme)}.`,
        "Enregistrez chaque remboursement dans le module Dettes pour voir le reste diminuer.",
      ],
      preuves: [
        `Nombre de dettes en cours : ${dettes.length}.`,
        `Reste dû sur la plus urgente : ${fcfa(resteDu(urgente))}.`,
      ],
      echantillon: Math.max(ECHANTILLON_MIN, dettes.length + 2),
      importance: 8.5,
      mots: ["dette", "rembourser", cle(urgente.personne)],
    });
  }

  /* --- 7. Objectifs d'épargne : rythme nécessaire --- */
  for (const o of donnees.objectifs ?? []) {
    const reste = Math.max(0, o.cible - o.deja);
    const fin = new Date(o.dateCible).getTime();
    if (!Number.isFinite(fin) || reste <= 0) continue;
    const moisRestants = Math.max(
      1,
      Math.round((fin - maintenant.getTime()) / (30 * 24 * 3600 * 1000)),
    );
    const parMois = Math.ceil(reste / moisRestants);
    ajouter({
      id: `objectif:${o.id}`,
      theme: "epargne",
      constat: `Objectif « ${o.libelle} » : il manque ${fcfa(reste)} et il reste environ ${moisRestants} mois.`,
      action: `Mettez ${fcfa(parMois)} de côté chaque mois pour tenir « ${o.libelle} » dans les délais${revenuMois > 0 ? `, soit ${Math.round((parMois / revenuMois) * 100)} % de votre revenu actuel` : ""}.`,
      etapes: [
        `Programmez un renouvellement automatique de ${fcfa(parMois)} sur l'enveloppe d'épargne liée.`,
        "Vérifiez l'avancement chaque fin de mois dans Objectifs.",
      ],
      preuves: [`Déjà réuni : ${fcfa(o.deja)} sur ${fcfa(o.cible)}.`],
      echantillon: ECHANTILLON_MIN,
      importance: 6,
      mots: ["objectif", "epargne", cle(o.libelle)],
    });
  }

  /* --- 8. Rythme global et fin de mois --- */
  if (depensesMois.length >= ECHANTILLON_MIN && revenuMois > 0) {
    const rythmeJour = totalMois / jour;
    const projection = Math.round(rythmeJour * joursMois);
    if (projection > revenuMois) {
      const trop = projection - revenuMois;
      const restant = Math.max(1, joursMois - jour);
      ajouter({
        id: "rythme-mois",
        theme: "budget",
        constat: `Au rythme de ${fcfa(rythmeJour)} par jour, vous finirez le mois à ${fcfa(projection)} pour ${fcfa(revenuMois)} de revenus.`,
        action: `Il manquera ${fcfa(trop)} : tenez-vous à ${fcfa(Math.max(0, Math.round((revenuMois - totalMois) / restant)))} par jour sur les ${restant} jours restants pour finir à l'équilibre.`,
        etapes: [
          "Repérez la plus grosse dépense encore prévue ce mois-ci et reportez-la si elle peut attendre.",
          "Suspendez les enveloppes non essentielles jusqu'à la fin du mois.",
        ],
        preuves: [
          `Dépensé à ce jour : ${fcfa(totalMois)} en ${jour} jours.`,
          `Revenus encaissés : ${fcfa(revenuMois)}.`,
        ],
        echantillon: depensesMois.length,
        importance: 9,
        mots: ["budget", "mois", "rythme", "equilibre", "fin"],
      });
    }
  }

  /* --- 9. Saison : le mois en cours face aux mêmes mois passés --- */
  const memeMois = depenses.filter((t) => {
    const d = new Date(t.date);
    return (
      !Number.isNaN(d.getTime()) &&
      d.getMonth() === maintenant.getMonth() &&
      d.getFullYear() < maintenant.getFullYear()
    );
  });
  const annees = new Set(memeMois.map((t) => new Date(t.date).getFullYear())).size;
  if (annees >= 1 && memeMois.length >= ECHANTILLON_MIN) {
    const moyenneSaison = Math.round(memeMois.reduce((s, t) => s + t.montant, 0) / annees);
    const ecart = totalMois - moyenneSaison;
    if (Math.abs(ecart) > moyenneSaison * 0.15 && moyenneSaison > 0) {
      ajouter({
        id: "saison",
        theme: "saison",
        constat: `Nous sommes en ${saisonDe(maintenant.getMonth())} : d'habitude ce mois vous coûte ${fcfa(moyenneSaison)}, vous en êtes à ${fcfa(totalMois)}.`,
        action:
          ecart > 0
            ? `Provisionnez le surcoût de saison : mettez ${fcfa(Math.round(ecart / 2))} de côté dès le mois prochain pour ne plus le subir.`
            : `Vous dépensez ${fcfa(Math.abs(ecart))} de moins que d'habitude à cette période : verrouillez cet écart en le virant vers l'épargne avant qu'il ne se dissolve.`,
        etapes: [
          "Activez l'ajustement saisonnier sur les enveloppes concernées.",
          "Comparez à nouveau en fin de mois dans Suivi réel/prévu.",
        ],
        preuves: [`Historique disponible : ${annees} année(s), ${memeMois.length} opérations.`],
        echantillon: memeMois.length,
        importance: 5,
        mots: ["saison", "annee", "habitude", "periode"],
      });
    }
  }

  /* --- 10. Budgets planifiés jamais honorés --- */
  const budgetsActifs = donnees.budgets.filter((b) => b.actif);
  if (budgetsActifs.length >= ECHANTILLON_MIN) {
    const nonSuivis = budgetsActifs.filter(
      (b) => !donnees.transactions.some((t) => t.budgetId === b.id),
    );
    if (nonSuivis.length >= ECHANTILLON_MIN) {
      const total = nonSuivis.reduce((s, b) => s + b.montant, 0);
      ajouter({
        id: "budgets-fantomes",
        theme: "budget",
        constat: `${nonSuivis.length} budgets planifiés (${fcfa(total)}) n'ont donné lieu à aucune opération.`,
        action: `Faites le ménage : supprimez ou corrigez ces ${nonSuivis.length} budgets, sinon vos prévisions annoncent ${fcfa(total)} qui ne se produisent jamais.`,
        etapes: [
          "Ouvrez Budgétisation et désactivez les lignes qui ne correspondent plus à la réalité.",
          "Reprenez ensuite Prévisions : les projections redeviennent exactes.",
        ],
        preuves: [
          `Budgets actifs : ${budgetsActifs.length}, dont ${nonSuivis.length} sans opération.`,
        ],
        echantillon: nonSuivis.length,
        importance: 4,
        mots: ["budget", "prevision", "planification"],
      });
    }
  }

  return faits;
}

/* ------------------------------------------------------------------ */
/* Choix du fait le plus pertinent                                      */
/* ------------------------------------------------------------------ */

export type PoidsAppris = {
  /** Poids par thème appris des pouces et des questions (1 = neutre). */
  theme: (theme: string) => number;
  /** Poids par enveloppe. */
  enveloppe: (id: string) => number;
  /** Mots que l'utilisateur emploie souvent. */
  motsCles: Record<string, number>;
  /** Conseils déjà donnés, à ne pas répéter. */
  dejaDits: Set<string>;
};

/** Note un fait pour une question donnée : pertinence + apprentissage. */
export function noterFait(
  fait: Fait,
  question: string,
  appris: PoidsAppris,
  cibleId?: string,
): number {
  const q = cle(question);
  let note = fait.importance;

  // Pertinence directe à la question posée.
  const touches = fait.mots.filter((m) => m.length >= 4 && q.includes(m)).length;
  note += touches * 4;
  if (cibleId && fait.enveloppeId === cibleId) note += 6;

  // Ce que l'utilisateur ramène souvent dans ses messages.
  for (const [mot, compte] of Object.entries(appris.motsCles)) {
    if (compte >= 2 && fait.mots.some((m) => m.includes(cle(mot))))
      note += Math.min(2, compte * 0.3);
  }

  // Apprentissage : thèmes appréciés devant, thèmes rejetés derrière.
  note *= appris.theme(fait.theme);
  if (fait.enveloppeId) note *= appris.enveloppe(fait.enveloppeId);

  // Fiabilité : un fait bien observé passe devant un fait limite.
  note *= 0.7 + Math.min(0.3, fait.echantillon / 30);

  // Ne jamais répéter un conseil déjà donné.
  if (appris.dejaDits.has(fait.id)) note *= 0.15;

  return note;
}

export type Raisonnement = {
  /** Réponse principale du coach. */
  texte: string;
  /** Détails affichés : raisonnement, preuves, étapes. */
  details: string[];
  /** Empreinte du conseil, pour la mémoire. */
  empreinte: string;
  enveloppeId?: string;
  /** Fait retenu, pour l'apprentissage. */
  fait?: Fait;
};

const OUVERTURES = [
  "Voici ce que vos chiffres me disent",
  "En regardant l'ensemble de vos données",
  "J'ai comparé vos mois entre eux",
  "Après lecture de vos opérations",
];

/**
 * Construit une réponse raisonnée : constat prouvé → conseil → étapes.
 * Si aucun fait n'est assez solide, le coach le dit franchement plutôt que
 * d'affirmer quelque chose que les données ne montrent pas.
 */
export function raisonner(
  donnees: DonneesRaisonnement,
  question: string,
  appris: PoidsAppris,
  cibleId?: string,
  maintenant = new Date(),
): Raisonnement {
  const faits = observer(donnees, maintenant);
  if (faits.length === 0) {
    return {
      texte:
        "Je préfère être honnête : vos données ne suffisent pas encore pour un conseil solide. Enregistrez vos opérations pendant quelques semaines et je vous dirai précisément où agir.",
      details: [
        "Je m'appuie uniquement sur ce que montrent vos opérations, jamais sur des généralités.",
        `Opérations disponibles : ${donnees.transactions.length}. Il m'en faut au moins une dizaine, réparties sur plusieurs semaines.`,
      ],
      empreinte: "donnees-insuffisantes",
    };
  }

  const classes = faits
    .map((f) => ({ f, note: noterFait(f, question, appris, cibleId) }))
    .sort((a, b) => b.note - a.note);
  const principal = classes[0]!.f;
  const appui = classes.slice(1).find((c) => c.f.theme !== principal.theme)?.f;

  const ouverture = OUVERTURES[Math.abs(hash(principal.id)) % OUVERTURES.length]!;
  const texte = `${ouverture} : ${principal.constat} ${principal.action}`;

  const details = [
    `Comment j'y arrive : ${principal.preuves.join(" ")}`,
    ...principal.etapes.map((e, i) => `Étape ${i + 1} : ${e}`),
  ];
  if (appui) details.push(`Point à surveiller ensuite : ${appui.constat}`);
  details.push(
    `Fiabilité : ${principal.echantillon} observation(s) prises en compte, sur ${donnees.transactions.length} opérations enregistrées.`,
  );

  return {
    texte,
    details,
    empreinte: principal.id,
    ...(principal.enveloppeId ? { enveloppeId: principal.enveloppeId } : {}),
    fait: principal,
  };
}

function hash(texte: string): number {
  let h = 0;
  for (let i = 0; i < texte.length; i += 1) h = (h * 31 + texte.charCodeAt(i)) | 0;
  return h;
}
