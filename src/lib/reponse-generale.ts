/**
 * Moteur de réponse générale du conseiller.
 *
 * Le conseiller ne se limite plus au budget et aux enveloppes : il interroge
 * le réseau unifié des intelligences (cerveau, coach, analyste, suivi
 * planifié, objectifs, lecture des tickets, mémoire des habitudes)
 * pour répondre à beaucoup plus de questions, toujours hors ligne.
 */
import { resteDu } from "./store";
import {
  etatApprentissage,
  photoComptes,
  photoDettes,
  resumeReseau,
  type EtatIA,
} from "./ia-unifiee";
import { phrasesHabitudes } from "./memoire-utilisateur";

export type ReponseGenerale = { reponse: string; details: string[] };

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

function normaliser(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Domaines couverts par le moteur général, dans l'ordre de priorité. */
const DOMAINES: { id: string; motif: RegExp }[] = [
  {
    id: "capacites",
    motif: /que sais tu|que peux tu|tes capacites|aide moi a te parler|tu sais quoi/,
  },
  {
    id: "apprentissage",
    motif:
      /apprentissage|appris|apprends|tu apprends|intelligence|ia\b|memoire|habitude|tu me connais|fiabilite/,
  },
  { id: "comptes", motif: /\bcompte|solde|banque|momo|moov|wave|especes|caisse|disponible/ },
  { id: "dettes", motif: /dette|creance|je dois|on me doit|rembours|prete|emprunt/ },
  { id: "objectifs", motif: /objectif|epargne|economiser pour|projet d achat|mettre de cote/ },
  { id: "planifie", motif: /planifi|prevu|suivi|compare|ecart|reel/ },
  { id: "previsions", motif: /prevision|projection|fin du mois|prochain mois|futur|tiendrai/ },
  { id: "alertes", motif: /alerte|probleme|risque|danger|attention|vigilance/ },
  {
    id: "resume",
    motif: /resume|point global|situation generale|ou en est|comment ca va|bilan general/,
  },
];

/**
 * Répond à une question qui sort du champ « budget / enveloppes » traité par
 * le coach. Renvoie null si la question n'appartient à aucun domaine connu.
 */
export function repondreGeneral(question: string, etat: EtatIA): ReponseGenerale | null {
  const q = normaliser(question);
  const domaine = DOMAINES.find((d) => d.motif.test(q))?.id;
  if (!domaine) return null;

  switch (domaine) {
    case "capacites":
      return {
        reponse:
          "Je réunis toutes les intelligences de l'application : chiffres du mois, comptes, enveloppes, dettes, objectifs, dépenses planifiées, prévisions, lecture des tickets, et vos habitudes.",
        details: [
          "Exemples : « quel est le solde de mes comptes ? », « combien je dois ? », « où en sont mes objectifs ? »",
          "« est-ce que je respecte mon budget planifié ? », « quelles alertes aujourd'hui ? »",
          "« qu'est-ce que tu as appris de moi ? », « fais-moi le point général ».",
          `Maturité actuelle de mon apprentissage : ${etat.maturite} %.`,
        ],
      };

    case "apprentissage":
      return {
        reponse: `J'apprends de tout ce que vous faites : j'en suis à ${etat.maturite} % de maturité.`,
        details: etatApprentissage(etat),
      };

    case "comptes": {
      const { soldeDisponible, solde, comptesExclus } = etat.donnees;
      return {
        reponse: `Votre solde disponible est de ${fcfa(soldeDisponible)} (solde global tous comptes : ${fcfa(
          etat.mensuel.soldeGlobal || solde,
        )}).`,
        details: [
          ...photoComptes(etat),
          comptesExclus.length > 0
            ? `Comptes mis de côté, non comptés dans le disponible : ${comptesExclus.join(", ")}.`
            : "Aucun compte n'est actuellement exclu du solde disponible.",
        ],
      };
    }

    case "dettes": {
      const { aPayer, aRecevoir, lignes } = photoDettes(etat);
      if (lignes.length === 0) {
        return {
          reponse:
            "Vous n'avez aucune dette ni créance en cours. Rien à rembourser, rien à récupérer.",
          details: [],
        };
      }
      const enRetard = etat.donnees.dettes.filter(
        (d) =>
          resteDu(d) > 0 && d.dateLimite && d.dateLimite < new Date().toISOString().slice(0, 10),
      );
      return {
        reponse: `Vous devez ${fcfa(aPayer)} et on vous doit ${fcfa(aRecevoir)}, soit une position nette de ${fcfa(
          aRecevoir - aPayer,
        )}.`,
        details: [
          ...lignes,
          ...(enRetard.length > 0
            ? [`${enRetard.length} échéance(s) sont dépassées : à traiter en priorité.`]
            : []),
        ],
      };
    }

    case "objectifs": {
      if (etat.objectifs.length === 0) {
        return {
          reponse:
            "Vous n'avez encore aucun objectif d'épargne. Créez-en un et je calculerai l'effort mensuel à prélever automatiquement.",
          details: [
            `Capacité d'épargne du mois : ${fcfa(Math.max(0, etat.mensuel.revenus - etat.mensuel.depenses))}.`,
          ],
        };
      }
      const effort = etat.objectifs.reduce((s, o) => s + o.effortMensuel, 0);
      return {
        reponse: `Vous suivez ${etat.objectifs.length} objectif(s), pour un effort d'épargne de ${fcfa(
          effort,
        )} par mois.`,
        details: etat.objectifs.map(
          (o) =>
            `${o.objectif.libelle} : ${o.progression} % réunis (${fcfa(o.reuni)} / ${fcfa(
              o.objectif.cible,
            )}), reste ${fcfa(o.restant)} — ${o.message}`,
        ),
      };
    }

    case "planifie": {
      if (etat.suivi.length === 0) {
        return {
          reponse:
            "Aucune dépense planifiée ni réelle enregistrée ce mois-ci : je n'ai pas encore de comparaison à vous montrer.",
          details: ["Planifiez vos dépenses dans Budgétisation pour que je suive les écarts."],
        };
      }
      const planifie = etat.suivi.reduce((s, l) => s + l.planifie, 0);
      const reel = etat.suivi.reduce((s, l) => s + l.reel, 0);
      const depassees = etat.suivi.filter((l) => l.ecart > 0);
      return {
        reponse:
          reel <= planifie
            ? `Bravo : ${fcfa(reel)} dépensés pour ${fcfa(planifie)} planifiés, il vous reste ${fcfa(
                planifie - reel,
              )}.`
            : `Attention : ${fcfa(reel)} dépensés pour ${fcfa(planifie)} planifiés, soit ${fcfa(
                reel - planifie,
              )} de trop.`,
        details: [
          ...etat.suivi
            .slice(0, 6)
            .map(
              (l) =>
                `${l.emoji} ${l.nom} : prévu ${fcfa(l.planifie)}, réel ${fcfa(l.reel)} (${
                  l.ecart > 0 ? "+" : ""
                }${fcfa(l.ecart)})`,
            ),
          depassees.length > 0
            ? `À surveiller : ${depassees.map((l) => l.nom).join(", ")}.`
            : "Toutes vos enveloppes tiennent leur plan.",
        ],
      };
    }

    case "previsions": {
      const b = etat.mensuel;
      return {
        reponse: `Au rythme de ${fcfa(b.rythmeJour)} par jour, vos dépenses devraient atteindre ${fcfa(
          b.projection,
        )} d'ici la fin du mois.`,
        details: [
          `Revenus du mois : ${fcfa(b.revenus)} — dépenses déjà réalisées : ${fcfa(b.depenses)}.`,
          `Taux d'épargne actuel : ${b.tauxEpargne} %.`,
          b.moyenneSaison > 0
            ? `Moyenne des mêmes mois précédents : ${fcfa(b.moyenneSaison)} (${
                b.ecartSaison > 0 ? "+" : ""
              }${b.ecartSaisonPct} %).`
            : "Je manque encore d'historique pour comparer à la même période des années passées.",
          etat.cerveau.faits ? etat.cerveau.resume : "",
        ].filter((d) => d.length > 0),
      };
    }

    case "alertes": {
      const graves = etat.cerveau.constats.filter(
        (c) => c.gravite === "alerte" || c.gravite === "attention",
      );
      if (graves.length === 0) {
        return {
          reponse: "Aucune alerte en cours : votre situation est sous contrôle aujourd'hui.",
          details: [etat.cerveau.resume],
        };
      }
      return {
        reponse: `J'ai ${graves.length} point(s) de vigilance pour vous.`,
        details: graves.slice(0, 8).map((c) => `${c.titre} — ${c.detail}`),
      };
    }

    case "resume":
    default:
      return {
        reponse: resumeReseau(etat)[0] ?? etat.cerveau.resume,
        details: [...resumeReseau(etat).slice(1), ...phrasesHabitudes(etat.habitudes).slice(0, 2)],
      };
  }
}

/**
 * Filet de sécurité : quand aucune intelligence n'a compris la question,
 * le conseiller répond quand même avec ce qu'il sait de l'utilisateur.
 */
export function repondreParDefaut(etat: EtatIA): ReponseGenerale {
  return {
    reponse:
      "Je n'ai pas bien saisi la question, mais voici où vous en êtes, d'après tout ce que j'observe.",
    details: [
      ...resumeReseau(etat),
      "Demandez-moi : comptes, dettes, objectifs, planifié, alertes.",
    ],
  };
}
