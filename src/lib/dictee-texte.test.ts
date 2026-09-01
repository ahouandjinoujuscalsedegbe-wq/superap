import { describe, expect, it } from "vitest";
import { nettoyerDictee } from "./dictee-texte";
import { estDemandeBudget, estDemandeConseil } from "./coach";

describe("dictée : phrases complexes", () => {
  it("chiffre les nombres composés avec traits d'union", () => {
    expect(nettoyerDictee("quatre-vingt-dix mille francs")).toContain("90000");
    expect(nettoyerDictee("dix-sept mille")).toContain("17000");
  });

  it("remet au propre les élisions et hésitations", () => {
    const t = nettoyerDictee("euh jai depensé vingt mille balles ce mois ci");
    expect(t.toLowerCase()).toContain("j'ai");
    expect(t).toContain("20000");
    expect(t).toContain("francs");
    expect(t.toLowerCase()).not.toContain("euh");
  });
});

describe("coach : tournures courantes", () => {
  it("comprend une demande de conseil familière", () => {
    expect(estDemandeConseil("je fais comment pour mettre de côté ?")).toBe(true);
    expect(estDemandeConseil("t'en penses quoi ?")).toBe(true);
  });

  it("comprend une demande de bilan familière", () => {
    expect(estDemandeBudget("ça donne quoi ce mois-ci ?")).toBe(true);
    expect(estDemandeBudget("il me reste combien ?")).toBe(true);
  });
});
