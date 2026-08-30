/**
 * Vérification d'authenticité d'un ticket ou d'une facture photographiée.
 *
 * L'objectif n'est pas de « prouver » qu'un document est vrai — aucun logiciel
 * hors ligne ne peut le faire — mais de détecter les incohérences qui trahissent
 * un faux ticket, un ticket retouché, une capture d'écran ou une lecture OCR
 * fautive, puis d'en informer clairement l'utilisateur avant l'enregistrement.
 *
 * Fonctions pures et testables.
 */

import { sansAccents, structurerTicket, type StructureTicket } from "./extraction";

export type NiveauIndice = "ok" | "attention" | "alerte";

export type IndiceAuthenticite = {
  niveau: NiveauIndice;
  code: string;
  message: string;
  /** Points retirés (ou ajoutés si négatif) au score de confiance. */
  poids: number;
};

export type VerdictAuthenticite = {
  /** Score de 0 à 100. */
  score: number;
  verdict: "authentique" | "a_verifier" | "suspect";
  resume: string;
  indices: IndiceAuthenticite[];
  /** Montant retenu après recoupement, s'il diffère de l'extraction brute. */
  montantRecoupe: number | null;
  /** Vrai si l'application recommande de bloquer l'enregistrement automatique. */
  blocageRecommande: boolean;
  empreinte: string;
};

/** Marqueurs attendus sur un vrai ticket de caisse ou une facture. */
const MARQUEURS: { code: string; libelle: string; test: RegExp }[] = [
  { code: "total", libelle: "un total", test: /\btotal\b|net a payer|a payer|montant du/ },
  { code: "date", libelle: "une date", test: /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/ },
  { code: "heure", libelle: "une heure", test: /\b\d{1,2}\s*[h:]\s*\d{2}\b/ },
  { code: "monnaie", libelle: "une monnaie", test: /\b(f\s*cfa|fcfa|xof|cfa|francs?)\b/ },
  { code: "fiscal", libelle: "une mention fiscale", test: /\b(tva|ht|ttc|ifu|nif|rccm|siret|n°\s*fiscal)\b/ },
  { code: "commerce", libelle: "un nom de commerce", test: /[a-z]{4,}/ },
  {
    code: "caisse",
    libelle: "une référence de caisse",
    test: /\b(caisse|ticket|facture|recu|vendeur|operateur|bon)\b/,
  },
];

/** Empreinte stable d'un ticket : sert à repérer une photo déjà enregistrée. */
export function empreinteTicket(texte: string): string {
  const base = sansAccents(texte).replace(/[^a-z0-9]/g, "");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < base.length; i += 1) {
    const c = base.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + i, 2654435761) >>> 0;
  }
  return `${h1.toString(36)}-${h2.toString(36)}-${base.length}`;
}

/** Cohérence arithmétique interne d'un ticket. */
export function coherenceArithmetique(structure: StructureTicket): {
  sommeArticles: number;
  ecartTotal: number | null;
  ecartTva: number | null;
  ecartPaiement: number | null;
} {
  const sommeArticles = structure.articles.reduce((s, a) => s + a.montant, 0);
  const total = structure.totalAnnonce;

  const ecartTotal =
    total !== null && structure.articles.length >= 2 ? Math.abs(total - sommeArticles) : null;

  let ecartTva: number | null = null;
  if (total !== null && structure.tva !== null && structure.tva > 0) {
    // TVA la plus courante en zone UEMOA : 18 %.
    const attendue = Math.round((total / 1.18) * 0.18);
    ecartTva = Math.abs(structure.tva - attendue);
  } else if (total !== null && structure.sousTotal !== null && structure.tva !== null) {
    ecartTva = Math.abs(total - (structure.sousTotal + structure.tva));
  }

  let ecartPaiement: number | null = null;
  if (total !== null && structure.especes !== null && structure.rendu !== null) {
    ecartPaiement = Math.abs(structure.especes - structure.rendu - total);
  }

  return { sommeArticles, ecartTotal, ecartTva, ecartPaiement };
}

export type OptionsAuthenticite = {
  /** Confiance OCR renvoyée par le moteur de lecture (0 à 100). */
  confianceOcr?: number;
  /** Date de l'opération retenue (ISO). */
  dateOperation?: string;
  /** Montant retenu par l'extraction. */
  montant?: number;
  /** Empreintes de tickets déjà enregistrés. */
  empreintesConnues?: string[];
  /** Nom du fichier photographié, pour repérer les captures d'écran. */
  nomFichier?: string;
  aujourdHui?: Date;
};

