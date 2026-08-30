/**
 * Tests automatiques des 11 intelligences de SUPER APP.
 * Chaque bloc `describe` correspond à une intelligence du cahier des charges.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { Budget, Dette, Enveloppe, Transaction } from "@/lib/store";
import { analyserTexte, extraireDate, extraireMontant, extraireType } from "@/lib/extraction";
import {
  apprendreEnveloppe,
  analyserPlusieurs,
  detecterDoublon,
  detecterRecurrence,
  decouperOperations,
  reconnaitreCommande,
  suggererEnveloppe,
} from "@/lib/saisie-plus";
import {
  alertesEnveloppes,
  detecterAnomalies,
  diagnostiquer,
  projectionFinDeMois,
  repartitionParCategorie,
  totaliser,
} from "@/lib/intelligence";
import {
  comparaisonMensuelle,
  depensesRecurrentes,
  historiqueScores,
  revenusParSource,
  suivreObjectifEpargne,
  tauxRealisationBudgets,
} from "@/lib/intelligence-plus";
import { alertesTresorerie, detecterFuites, simulerAchat } from "@/lib/simulation";
import {
  alertesProactives,
  comparerCreditComptant,
  evaluerFondsUrgence,
  simulerDecouvert,
  strategieRemboursement,
} from "@/lib/simulation-plus";
import { construirePlanning } from "@/lib/planning";

/* ---------------------------------------------------------------- */
/* Jeu de données commun                                             */
/* ---------------------------------------------------------------- */

const JOUR = 86400000;
const isoIlYA = (jours: number) => new Date(Date.now() - jours * JOUR).toISOString();

const enveloppes: Enveloppe[] = [
  {
    id: "vitaux",
    nom: "Besoins vitaux",
    emoji: "🍚",
    plafond: 100000,
    dotation: 100000,
    categorie: "Alimentation",
  },
  {
    id: "transport",
    nom: "Transport",
    emoji: "🛵",
    plafond: 30000,
    dotation: 30000,
    categorie: "Transport",
  },
];

function tx(p: Partial<Transaction> & { montant: number; type: Transaction["type"] }): Transaction {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    type: p.type,
    montant: p.montant,
    libelle: p.libelle ?? "Opération",
    categorie: p.categorie ?? "vitaux",
    compte: p.compte ?? "Espèces",
    date: p.date ?? isoIlYA(1),
  };
}

const transactions: Transaction[] = [
  tx({ type: "revenu", montant: 250000, libelle: "Salaire", categorie: "salaire", date: isoIlYA(25) }),
  tx({ type: "revenu", montant: 250000, libelle: "Salaire", categorie: "salaire", date: isoIlYA(55) }),
  tx({ type: "depense", montant: 20000, libelle: "Marché Dantokpa", date: isoIlYA(20) }),
  tx({ type: "depense", montant: 22000, libelle: "Marché Dantokpa", date: isoIlYA(10) }),
  tx({ type: "depense", montant: 18000, libelle: "Marché Dantokpa", date: isoIlYA(3) }),
  tx({ type: "depense", montant: 150000, libelle: "Réparation toiture", date: isoIlYA(2) }),
  tx({ type: "depense", montant: 5000, libelle: "Zem", categorie: "transport", date: isoIlYA(4) }),
];

const depensesParEnveloppe = { vitaux: 210000, transport: 5000 };

/* ---------------------------------------------------------------- */
/* 1. OCR de tickets — lecture d'un texte extrait d'une photo        */
/* ---------------------------------------------------------------- */

describe("Intelligence 1 — OCR de tickets", () => {
  it("extrait montant, type et libellé d'un ticket", () => {
    const r = analyserTexte("SUPERMARCHE EREVAN\nTOTAL 12 500 FCFA\n29/08/2026", enveloppes);
    expect(r.montant).toBe(12500);
    expect(r.type).toBe("depense");
    expect(r.libelle.length).toBeGreaterThanOrEqual(3);
    expect(r.confiance).toBeGreaterThan(0.5);
  });

  it("lit un montant écrit avec séparateurs", () => {
    expect(extraireMontant("MONTANT : 1.250.000 F CFA")).toBe(1250000);
  });
});

