import { describe, expect, it } from "vitest";
import { montantSurRevenu, remplissagesDus } from "./remplissage";
import type { Enveloppe } from "./store";

const base: Enveloppe = {
  id: "e1",
  nom: "TRANSPORT",
  emoji: "🚌",
  plafond: 20000,
  dotation: 25000,
  categorie: "TRANSPORT",
  compteSource: "CAISSE",
  periodeRenouvellement: "mois",
  modeRemplissage: "fixe",
  montantPeriode: 25000,
  dernierRemplissage: "2026-01-10",
};

describe("remplissage", () => {
  it("rattrape les périodes écoulées", () => {
    const dus = remplissagesDus([base], [], new Date("2026-03-15T10:00:00Z"));
    expect(dus.map((d) => d.date)).toEqual(["2026-02-10", "2026-03-10"]);
    expect(dus[0]?.compte).toBe("CAISSE");
  });

  it("ne renouvelle pas sans première période saisie", () => {
    const { dernierRemplissage: _ignore, ...sansDepart } = base;
    expect(remplissagesDus([sansDepart], [], new Date("2026-03-15T10:00:00Z"))).toHaveLength(0);
  });

  it("calcule la part d'un revenu", () => {
    const pct = { ...base, modeRemplissage: "pourcentage" as const, pourcentageRevenu: 10 };
    expect(montantSurRevenu(pct, 150000)).toBe(15000);
    expect(montantSurRevenu(base, 150000)).toBe(0);
  });
});
