// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { construireEtatIA, type DonneesUnifiees } from "./ia-unifiee";
import { repondreGeneral } from "./reponse-generale";
import { calculerHabitudes, noterAction, oublierHabitudes } from "./memoire-utilisateur";
import type { Transaction } from "./store";

const maintenant = new Date("2026-03-15T10:00:00.000Z");

function transaction(p: Partial<Transaction>): Transaction {
  return {
    id: p.id ?? crypto.randomUUID(),
    type: p.type ?? "depense",
    montant: p.montant ?? 1000,
    libelle: p.libelle ?? "Achat",
    categorie: p.categorie ?? "Nourriture",
    compte: p.compte ?? "Espèces",
    date: p.date ?? "2026-03-10",
  };
}

function donnees(): DonneesUnifiees {
  return {
    transactions: [
      transaction({ type: "revenu", montant: 200000, libelle: "Salaire", categorie: "Salaire" }),
      transaction({ montant: 30000 }),
    ],
    enveloppes: [
      { id: "e1", nom: "Nourriture", emoji: "🍚", plafond: 50000, dotation: 50000 },
    ],
    budgets: [],
    dettes: [
      {
        id: "d1",
        personne: "Koffi",
        sens: "dette",
        montantInitial: 25000,
        creeLe: "2026-02-01",
        remboursements: [],
      },
    ],
    objectifs: [],
    comptes: ["Espèces", "Épargne"],
    comptesExclus: ["Épargne"],
    soldesParCompte: { Espèces: 170000, Épargne: 60000 },
    depensesParEnveloppe: { Nourriture: 30000 },
    solde: 170000,
    soldeDisponible: 170000,
    habitudes: calculerHabitudes(),
    collaboration: {
      ocr: 80,
      ticketsAppris: 2,
      smsReconnaissance: 70,
      smsJustesse: 90,
      budgetCorrige: 1,
      maturite: 60,
    },
    maintenant,
  };
}

describe("réseau unifié des intelligences", () => {
  beforeEach(() => {
    oublierHabitudes();
  });

  it("assemble un état commun à toutes les intelligences", () => {
    const etat = construireEtatIA(donnees());
    expect(etat.cerveau.faits).toBeTruthy();
    expect(etat.mensuel.revenus).toBe(200000);
    expect(etat.maturite).toBeGreaterThan(0);
  });

  it("répond aux questions sur les comptes en excluant l'épargne du disponible", () => {
    const r = repondreGeneral("quel est le solde de mes comptes ?", construireEtatIA(donnees()));
    expect(r).not.toBeNull();
    expect(r?.reponse).toContain("disponible");
    expect(r?.details.join(" ")).toContain("hors solde disponible");
  });

  it("répond aux questions sur les dettes", () => {
    const r = repondreGeneral("combien je dois ?", construireEtatIA(donnees()));
    expect(r?.details.join(" ")).toContain("Koffi");
  });

  it("ignore une question hors de ses domaines", () => {
    expect(repondreGeneral("bonjour", construireEtatIA(donnees()))).toBeNull();
  });

  it("mémorise les habitudes et les restitue au conseiller", () => {
    noterAction("depense", "Nourriture", 5000, new Date("2026-03-14T12:00:00.000Z"));
    noterAction("question", "épargne", 0, new Date("2026-03-14T13:00:00.000Z"));
    const h = calculerHabitudes();
    expect(h.observees).toBe(2);
    expect(h.ciblesFrequentes).toContain("Nourriture");
    const etat = construireEtatIA({ ...donnees(), habitudes: h });
    const r = repondreGeneral("qu'est-ce que tu as appris de moi ?", etat);
    expect(r?.details.join(" ")).toContain("Nourriture");
  });
});