/* ---------------------------------------------------------------- */
/* 2. Dictée vocale — phrase parlée → opération                      */
/* ---------------------------------------------------------------- */

describe("Intelligence 2 — Dictée vocale", () => {
  it("transforme une phrase en opération de dépense", () => {
    const r = analyserTexte("j'ai depense 5000 francs de taxi hier", enveloppes);
    expect(r.type).toBe("depense");
    expect(r.montant).toBe(5000);
    expect(r.date).toBe(new Date(Date.now() - JOUR).toISOString().slice(0, 10));
  });

  it("reconnaît un revenu dicté", () => {
    expect(extraireType("j'ai recu un salaire de 200000")).toBe("revenu");
    expect(extraireDate("aujourd'hui", new Date("2026-08-30T10:00:00Z"))).toBe("2026-08-30");
  });
});

/* ---------------------------------------------------------------- */
/* 3. Saisie multiple + commandes vocales                            */
/* ---------------------------------------------------------------- */

describe("Intelligence 3 — Saisie multiple et navigation vocale", () => {
  it("découpe et analyse plusieurs opérations dictées", () => {
    const morceaux = decouperOperations("5000 de taxi, puis 12000 de marché");
    expect(morceaux.length).toBeGreaterThanOrEqual(2);
    const ops = analyserPlusieurs("5000 de taxi, puis 12000 de marché", enveloppes);
    expect(ops.map((o) => o.montant)).toEqual([5000, 12000]);
  });

  it("reconnaît une commande de navigation", () => {
    expect(reconnaitreCommande("ouvre les enveloppes")?.chemin).toBe("/enveloppes");
    expect(reconnaitreCommande("affiche les comptes")?.chemin).toBe("/comptes");
    expect(reconnaitreCommande("bonjour")).toBeUndefined();
  });
});

/* ---------------------------------------------------------------- */
/* 4. Mémoire des commerçants (apprentissage)                        */
/* ---------------------------------------------------------------- */

