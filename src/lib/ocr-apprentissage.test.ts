import { beforeEach, describe, expect, it } from "vitest";
import { analyserTexte, corrigerConfusionsOcr, detaillerMontant } from "@/lib/extraction";
import {
  appliquerApprentissage,
  apprendreTicket,
  fiabiliteOcr,
  reinitialiserApprentissageOcr,
} from "@/lib/ocr-apprentissage";

const TICKET = `ALIMENTATION LE BARIC
Riz parfume 5kg 4500
Huile 1L 1500
TOTAL A PAYER
6000 FCFA
ESPECES 10000
RENDU 4000`;

describe("lecture des tickets", () => {
  beforeEach(() => {
    reinitialiserApprentissageOcr();
  });

  it("corrige les confusions OCR dans les nombres", () => {
    expect(corrigerConfusionsOcr("montant 1OOO")).toContain("1000");
    expect(corrigerConfusionsOcr("Boulangerie")).toBe("Boulangerie");
  });

  it("lit un total placé sur la ligne suivante et le recoupe", () => {
    const detail = detaillerMontant(TICKET);
    expect(detail.montant).toBe(6000);
    expect(detail.source).toBe("total");
    expect(detail.coherence).toBe("verifiee");
  });

  it("privilégie le paiement quand le total lu est incohérent", () => {
    const detail = detaillerMontant(`BOUTIQUE
Pain 500
Lait 1000
TOTAL 90000
ESPECES 2000
RENDU 500`);
    expect(detail.montant).toBe(1500);
    expect(detail.source).toBe("paiement");
  });

  it("mémorise la correction du montant et l'applique au ticket suivant", () => {
    const initial = analyserTexte(TICKET);
    apprendreTicket({
      texte: TICKET,
      propose: {
        montant: initial.montant,
        libelle: initial.libelle,
        type: initial.type,
        ...(initial.sourceMontant ? { sourceMontant: initial.sourceMontant } : {}),
      },
      valide: {
        montant: 4500 + 1500,
        libelle: "Le Baric",
        type: "depense",
        enveloppe: "env-alim",
      },
    });

    const suivant = appliquerApprentissage(analyserTexte(TICKET), TICKET);
    expect(suivant.libelle).toBe("Le Baric");
    expect(suivant.indiceEnveloppe).toBe("env-alim");
    expect(suivant.montant).toBe(6000);
  });

  it("calcule un indicateur de fiabilité", () => {
    const initial = analyserTexte(TICKET);
    apprendreTicket({
      texte: TICKET,
      propose: { montant: initial.montant, libelle: initial.libelle, type: initial.type },
      valide: { montant: initial.montant, libelle: initial.libelle, type: "depense" },
    });
    const f = fiabiliteOcr();
    expect(f.lectures).toBe(1);
    expect(f.tauxSansCorrection).toBe(100);
    expect(f.regles).toBeGreaterThan(0);
  });
});
