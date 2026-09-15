import { describe, expect, it } from "vitest";

import { fusionnerDonneesCompte } from "./multi-appareil";
import { resumesMensuels } from "./rapport-index";
import type { Etat, Transaction } from "./store";

function operation(id: string, date: string, type: Transaction["type"], montant: number) {
  return {
    id,
    date,
    type,
    montant,
    libelle: id,
    categorie: "env-1",
    compte: "Principal",
  } as unknown as Transaction;
}

const etatVide = {
  transactions: [],
  transferts: [],
  enveloppes: [],
  categories: [],
  comptes: [],
  budgets: [],
  dettes: [],
  objectifs: [],
  remplissages: [],
  membres: [],
} as unknown as Etat;

describe("mode multi-appareil", () => {
  it("ajoute ce qui manque sans effacer les données locales", () => {
    const local = {
      ...etatVide,
      transactions: [operation("a", "2026-01-05", "depense", 1000)],
      comptes: ["Principal"],
    } as unknown as Etat;
    const recu = {
      transactions: [
        operation("a", "2026-01-05", "depense", 1000),
        operation("b", "2026-01-06", "revenu", 5000),
      ],
      comptes: ["Principal", "Épargne"],
    };

    const fusion = fusionnerDonneesCompte(local, recu as never);
    expect(fusion.total).toBe(2);
    expect(fusion.etat.transactions).toHaveLength(2);
    expect(fusion.etat.comptes).toContain("Épargne");
  });

  it("ne double rien quand les deux téléphones sont identiques", () => {
    const local = {
      ...etatVide,
      transactions: [operation("a", "2026-01-05", "depense", 1000)],
    } as unknown as Etat;
    const fusion = fusionnerDonneesCompte(local, {
      transactions: [operation("a", "2026-01-05", "depense", 1000)],
    } as never);
    expect(fusion.total).toBe(0);
  });
});

describe("résumés mensuels rapides", () => {
  it("regroupe un long historique par mois en une passe", () => {
    const transactions: Transaction[] = [];
    for (let annee = 2020; annee <= 2025; annee += 1) {
      for (let mois = 1; mois <= 12; mois += 1) {
        const m = String(mois).padStart(2, "0");
        transactions.push(operation(`r${annee}${m}`, `${annee}-${m}-02`, "revenu", 10000));
        transactions.push(operation(`d${annee}${m}`, `${annee}-${m}-03`, "depense", 4000));
      }
    }
    const resumes = resumesMensuels(transactions, []);
    const janvier2021 = resumes.find((r) => r.mois === "2021-01");
    expect(janvier2021?.revenus).toBe(10000);
    expect(janvier2021?.depenses).toBe(4000);
    expect(janvier2021?.net).toBe(6000);
    // Même liste : le résultat est réutilisé tel quel (mise en cache).
    expect(resumesMensuels(transactions, [])).toBe(resumes);
  });
});