describe("Intelligence 4 — Mémoire d'apprentissage des enveloppes", () => {
  beforeEach(() => {
    const carte = new Map<string, string>();
    const stockage = {
      getItem: (k: string) => carte.get(k) ?? null,
      setItem: (k: string, v: string) => void carte.set(k, String(v)),
      removeItem: (k: string) => void carte.delete(k),
      clear: () => carte.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage;
    globalThis.window = { localStorage: stockage } as unknown as Window & typeof globalThis;
  });

  it("apprend puis suggère l'enveloppe d'un commerçant connu", () => {
    apprendreEnveloppe("Marché Dantokpa", "vitaux");
    expect(suggererEnveloppe("Marché Dantokpa")).toBe("vitaux");
    expect(suggererEnveloppe("MARCHE DANTOKPA hier")).toBe("vitaux");
    expect(suggererEnveloppe("Station Total")).toBeUndefined();
  });
});

/* ---------------------------------------------------------------- */
/* 5. Détection de doublons et de récurrences                        */
/* ---------------------------------------------------------------- */

describe("Intelligence 5 — Doublons et récurrences", () => {
  const ops = [
    { id: "a", type: "depense" as const, montant: 20000, libelle: "Loyer", date: "2026-06-01" },
    { id: "b", type: "depense" as const, montant: 20000, libelle: "Loyer", date: "2026-07-01" },
    { id: "c", type: "depense" as const, montant: 20000, libelle: "Loyer", date: "2026-08-01" },
  ];

  it("détecte un doublon proche", () => {
    const d = detecterDoublon(ops, {
      type: "depense",
      montant: 20000,
      libelle: "Loyer",
      date: "2026-08-02",
    });
    expect(d?.id).toBe("c");
  });

  it("ignore une opération différente", () => {
    expect(
      detecterDoublon(ops, {
        type: "depense",
        montant: 7000,
        libelle: "Taxi",
        date: "2026-08-02",
      }),
    ).toBeUndefined();
  });

  it("détecte une récurrence mensuelle", () => {
    const r = detecterRecurrence(ops, {
      libelle: "Loyer",
      type: "depense",
      date: "2026-09-01",
    });
    expect(r?.occurrences).toBe(3);
    expect(r?.intervalleMoyen).toBeGreaterThanOrEqual(28);
    expect(r?.intervalleMoyen).toBeLessThanOrEqual(32);
  });
});

/* ---------------------------------------------------------------- */
/* 6. Diagnostic financier et conseils                               */
/* ---------------------------------------------------------------- */

describe("Intelligence 6 — Diagnostic et conseils", () => {
  it("produit un score et des conseils cohérents", () => {
    const totaux = totaliser(transactions);
    const d = diagnostiquer({
      totaux,
      precedents: { revenus: 250000, depenses: 100000, net: 150000 },
      enveloppes,
      depensesParEnveloppe,
      dettes: [],
      budgets: [],
      solde: 40000,
    });
    expect(d.score).toBeGreaterThanOrEqual(0);
    expect(d.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(d.conseils)).toBe(true);
  });

  it("alerte quand les dépenses dépassent les revenus", () => {
    const d = diagnostiquer({
      totaux: { revenus: 100000, depenses: 180000, net: -80000 },
      precedents: { revenus: 0, depenses: 0, net: 0 },
      enveloppes,
      depensesParEnveloppe,
      dettes: [],
      budgets: [],
      solde: -5000,
    });
    expect(d.conseils.some((c) => c.id === "deficit")).toBe(true);
  });
});

/* ---------------------------------------------------------------- */
/* 7. Analyse des dépenses (répartition, projection, anomalies)      */
/* ---------------------------------------------------------------- */

describe("Intelligence 7 — Analyse des dépenses", () => {
  it("répartit les dépenses par enveloppe", () => {
    const parts = repartitionParCategorie(transactions, enveloppes);
    const total = parts.reduce((s, p) => s + p.part, 0);
    expect(parts.length).toBeGreaterThan(0);
    expect(Math.round(total)).toBeGreaterThanOrEqual(99);
  });

  it("projette la fin de mois", () => {
    const p = projectionFinDeMois(transactions);
    expect(Number.isFinite(p.projection)).toBe(true);
  });

  it("détecte une dépense inhabituelle", () => {
    const anomalies = detecterAnomalies(transactions, enveloppes);
    expect(anomalies[0]?.transaction.libelle).toBe("Réparation toiture");
    expect(anomalies[0]?.facteur).toBeGreaterThanOrEqual(2);
  });
});

/* ---------------------------------------------------------------- */
/* 8. Surveillance des enveloppes                                    */
/* ---------------------------------------------------------------- */

describe("Intelligence 8 — Surveillance des enveloppes", () => {
  it("signale une enveloppe dépassée", () => {
    const alertes = alertesEnveloppes(enveloppes, depensesParEnveloppe, transactions);
    const vitaux = alertes.find((a) => a.id === "vitaux");
    expect(vitaux).toBeDefined();
    expect(vitaux?.plafondAtteint).toBe(true);
  });

  it("n'alerte pas une enveloppe saine", () => {
    const alertes = alertesEnveloppes(enveloppes, { vitaux: 0, transport: 0 }, []);
    expect(alertes).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------- */
/* 9. Statistiques avancées (mois, sources, objectifs, budgets)      */
/* ---------------------------------------------------------------- */

describe("Intelligence 9 — Statistiques avancées", () => {
  it("compare les mois et calcule les scores", () => {
    const mois = comparaisonMensuelle(transactions, 6);
    expect(mois).toHaveLength(6);
    expect(historiqueScores(transactions, 6)).toHaveLength(6);
  });

  it("classe les revenus par source", () => {
    const sources = revenusParSource(transactions);
    expect(sources[0]?.montant).toBe(500000);
  });

  it("suit un objectif d'épargne et le taux de réalisation des budgets", () => {
    const o = suivreObjectifEpargne(transactions, 100000);
    expect(o.cible).toBe(100000);
    const budgets: Budget[] = [
      {
        id: "b1",
        libelle: "Marché",
        enveloppeId: "vitaux",
        montant: 100000,
        periode: "mois",
        compte: "Espèces",
        prochaine: new Date().toISOString().slice(0, 10),
        actif: true,
      },
    ];
    const taux = tauxRealisationBudgets(budgets, transactions, enveloppes);
    expect(taux.length).toBe(1);
    expect(depensesRecurrentes(transactions).length).toBeGreaterThanOrEqual(0);
  });
});

/* ---------------------------------------------------------------- */
/* 10. Simulations et prévisions de trésorerie                       */
/* ---------------------------------------------------------------- */

describe("Intelligence 10 — Simulations et prévisions", () => {
  it("évalue l'impact d'un achat", () => {
    const r = simulerAchat({ montant: 300000, solde: 50000, transactions });
    expect(["sereine", "tendue", "risquee"]).toContain(r.verdict);
    expect(r.moisTrajectoire).toHaveLength(12);
  });

  it("détecte les fuites et les alertes de trésorerie", () => {
    expect(Array.isArray(detecterFuites(transactions, 30))).toBe(true);
    const a = alertesTresorerie({
      transactions,
      soldes: { Espèces: 5000 },
      budgets: [],
      dettes: [],
    });
    expect(Array.isArray(a)).toBe(true);
  });

  it("compare crédit et comptant, évalue le fonds d'urgence", () => {
    const c = comparerCreditComptant({
      prix: 500000,
      tauxAnnuel: 12,
      dureeMois: 12,
      solde: 800000,
      tauxEpargne: 2,
    });
    expect(c.mensualite).toBeGreaterThan(500000 / 12);
    expect(c.recommandation).toBe("comptant");

    const f = evaluerFondsUrgence({
      transactions,
      solde: 10000,
      moisCibles: 3,
      capaciteMensuelle: 20000,
    });
    expect(f.niveau).toBe("insuffisant");
  });

  it("planifie le remboursement des dettes et produit des alertes proactives", () => {
    const dettes: Dette[] = [
      {
        id: "d1",
        personne: "Koffi",
        sens: "dette",
        montantInitial: 400000,
        creeLe: isoIlYA(30),
        remboursements: [],
      },
    ];
    const s = strategieRemboursement({ dettes, capaciteMensuelle: 20000, methode: "avalanche" });
    expect(s.etapes.length).toBeGreaterThan(0);

    const decouverts = simulerDecouvert({
      transactions,
      soldes: { Espèces: 1000 },
      budgets: [],
      jours: 60,
    });
    const alertes = alertesProactives({
      decouverts,
      fondsUrgence: evaluerFondsUrgence({
        transactions,
        solde: 1000,
        moisCibles: 3,
        capaciteMensuelle: 5000,
      }),
      capaciteMensuelle: -5000,
      dettes,
    });
    expect(alertes.some((a) => a.niveau === "critique")).toBe(true);
  });
});

/* ---------------------------------------------------------------- */
/* 11. Planning prévisionnel 14 semaines                             */
/* ---------------------------------------------------------------- */

describe("Intelligence 11 — Planning prévisionnel", () => {
  it("construit 14 semaines avec échéances et solde projeté", () => {
    const budgets: Budget[] = [
      {
        id: "b1",
        libelle: "Loyer",
        enveloppeId: "vitaux",
        montant: 50000,
        periode: "mois",
        compte: "Espèces",
        prochaine: new Date(Date.now() + 3 * JOUR).toISOString().slice(0, 10),
        actif: true,
      },
    ];
    const p = construirePlanning({
      budgets,
      transactions,
      enveloppes,
      depensesParEnveloppe,
      soldeActuel: 100000,
      nbSemaines: 14,
    });
    expect(p.semaines).toHaveLength(14);
    expect(p.totalPrevu).toBeGreaterThan(0);
    expect(Number.isFinite(p.soldeFinal)).toBe(true);
  });

  it("respecte un horizon plus court", () => {
    const p = construirePlanning({
      budgets: [],
      transactions,
      enveloppes,
      depensesParEnveloppe,
      soldeActuel: 0,
      nbSemaines: 7,
    });
    expect(p.semaines).toHaveLength(7);
    expect(p.totalPrevu).toBe(0);
  });
});
