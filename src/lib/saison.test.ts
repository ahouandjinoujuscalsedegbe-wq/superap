import { describe, expect, it } from "vitest";
import { bilanSaisonnier, coefficientSaison, projectionSaisonniere, saisonDe } from "./saison";
import type { Enveloppe, Transaction } from "./store";

let n = 0;
const dep = (date: string, montant: number, categorie = "ECOLE"): Transaction =>
  ({
    id: `t${(n += 1)}`,
    type: "depense",
    montant,
    categorie,
    compte: "CAISSE",
    date,
    libelle: "test",
  }) as Transaction;

const enveloppe = {
  id: "e1",
  nom: "ECOLE",
  emoji: "🎒",
  plafond: 50000,
  categorie: "ECOLE",
} as Enveloppe;

describe("saison", () => {
  it("nomme la saison du mois", () => {
    expect(saisonDe(8)).toContain("rentrée scolaire");
    expect(saisonDe(0)).toContain("sèche");
  });

  it("détecte un mois chargé grâce à l'historique", () => {
    const t = [
      dep("2025-09-05", 90000),
      dep("2025-03-05", 10000),
      dep("2025-04-05", 10000),
      dep("2025-05-05", 10000),
    ];
    expect(coefficientSaison(t, 8, 2026)).toBeGreaterThan(1.2);
    expect(coefficientSaison(t, 3, 2026)).toBeLessThan(1);
  });

  it("compare le mois en cours à la même saison de l'an dernier", () => {
    const maintenant = new Date("2026-09-15T10:00:00Z");
    const b = bilanSaisonnier(
      [enveloppe],
      [dep("2026-09-02", 60000), dep("2025-09-02", 40000)],
      maintenant,
    );
    expect(b.depenses).toBe(60000);
    expect(b.depensesAnneePrecedente).toBe(40000);
    expect(b.ecartPct).toBe(50);
    expect(b.conseils.length).toBeGreaterThan(0);
  });

  it("projette les mois à venir", () => {
    const p = projectionSaisonniere(
      [dep("2026-08-02", 30000), dep("2026-07-02", 30000)],
      100000,
      3,
      new Date("2026-09-15T10:00:00Z"),
    );
    expect(p).toHaveLength(3);
    expect(p[0]?.libelle).toBe("octobre 2026");
    expect(p[0]?.depenses).toBeGreaterThan(0);
  });
});
