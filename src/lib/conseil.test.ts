import { describe, expect, it } from "vitest";
import { conseiller, evaluerSante, planDAction } from "@/lib/conseil";
import type { Dette, Enveloppe, Transaction } from "@/lib/store";

const jourIso = (decalage: number) => new Date(Date.now() - decalage * 86_400_000).toISOString();

const enveloppes: Enveloppe[] = [
  { id: "e1", nom: "ALIMENTATION", emoji: "🍚", plafond: 50000, dotation: 50000 },
  { id: "e2", nom: "TRANSPORT", emoji: "🚕", plafond: 20000, dotation: 20000 },
];

const transactions: Transaction[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `d${i}`,
    type: "depense" as const,
    montant: 1500,
    libelle: "TAXI",
    categorie: "e2",
    compte: "ESPECES",
    date: jourIso(i + 1),
  })),
  {
    id: "r1",
    type: "revenu",
    montant: 120000,
    libelle: "SALAIRE",
    categorie: "Salaire",
    compte: "ESPECES",
    date: jourIso(5),
  },
];

const dettes: Dette[] = [
  {
    id: "de1",
    personne: "KOFFI",
    sens: "dette",
    montantInitial: 60000,
    creeLe: jourIso(30),
    remboursements: [],
  },
];

describe("Conseiller intelligent", () => {
  it("calcule un score de santé décomposé en piliers", () => {
    const s = evaluerSante({
      transactions,
      dettes,
      solde: 40000,
      enveloppes,
      depensesParEnveloppe: { e1: 10000, e2: 18000 },
    });
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.piliers).toHaveLength(5);
    expect(s.revenuMensuel).toBeGreaterThan(0);
  });

  it("propose des conseils triés par priorité", () => {
    const recos = conseiller({
      transactions,
      enveloppes,
      budgets: [],
      dettes,
      depensesParEnveloppe: { e1: 10000, e2: 30000 },
      solde: 5000,
    });
    expect(recos.length).toBeGreaterThan(2);
    expect(recos[0]?.priorite).toBe("haute");
    expect(recos.some((r) => r.categorie === "dette")).toBe(true);
    expect(recos.some((r) => r.id === "enveloppe-e2")).toBe(true);
  });

  it("construit un plan d'action par horizon", () => {
    const recos = conseiller({
      transactions,
      enveloppes,
      budgets: [],
      dettes,
      depensesParEnveloppe: { e1: 10000, e2: 30000 },
      solde: 5000,
    });
    const plans = planDAction(recos);
    expect(plans.map((p) => p.horizon)).toEqual(["30 jours", "90 jours", "1 an"]);
    expect(plans.some((p) => p.etapes.length > 0)).toBe(true);
  });
});