/** Analyse complète d'authenticité et de fiabilité d'un ticket lu par OCR. */
export function verifierAuthenticite(
  texte: string,
  options: OptionsAuthenticite = {},
): VerdictAuthenticite {
  const {
    confianceOcr,
    dateOperation,
    montant,
    empreintesConnues = [],
    nomFichier,
    aujourdHui = new Date(),
  } = options;

  const t = sansAccents(texte);
  const structure = structurerTicket(texte);
  const coherence = coherenceArithmetique(structure);
  const indices: IndiceAuthenticite[] = [];
  const empreinte = empreinteTicket(texte);

  /* 1. Densité et lisibilité du texte lu. */
  const caracteres = t.replace(/\s/g, "").length;
  if (caracteres < 25) {
    indices.push({
      niveau: "alerte",
      code: "texte-court",
      message: "Très peu de texte lisible : la photo est floue, coupée ou ce n'est pas un ticket.",
      poids: 35,
    });
  } else if (caracteres < 60) {
    indices.push({
      niveau: "attention",
      code: "texte-maigre",
      message: "Peu de texte lisible : reprenez la photo bien à plat et bien éclairée.",
      poids: 15,
    });
  }

  const illisible = (t.match(/[^a-z0-9\s.,:/€%()+\-']/g) ?? []).length;
  if (caracteres > 0 && illisible / caracteres > 0.18) {
    indices.push({
      niveau: "attention",
      code: "caracteres-parasites",
      message: "Beaucoup de caractères parasites : la lecture est bruitée, vérifiez le montant.",
      poids: 12,
    });
  }

  /* 2. Marqueurs attendus d'un vrai document commercial. */
  const presents = MARQUEURS.filter((m) => m.test.test(t));
  const manquants = MARQUEURS.filter((m) => !m.test.test(t));
  if (presents.length >= 5) {
    indices.push({
      niveau: "ok",
      code: "marqueurs-complets",
      message: `Document structuré : ${presents.length} marqueurs de ticket reconnus.`,
      poids: -5,
    });
  } else if (presents.length <= 2) {
    indices.push({
      niveau: "alerte",
      code: "marqueurs-absents",
      message: `Structure inhabituelle : il manque ${manquants.map((m) => m.libelle).join(", ")}.`,
      poids: 30,
    });
  } else {
    indices.push({
      niveau: "attention",
      code: "marqueurs-partiels",
      message: `Document incomplet : il manque ${manquants.map((m) => m.libelle).join(", ")}.`,
      poids: 12,
    });
  }

  /* 3. Cohérence arithmétique. */
  if (structure.totalAnnonce === null) {
    indices.push({
      niveau: "attention",
      code: "total-absent",
      message: "Aucun total explicite trouvé : le montant a été déduit, contrôlez-le.",
      poids: 14,
    });
  }
  if (coherence.ecartTotal !== null) {
    const tolerance = Math.max(2, Math.round((structure.totalAnnonce ?? 0) * 0.02));
    if (coherence.ecartTotal <= tolerance) {
      indices.push({
        niveau: "ok",
        code: "total-coherent",
        message: "Le total correspond à la somme des articles.",
        poids: -12,
      });
    } else {
      indices.push({
        niveau: "alerte",
        code: "total-incoherent",
        message: `Le total annoncé (${structure.totalAnnonce}) ne correspond pas à la somme des articles (${coherence.sommeArticles}), écart de ${coherence.ecartTotal}.`,
        poids: 30,
      });
    }
  }
  if (coherence.ecartTva !== null) {
    if (coherence.ecartTva <= Math.max(5, Math.round((structure.totalAnnonce ?? 0) * 0.01))) {
      indices.push({
        niveau: "ok",
        code: "tva-coherente",
        message: "La TVA affichée est cohérente avec le total.",
        poids: -8,
      });
    } else {
      indices.push({
        niveau: "alerte",
        code: "tva-incoherente",
        message: `TVA incohérente : écart de ${coherence.ecartTva} par rapport au calcul attendu.`,
        poids: 22,
      });
    }
  }
  if (coherence.ecartPaiement !== null && coherence.ecartPaiement > 2) {
    indices.push({
      niveau: "alerte",
      code: "paiement-incoherent",
      message: `Espèces remises moins monnaie rendue ne donne pas le total (écart de ${coherence.ecartPaiement}).`,
      poids: 20,
    });
  }

  /* 4. Plausibilité du montant retenu. */
  if (montant !== undefined) {
    if (montant <= 0) {
      indices.push({
        niveau: "alerte",
        code: "montant-absent",
        message: "Aucun montant fiable n'a été extrait : saisissez-le à la main.",
        poids: 40,
      });
    } else if (montant > 20_000_000) {
      indices.push({
        niveau: "alerte",
        code: "montant-hors-norme",
        message: "Montant hors norme pour un ticket : vérifiez qu'un chiffre n'a pas été mal lu.",
        poids: 25,
      });
    } else if (
      structure.totalAnnonce !== null &&
      Math.abs(structure.totalAnnonce - montant) > Math.max(2, structure.totalAnnonce * 0.02)
    ) {
      indices.push({
        niveau: "attention",
        code: "montant-divergent",
        message: `Le montant retenu diffère du total imprimé (${structure.totalAnnonce}).`,
        poids: 18,
      });
    }
  }

  /* 5. Date plausible. */
  if (dateOperation) {
    const d = new Date(dateOperation);
    if (!Number.isNaN(d.getTime())) {
      const jours = Math.round((d.getTime() - aujourdHui.getTime()) / 86_400_000);
      if (jours > 1) {
        indices.push({
          niveau: "alerte",
          code: "date-future",
          message: `La date lue est dans le futur (${dateOperation}) : ticket antidaté ou lecture erronée.`,
          poids: 28,
        });
      } else if (jours < -730) {
        indices.push({
          niveau: "attention",
          code: "date-ancienne",
          message: `La date lue est très ancienne (${dateOperation}) : vérifiez-la.`,
          poids: 12,
        });
      }
    }
  }

  /* 6. Ticket déjà enregistré (même photo présentée deux fois). */
  if (empreintesConnues.includes(empreinte)) {
    indices.push({
      niveau: "alerte",
      code: "ticket-deja-vu",
      message: "Ce ticket a déjà été enregistré : risque de double comptabilisation.",
      poids: 35,
    });
  }

  /* 7. Indices de retouche ou de document généré. */
  if (/capture|screenshot|whatsapp|img[-_]?\d{8}|photoshop|canva/.test(sansAccents(nomFichier ?? ""))) {
    indices.push({
      niveau: "attention",
      code: "image-partagee",
      message: "Image reçue ou capturée plutôt que photographiée : contrôlez son origine.",
      poids: 15,
    });
  }
  const montants = structure.articles.map((a) => a.montant);
  if (montants.length >= 3 && montants.every((m) => m % 1000 === 0)) {
    indices.push({
      niveau: "attention",
      code: "montants-ronds",
      message: "Tous les montants sont parfaitement ronds : inhabituel pour un vrai ticket.",
      poids: 12,
    });
  }
  if (/\b(specimen|exemple|modele|test|facture pro ?forma|devis)\b/.test(t)) {
    indices.push({
      niveau: "alerte",
      code: "document-non-comptable",
      message: "Le document se présente comme un devis, un spécimen ou un modèle, pas une preuve d'achat.",
      poids: 40,
    });
  }

  /* 8. Confiance OCR du moteur de lecture. */
  if (typeof confianceOcr === "number" && confianceOcr > 0) {
    if (confianceOcr < 55) {
      indices.push({
        niveau: "alerte",
        code: "ocr-faible",
        message: `Lecture peu fiable (${Math.round(confianceOcr)} %) : reprenez la photo.`,
        poids: 25,
      });
    } else if (confianceOcr < 75) {
      indices.push({
        niveau: "attention",
        code: "ocr-moyen",
        message: `Lecture moyennement fiable (${Math.round(confianceOcr)} %) : contrôlez chaque champ.`,
        poids: 10,
      });
    } else {
      indices.push({
        niveau: "ok",
        code: "ocr-bon",
        message: `Lecture nette (${Math.round(confianceOcr)} %).`,
        poids: -6,
      });
    }
  }

  const penalite = indices.reduce((s, i) => s + i.poids, 0);
  const score = Math.max(0, Math.min(100, 100 - penalite));
  const alertes = indices.filter((i) => i.niveau === "alerte").length;

  const verdict: VerdictAuthenticite["verdict"] =
    score >= 75 && alertes === 0 ? "authentique" : score >= 45 && alertes <= 1 ? "a_verifier" : "suspect";

  const resume =
    verdict === "authentique"
      ? "Ticket cohérent : montants, TVA et structure concordent."
      : verdict === "a_verifier"
        ? "Ticket probablement valable, mais certains éléments doivent être contrôlés à la main."
        : "Ticket douteux : plusieurs incohérences détectées, ne l'enregistrez pas sans vérification.";

  const montantRecoupe =
    structure.totalAnnonce !== null && structure.totalAnnonce !== montant
      ? structure.totalAnnonce
      : null;

  return {
    score,
    verdict,
    resume,
    indices: indices.sort(
      (a, b) => ordreNiveau(b.niveau) - ordreNiveau(a.niveau) || b.poids - a.poids,
    ),
    montantRecoupe,
    blocageRecommande: verdict === "suspect",
    empreinte,
  };
}

function ordreNiveau(n: NiveauIndice): number {
  return n === "alerte" ? 2 : n === "attention" ? 1 : 0;
}
