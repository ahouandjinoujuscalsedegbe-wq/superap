import { describe, expect, it } from "vitest";
import { analyserEnveloppeDictee, analyserObjectifDicte, dateDepuisDelai } from "./dictee-champs";

describe("analyserEnveloppeDictee", () => {
  it("extrait le nom, la dotation et le plafond", () => {
    const r = analyserEnveloppeDictee("enveloppe transport avec 30000 francs plafond 25000");
    expect(r.nom).toBe("Transport");
    expect(r.dotation).toBe(30000);
    expect(r.plafond).toBe(25000);
  });

  it("déduit un plafond quand il n'est pas dicté", () => {
    const r = analyserEnveloppeDictee("nouvelle enveloppe santé avec 10000 francs");
    expect(r.dotation).toBe(10000);
    expect(r.plafond).toBe(8000);
  });

  it("ne laisse jamais le plafond dépasser la dotation", () => {
    const r = analyserEnveloppeDictee("enveloppe loyer somme 20000 plafond 50000");
    expect(r.plafond).toBeLessThanOrEqual(r.dotation ?? 0);
  });
});

describe("dateDepuisDelai", () => {
  it("comprend un délai relatif", () => {
    const base = new Date("2026-01-10T00:00:00Z");
    expect(dateDepuisDelai("dans 6 mois", base)).toBe("2026-07-10");
  });
});

describe("analyserObjectifDicte", () => {
  it("extrait le libellé, le montant et la date", () => {
    const base = new Date("2026-01-10T00:00:00Z");
    const r = analyserObjectifDicte("épargner 500000 francs pour une moto dans 6 mois", base);
    expect(r.cible).toBe(500000);
    expect(r.dateCible).toBe("2026-07-10");
    expect(r.libelle).toBe("Moto");
  });
});
