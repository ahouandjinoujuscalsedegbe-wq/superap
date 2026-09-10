import { describe, expect, it } from "vitest";
import { cheminParent } from "./retour";

describe("arbre de retour", () => {
  it.each([
    ["/comptes/modifier/abc", "/comptes/action"],
    ["/comptes/action", "/comptes"],
    ["/comptes", "/"],
    ["/objectifs/action/creer", "/objectifs/action"],
    ["/objectifs/action/gerer", "/objectifs/action"],
    ["/objectifs/action", "/objectifs"],
    ["/budget/modifier/42", "/budget/modifier"],
    ["/budget/suivi-par/categorie", "/budget/suivi"],
    ["/budget/plan-par/enveloppe", "/budget/plan"],
    ["/enveloppes/modifier/42", "/enveloppes/modifier"],
    ["/rapport/2026-09", "/rapport"],
    ["/conseiller/donnees", "/notifications"],
    ["/historique/depenses", "/depense"],
    ["/parametres/securite", "/parametres"],
    ["/simulation", "/"],
  ])("fait remonter %s vers %s", (page, parent) => {
    expect(cheminParent(page)).toBe(parent);
  });

  it("normalise une barre finale et ignore les paramètres", () => {
    expect(cheminParent("/objectifs/action/creer/?source=accueil#haut")).toBe(
      "/objectifs/action",
    );
  });

  it("garde un repli arborescent pour une future page", () => {
    expect(cheminParent("/future/detail/element")).toBe("/future/detail");
  });
});