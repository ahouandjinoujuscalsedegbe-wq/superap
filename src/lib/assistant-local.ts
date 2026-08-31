/**
 * Assistant financier en langage naturel, 100 % hors ligne.
 *
 * L'utilisateur pose une question en français (« combien j'ai dépensé en
 * nourriture ce mois ? ») et la réponse est calculée sur l'appareil à partir
 * de ses propres données. Aucun modèle distant, aucune donnée envoyée.
 */
import type { Dette, Enveloppe, Transaction } from "./store";
import { resteDu } from "./store";

export type ReponseAssistant = {
  reponse: string;
  /** Précisions affichées sous la réponse. */
  details: string[];
  /** true quand la question n'a pas été comprise. */
  incompris: boolean;
};

export type DonneesAssistant = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  dettes: Dette[];
  comptes: string[];
  soldesParCompte: Record<string, number>;
  depensesParEnveloppe: Record<string, number>;
  solde: number;
};

const JOUR = 86400000;

function normaliser(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fcfa(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} FCFA`;
}

type Plage = { debut: number; fin: number; libelle: string };

/** Reconnaît la période citée dans la question ; par défaut le mois en cours. */
export function detecterPeriode(question: string, maintenant = new Date()): Plage {
  const q = normaliser(question);
  const now = maintenant.getTime();
  const debutJour = new Date(maintenant);
  debutJour.setHours(0, 0, 0, 0);

  if (/\baujourd'?hui\b|\bce jour\b/.test(q)) {
    return { debut: debutJour.getTime(), fin: now, libelle: "aujourd'hui" };
  }
  if (/\bhier\b/.test(q)) {
    return {
      debut: debutJour.getTime() - JOUR,
      fin: debutJour.getTime(),
      libelle: "hier",
    };
  }
  if (/cette semaine|\b7 jours\b|semaine/.test(q)) {
    return { debut: now - 7 * JOUR, fin: now, libelle: "ces 7 derniers jours" };
  }
  if (/mois (dernier|passe|precedent)/.test(q)) {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 1, 1));
    const f = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
    return { debut: d.getTime(), fin: f.getTime(), libelle: "le mois dernier" };
  }
  if (/cette annee|\ban\b|annee/.test(q)) {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));
    return { debut: d.getTime(), fin: now, libelle: "cette année" };
  }
  if (/\b3 mois\b|trimestre/.test(q)) {
    return { debut: now - 90 * JOUR, fin: now, libelle: "ces 3 derniers mois" };
  }
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  return { debut: d.getTime(), fin: now, libelle: "ce mois-ci" };
}

function dansPlage(t: Transaction, p: Plage): boolean {
  const d = new Date(t.date).getTime();
  return Number.isFinite(d) && d >= p.debut && d <= p.fin;
}

/** Retrouve l'enveloppe citée dans la question, s'il y en a une. */
function detecterEnveloppe(question: string, enveloppes: Enveloppe[]): Enveloppe | undefined {
  const q = normaliser(question);
  let meilleure: Enveloppe | undefined;
  let meilleurScore = 0;
  for (const e of enveloppes) {
    for (const terme of [e.nom, e.categorie ?? "", e.sousCategorie ?? ""]) {
      const t = normaliser(terme);
      if (t.length < 4) continue;
      if (q.includes(t) && t.length > meilleurScore) {
        meilleure = e;
        meilleurScore = t.length;
      }
    }
  }
  // Synonymes courants du quotidien.
  if (!meilleure) {
    const synonymes: [RegExp, string[]][] = [
      [/nourriture|manger|repas|marche|alimentation|nourrit/, ["aliment", "vitau", "nourrit"]],
      [/transport|zem|taxi|carburant|essence/, ["transport"]],
      [/sante|pharmacie|hopital|medicament/, ["sante"]],
      [/epargne|economie|tontine/, ["epargne"]],
      [/facture|electricite|eau|internet|loyer/, ["facture", "maison"]],
    ];
    for (const [motif, cles] of synonymes) {
      if (!motif.test(q)) continue;
      meilleure = enveloppes.find((e) =>
        cles.some(
          (c) =>
            normaliser(e.nom).includes(c) ||
            normaliser(e.categorie ?? "").includes(c) ||
            normaliser(e.id).includes(c),
        ),
      );
      if (meilleure) break;
    }
  }
  return meilleure;
}

/** Répond à une question financière en français, sans aucun accès réseau. */
export function repondre(
  question: string,
  d: DonneesAssistant,
  maintenant = new Date(),
): ReponseAssistant {
  const q = normaliser(question);
  if (q.trim().length < 3) {
    return { reponse: "Posez-moi une question sur votre budget.", details: [], incompris: true };
  }

  const plage = detecterPeriode(question, maintenant);
  const dansPeriode = d.transactions.filter((t) => dansPlage(t, plage));
  const enveloppe = detecterEnveloppe(question, d.enveloppes);
  const nomEnveloppe = new Map(d.enveloppes.map((e) => [e.id, `${e.emoji} ${e.nom}`]));

  /* --- Solde et comptes ------------------------------------------------ */
  if (/\bsolde\b|combien (il )?me reste|combien j'ai|argent disponible|\bcaisse\b/.test(q)) {
    if (!enveloppe) {
      const details = d.comptes
        .filter((c) => (d.soldesParCompte[c] ?? 0) !== 0)
        .map((c) => `${c} : ${fcfa(d.soldesParCompte[c] ?? 0)}`);
      return {
        reponse: `Votre solde disponible est de ${fcfa(d.solde)}.`,
        details,
        incompris: false,
      };
    }
  }

  /* --- Reste dans une enveloppe --------------------------------------- */
  if (enveloppe && /reste|disponible|encore|solde/.test(q)) {
    const dotation = enveloppe.dotation ?? enveloppe.plafond;
    const utilise = d.depensesParEnveloppe[enveloppe.id] ?? 0;
    const restant = dotation - utilise;
    return {
      reponse:
        restant >= 0
          ? `Il reste ${fcfa(restant)} dans ${enveloppe.emoji} ${enveloppe.nom}.`
          : `${enveloppe.emoji} ${enveloppe.nom} est dépassée de ${fcfa(-restant)}.`,
      details: [`Dotation : ${fcfa(dotation)}`, `Déjà utilisé : ${fcfa(utilise)}`],
      incompris: false,
    };
  }

  /* --- Dettes et créances --------------------------------------------- */
  if (/\bdette|je dois|on me doit|creance|emprunt/.test(q)) {
    const aPayer = d.dettes.filter((x) => x.sens === "dette").reduce((s, x) => s + resteDu(x), 0);
    const aRecevoir = d.dettes
      .filter((x) => x.sens === "creance")
      .reduce((s, x) => s + resteDu(x), 0);
    return {
      reponse: `Vous devez ${fcfa(aPayer)} et on vous doit ${fcfa(aRecevoir)}.`,
      details: d.dettes
        .filter((x) => resteDu(x) > 0)
        .map(
          (x) =>
            `${x.sens === "dette" ? "À payer" : "À recevoir"} · ${x.personne} : ${fcfa(resteDu(x))}`,
        ),
      incompris: false,
    };
  }

  /* --- Plus grosse dépense -------------------------------------------- */
  if (/plus (grosse|grande|importante)|plus cher|grosse depense|maximum/.test(q)) {
    const depenses = dansPeriode.filter((t) => t.type === "depense");
    const top = [...depenses].sort((a, b) => b.montant - a.montant)[0];
    if (!top) {
      return {
        reponse: `Aucune dépense enregistrée ${plage.libelle}.`,
        details: [],
        incompris: false,
      };
    }
    return {
      reponse: `Votre plus grosse dépense ${plage.libelle} est « ${top.libelle} » : ${fcfa(top.montant)}.`,
      details: [
        `Enveloppe : ${nomEnveloppe.get(top.categorie) ?? top.categorie}`,
        `Compte : ${top.compte}`,
      ],
      incompris: false,
    };
  }

  /* --- Répartition / top des postes ------------------------------------ */
  if (/repartition|dans quoi|le plus depense|classement|top|principaux postes/.test(q)) {
    const parEnv = new Map<string, number>();
    for (const t of dansPeriode) {
      if (t.type !== "depense") continue;
      parEnv.set(t.categorie, (parEnv.get(t.categorie) ?? 0) + t.montant);
    }
    const total = [...parEnv.values()].reduce((s, v) => s + v, 0);
    const lignes = [...parEnv.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(
        ([id, m]) =>
          `${nomEnveloppe.get(id) ?? id} : ${fcfa(m)} (${total > 0 ? Math.round((m / total) * 100) : 0} %)`,
      );
    return {
      reponse:
        total > 0
          ? `Vous avez dépensé ${fcfa(total)} ${plage.libelle}, réparti ainsi :`
          : `Aucune dépense ${plage.libelle}.`,
      details: lignes,
      incompris: false,
    };
  }

  /* --- Moyenne journalière --------------------------------------------- */
  if (/moyenne|par jour|journalier/.test(q)) {
    const depenses = dansPeriode
      .filter((t) => t.type === "depense")
      .reduce((s, t) => s + t.montant, 0);
    const nbJours = Math.max(1, Math.round((plage.fin - plage.debut) / JOUR));
    return {
      reponse: `Vous dépensez en moyenne ${fcfa(depenses / nbJours)} par jour ${plage.libelle}.`,
      details: [`Total : ${fcfa(depenses)} sur ${nbJours} jour(s)`],
      incompris: false,
    };
  }

  /* --- Revenus ---------------------------------------------------------- */
  if (/revenu|gagne|encaisse|recu|salaire|entree/.test(q)) {
    const revenus = dansPeriode.filter((t) => t.type === "revenu");
    const total = revenus.reduce((s, t) => s + t.montant, 0);
    return {
      reponse: `Vous avez reçu ${fcfa(total)} ${plage.libelle}.`,
      details: revenus.slice(0, 5).map((t) => `${t.libelle} : ${fcfa(t.montant)}`),
      incompris: false,
    };
  }

  /* --- Économies / net --------------------------------------------------- */
  if (/economise|epargne|mis de cote|reste-t-il a la fin|excedent/.test(q) && !enveloppe) {
    const revenus = dansPeriode
      .filter((t) => t.type === "revenu")
      .reduce((s, t) => s + t.montant, 0);
    const depenses = dansPeriode
      .filter((t) => t.type === "depense")
      .reduce((s, t) => s + t.montant, 0);
    const net = revenus - depenses;
    return {
      reponse:
        net >= 0
          ? `Vous avez mis ${fcfa(net)} de côté ${plage.libelle}.`
          : `Vous avez dépensé ${fcfa(-net)} de plus que vos revenus ${plage.libelle}.`,
      details: [`Revenus : ${fcfa(revenus)}`, `Dépenses : ${fcfa(depenses)}`],
      incompris: false,
    };
  }

  /* --- Dépenses (question par défaut) ------------------------------------ */
  if (/depense|coute|paye|sorti|achat|combien/.test(q)) {
    const depenses = dansPeriode.filter(
      (t) => t.type === "depense" && (!enveloppe || t.categorie === enveloppe.id),
    );
    const total = depenses.reduce((s, t) => s + t.montant, 0);
    const cible = enveloppe ? ` pour ${enveloppe.emoji} ${enveloppe.nom}` : "";
    return {
      reponse: `Vous avez dépensé ${fcfa(total)}${cible} ${plage.libelle}.`,
      details: [
        `${depenses.length} opération(s)`,
        ...[...depenses]
          .sort((a, b) => b.montant - a.montant)
          .slice(0, 3)
          .map((t) => `${t.libelle} : ${fcfa(t.montant)}`),
      ],
      incompris: false,
    };
  }

  return {
    reponse: "Je n'ai pas compris la question.",
    details: [
      "Essayez par exemple : « combien j'ai dépensé en nourriture ce mois ? »",
      "« quel est mon solde ? », « ma plus grosse dépense cette semaine »",
      "« combien il reste dans transport ? », « combien je dois ? »",
    ],
    incompris: true,
  };
}

/** Questions proposées à l'utilisateur pour démarrer. */
export const EXEMPLES_QUESTIONS = [
  "Quel est mon solde ?",
  "Combien j'ai dépensé ce mois ?",
  "Ma plus grosse dépense cette semaine",
  "Répartition de mes dépenses ce mois",
  "Combien je dois ?",
  "Combien j'ai économisé le mois dernier ?",
];
