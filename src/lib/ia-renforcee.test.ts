import { describe, expect, it } from "vitest";
import {
  classerQuestion,
  distanceMots,
  motsPorteurs,
  normaliserQuestion,
  ressemble,
} from "./comprehension";
import { projectionRobuste } from "./previsions-robustes";
import { conseilsFins } from "./conseils-fins";
import type { Transaction } from "./store";
import type { DonneesUnifiees } from "./ia-unifiee";

describe("comprehension", () => {
  it("normalise les accents et la ponctuation", () => {
    expect(normaliserQuestion("Où en sont mes Objectifs ?")).toBe("ou en sont mes objectifs");
  });

  it("retire les mots vides", () => {
    expect(motsPorteurs("combien je dois de la dette")).toEqual(["dois", "dette"]);
  });

  it("calcule une distance d'édition bornée", () => {
    expect(distanceMots("dette", "dette")).toBe(0);
    expect(distanceMots("dete", "dette")).toBe(1);
    expect(distanceMots("compte", "banane")).toBeGreaterThan(2);
  });

  it("tolère les fautes de frappe", () => {
    expect(ressemble("epargnne", "epargne")).toBe(true);
    expect(ressemble("banane", "objectif")).toBe(false);
  });

  it("comprend les synonymes et les fautes", () => {
    expect(classerQuestion("c'est quoi mes projets en cours")?.id).toBe("objectifs");
    expect(classerQuestion("kombien je doi remboursser")?.id).toBe("dettes");
    expect(classerQuestion("tu peux faire koi")?.id).toBe("capacites");
    expect(classerQuestion("quelle est la meteo demain")).toBeNull();
  });
});

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    type: "depense",
    montant: 1000,
    libelle: "Test",
    categorie: "alimentation",
    compte: "Especes",
    date: new Date().toISOString(),
    ...partial,
  };
}

describe("projectionRobuste", () => {
  it("annonce une fiabilité faible sans données du mois", () => {
    const p = projectionRobuste([]);
    expect(p.fiabilite).toBe("faible");
    expect(p.projection).toBe(0);
  });

  it("produit une estimation dès quelques jours de saisie", () => {
    const maintenant = new Date();
    const transactions = Array.from({ length: 5 }, (_, i) =>
      tx({
        montant: 2000,
        date: new Date(
          maintenant.getFullYear(),
          maintenant.getMonth(),
          Math.max(1, maintenant.getDate() - i),
        ).toISOString(),
      }),
    );
    const p = projectionRobuste(transactions, maintenant);
    expect(p.projection).toBeGreaterThan(0);
    expect(["estimee", "faible"]).toContain(p.fiabilite);
    expect(p.methode.length).toBeGreaterThan(10);
  });

  it("atteint une bonne fiabilité avec un historique profond", () => {
    const maintenant = new Date();
    const transactions: Transaction[] = [];
    for (let mois = 0; mois < 3; mois++) {
      for (let jour = 1; jour <= 25; jour += 3) {
        transactions.push(
          tx({
            montant: 3000,
            date: new Date(
              maintenant.getFullYear(),
              maintenant.getMonth() - mois,
              jour,
            ).toISOString(),
          }),
        );
      }
    }
    const p = projectionRobuste(transactions, maintenant);
    expect(p.joursHistorique).toBeGreaterThanOrEqual(60);
    expect(p.fiabilite).toBe("bonne");
    expect(p.projection).toBeGreaterThan(0);
  });
});

describe("conseilsFins", () => {
  function donnees(transactions: Transaction[]): DonneesUnifiees {
    return {
      transactions,
      enveloppes: [],
      budgets: [],
      dettes: [],
      objectifs: [],
      comptes: [],
      comptesExclus: [],
      solde: 0,
      soldeDisponible: 0,
      depensesParEnveloppe: {},
    } as unknown as DonneesUnifiees;
  }

  it("ne dit rien sans données", () => {
    expect(conseilsFins(donnees([]))).toEqual([]);
  });

  it("repère une dépense inhabituelle", () => {
    const maintenant = new Date();
    const habituelles = Array.from({ length: 6 }, (_, i) =>
      tx({
        montant: 2000,
        libelle: `Marché ${i}`,
        date: new Date(maintenant.getTime() - (i + 2) * 86_400_000).toISOString(),
      }),
    );
    const enorme = tx({ montant: 25000, libelle: "Gros achat" });
    const conseils = conseilsFins(donnees([...habituelles, enorme]), maintenant);
    expect(conseils.some((c) => c.includes("inhabituelle"))).toBe(true);
  });

  it("repère les revenus irréguliers", () => {
    const maintenant = new Date();
    const revenus = [100000, 30000, 190000].map((montant, i) =>
      tx({
        type: "revenu",
        montant,
        libelle: "Revenu",
        date: new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 5).toISOString(),
      }),
    );
    const conseils = conseilsFins(donnees(revenus), maintenant);
    expect(conseils.some((c) => c.includes("Revenus irréguliers"))).toBe(true);
  });
});
