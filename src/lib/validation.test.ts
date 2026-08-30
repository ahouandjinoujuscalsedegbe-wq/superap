import { describe, expect, it } from "vitest";
import {
  MONTANT_MAX,
  assainirBudget,
  assainirComptes,
  assainirDette,
  assainirEnveloppe,
  assainirListe,
  assainirTransaction,
  assainirTransfert,
  montantValide,
} from "./validation";

describe("montants", () => {
  it("refuse les montants impossibles", () => {
    expect(montantValide(0)).toBe(false);
    expect(montantValide(-100)).toBe(false);
    expect(montantValide(Number.NaN)).toBe(false);
    expect(montantValide(Number.POSITIVE_INFINITY)).toBe(false);
    expect(montantValide(MONTANT_MAX + 1)).toBe(false);
  });

  it("accepte un montant normal en FCFA", () => {
    expect(montantValide(25000)).toBe(true);
  });
});

describe("assainirTransaction", () => {
  const base = {
    id: "t1",
    type: "depense",
    montant: 5000,
    libelle: "MARCHÉ",
    categorie: "ALIMENTATION",
    compte: "ESPÈCES",
    date: "2026-08-30",
  };

  it("accepte une transaction correcte", () => {
    expect(assainirTransaction(base)).not.toBeNull();
  });

  it("refuse un montant négatif", () => {
    expect(assainirTransaction({ ...base, montant: -5000 })).toBeNull();
  });

  it("refuse un type inconnu", () => {
    expect(assainirTransaction({ ...base, type: "cadeau" })).toBeNull();
  });

  it("refuse une date impossible", () => {
    expect(assainirTransaction({ ...base, date: "0001-13-45" })).toBeNull();
  });

  it("refuse un objet sans identifiant", () => {
    expect(assainirTransaction({ ...base, id: "" })).toBeNull();
  });
});

describe("assainirTransfert", () => {
  it("refuse un transfert vers le même compte", () => {
    expect(
      assainirTransfert({
        id: "v1",
        source: "CAISSE",
        destination: "CAISSE",
        montant: 1000,
        date: "2026-08-30",
      }),
    ).toBeNull();
  });
});

describe("assainirEnveloppe et budget", () => {
  it("refuse une enveloppe sans nom", () => {
    expect(assainirEnveloppe({ id: "e1", nom: "  ", plafond: 1000 })).toBeNull();
  });

  it("refuse un budget de période inconnue", () => {
    expect(
      assainirBudget({
        id: "b1",
        enveloppe: "LOYER",
        montant: 1000,
        periode: "lunaire",
        compte: "BANQUE",
        prochaine: "2026-09-01",
      }),
    ).toBeNull();
  });
});

describe("assainirDette", () => {
  it("ignore les remboursements invalides sans perdre la dette", () => {
    const d = assainirDette({
      id: "d1",
      sens: "dette",
      personne: "AMI",
      montantInitial: 10000,
      creeLe: "2026-08-01",
      remboursements: [
        { id: "r1", montant: 2000, date: "2026-08-10" },
        { id: "r2", montant: -50, date: "2026-08-11" },
      ],
    });
    expect(d).not.toBeNull();
    expect(d?.remboursements).toHaveLength(1);
  });
});

describe("listes et comptes", () => {
  it("écarte les éléments invalides d'une liste reçue", () => {
    const liste = assainirListe(
      [
        { id: "a", nom: "COURSES", plafond: 5000 },
        { id: "", nom: "VIDE", plafond: 100 },
        null,
        "texte",
      ],
      assainirEnveloppe,
    );
    expect(liste).toHaveLength(1);
  });

  it("dédoublonne et nettoie les noms de comptes", () => {
    expect(assainirComptes(["CAISSE", "CAISSE", "  ", 42])).toEqual(["CAISSE"]);
  });
});
