import { beforeEach, describe, expect, it } from "vitest";
import { analyserTexte, corrigerConfusionsOcr, detaillerMontant } from "@/lib/extraction";
import {
  appliquerApprentissage,
  apprendreTicket,
  fiabiliteOcr,
  reinitialiserApprentissageOcr,
} from "@/lib/ocr-apprentissage";
import { contexteBenin } from "@/lib/tickets-benin";

const TICKET = `ALIMENTATION LE BARIC
Riz parfume 5kg 4500
Huile 1L 1500
TOTAL A PAYER
6000 FCFA
ESPECES 10000
RENDU 4000`;

// L'environnement de test n'a pas de stockage local : on en simule un.
const memoire = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => void memoire.set(k, v),
  removeItem: (k: string) => void memoire.delete(k),
  clear: () => memoire.clear(),
  key: (i: number) => [...memoire.keys()][i] ?? null,
  get length() {
    return memoire.size;
  },
} as Storage;

describe("lecture des tickets", () => {
  beforeEach(() => {
    memoire.clear();
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

describe("tickets locaux du Bénin", () => {
  it("reconnaît un reçu Mobile Money et ses frais", () => {
    const ctx = contexteBenin(`MTN MoMo
Transfert a 97 00 00 00
Montant 25000 FCFA
Frais 250 F`);
    expect(ctx.enseigne).toBe("MTN MoMo");
    expect(ctx.frais).toBe(250);
    expect(ctx.sens).toBe("depense");
  });

  it("reconnaît une recharge SBEE et propose l'électricité", () => {
    const ctx = contexteBenin("SBEE prepaye recharge compteur 5000 F CFA 12 kWh");
    expect(ctx.service).toBe("electricite");
    expect(ctx.categorie).toBe("electricite");
  });

  it("lit un reçu manuscrit de boutique avec formule locale", () => {
    const detail = detaillerMontant(`BOUTIQUE LA GRACE COTONOU
Recu la somme de
12 500 F CFA
Sac de riz`);
    expect(detail.montant).toBe(12500);
    expect(detail.source).toBe("total");
  });

  it("écarte une référence longue au profit d'un prix en FCFA", () => {
    const detail = detaillerMontant(`Pharmacie Zone
Ref 458712349
Paracetamol
1 500 FCFA`);
    expect(detail.montant).toBe(1500);
  });

  it("classe une dépense de marché dans l'enveloppe alimentation", () => {
    const op = analyserTexte("Marche Dantokpa tomate piment 2 000 F", [
      { id: "e1", nom: "Transport" },
      { id: "e2", nom: "Nourriture", categorie: "Alimentation" },
    ]);
    expect(op.indiceEnveloppe).toBe("e2");
    expect(op.type).toBe("depense");
  });
});
