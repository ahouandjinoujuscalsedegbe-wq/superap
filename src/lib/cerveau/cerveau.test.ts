import { describe, expect, it } from "vitest";
import { analyser, oublierCache } from "./index";
import type { Enveloppe, Transaction } from "../store";

const maintenant = new Date("2026-03-15T10:00:00.000Z");

function depense(id: string, montant: number, date: string, categorie = "env1"): Transaction {
  return { id, type: "depense", montant, libelle: `op ${id}`, categorie, compte: "c1", date };
}

const enveloppes: Enveloppe[] = [
  { id: "env1", nom: "Transport", emoji: "🚗", plafond: 20_000, dotation: 20_000 },
];

describe("cerveau local", () => {
  it("calcule les totaux du mois courant", () => {
    oublierCache();
    const { faits } = analyser({
      enveloppes,
      transactions: [
        { id: "r1", type: "revenu", montant: 100_000, libelle: "Salaire", categorie: "", compte: "c1", date: "2026-03-01" },
        depense("d1", 30_000, "2026-03-05"),
      ],
      maintenant,
    });
    expect(faits.moisCourant.revenus).toBe(100_000);
    expect(faits.moisCourant.depenses).toBe(30_000);
    expect(faits.moisCourant.net).toBe(70_000);
  });

  it("signale une enveloppe épuisée", () => {
    oublierCache();
    const { constats } = analyser({
      enveloppes,
      transactions: [depense("d1", 25_000, "2026-03-05")],
      maintenant,
    });
    expect(constats.some((c) => c.type === "enveloppe-epuisee")).toBe(true);
  });

  it("alerte quand les dépenses dépassent les revenus", () => {
    oublierCache();
    const { constats } = analyser({
      enveloppes,
      transactions: [
        { id: "r1", type: "revenu", montant: 10_000, libelle: "Salaire", categorie: "", compte: "c1", date: "2026-03-01" },
        depense("d1", 40_000, "2026-03-05"),
      ],
      maintenant,
    });
    expect(constats.some((c) => c.id === "epargne-negative")).toBe(true);
  });

  it("réutilise le cache pour des données identiques", () => {
    oublierCache();
    const donnees = { enveloppes, transactions: [depense("d1", 1_000, "2026-03-05")], maintenant };
    expect(analyser(donnees)).toBe(analyser(donnees));
  });
});
