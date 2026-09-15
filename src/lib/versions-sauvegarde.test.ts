import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import {
  ajouterVersion,
  lireVersions,
  marquerVersionEnvoyee,
  nettoyerVersions,
  supprimerVersion,
  tailleTotaleVersions,
  viderVersions,
  VERSIONS_MAX,
  type VersionSauvegarde,
} from "./versions-sauvegarde";
import type { ColisEnAttente } from "./sauvegarde-email";

function colis(n: number): ColisEnAttente {
  return {
    id: `id-${n}`,
    creeLe: new Date(2026, 0, n + 1).toISOString(),
    empreinte: `e-${n}`,
    contenu: `SAM5:contenu-${n}`,
    taille: 100,
  };
}

describe("coffre de versions", () => {
  beforeEach(() => {
    viderVersions();
  });

  it("empile les copies datées sans écraser les précédentes", () => {
    ajouterVersion(colis(1), "TEL", false);
    ajouterVersion(colis(2), "TEL", false);
    expect(lireVersions()).toHaveLength(2);
  });

  it("ne duplique pas une copie identique", () => {
    ajouterVersion(colis(1), "TEL", false);
    ajouterVersion(colis(1), "TEL", true);
    const liste = lireVersions();
    expect(liste).toHaveLength(1);
    expect(liste[0]!.envoyee).toBe(true);
  });

  it("garde au maximum les dernières copies", () => {
    for (let i = 0; i < VERSIONS_MAX + 5; i += 1) ajouterVersion(colis(i), "TEL", false);
    expect(lireVersions()).toHaveLength(VERSIONS_MAX);
    expect(lireVersions()[0]!.empreinte).toBe(`e-${VERSIONS_MAX + 4}`);
  });

  it("marque une copie comme envoyée et sait la supprimer", () => {
    ajouterVersion(colis(3), "TEL", false);
    marquerVersionEnvoyee("e-3");
    expect(lireVersions()[0]!.envoyee).toBe(true);
    expect(supprimerVersion("id-3")).toHaveLength(0);
  });

  it("respecte le budget de stockage local", () => {
    const grosses: VersionSauvegarde[] = [1, 2, 3].map((n) => ({
      id: `g-${n}`,
      creeLe: new Date(2026, 0, n).toISOString(),
      empreinte: `g-${n}`,
      contenu: "x",
      taille: 5_000_000,
      appareil: "TEL",
      envoyee: true,
    }));
    const gardees = nettoyerVersions(grosses);
    expect(gardees).toHaveLength(2);
    expect(tailleTotaleVersions(gardees)).toBeLessThanOrEqual(10_000_000);
  });
});
