import { describe, expect, it } from "vitest";
import { observer, raisonner, type DonneesRaisonnement, type PoidsAppris } from "./coach-raisonnement";
import type { Transaction } from "./store";

const APPRIS: PoidsAppris = {
  theme: () => 1,
  enveloppe: () => 1,
  motsCles: {},
  dejaDits: new Set(),
};

function op(
  date: string,
  montant: number,
  categorie: string,
  libelle = "COURSES",
  type: "depense" | "revenu" = "depense",
): Transaction {
  return { id: `${date}-${libelle}-${montant}`, type, montant, libelle, categorie, compte: "Espèces", date };
}

const MAINTENANT = new Date("2026-06-15T10:00:00Z");

function donnees(transactions: Transaction[]): DonneesRaisonnement {
  const depensesParEnveloppe: Record<string, number> = {};
  for (const t of transactions)
    if (t.type === "depense")
      depensesParEnveloppe[t.categorie] = (depensesParEnveloppe[t.categorie] ?? 0) + t.montant;
  return {
    transactions,
    enveloppes: [
      { id: "e1", nom: "MARCHÉ", emoji: "🛒", plafond: 50000, dotation: 50000, categorie: "Alimentation" },
    ],
    budgets: [],
    dettes: [],
    depensesParEnveloppe,
    solde: 100000,
  };
}

describe("raisonnement du coach", () => {
  it("ne dit rien quand les données ne prouvent rien", () => {
    const r = raisonner(donnees([op("2026-06-02", 1000, "MARCHÉ")]), "un conseil", APPRIS, undefined, MAINTENANT);
    expect(r.fait).toBeUndefined();
    expect(r.texte).toContain("ne suffisent pas");
  });

  it("repère une dérive d'enveloppe sur plusieurs mois", () => {
    const ops = [
      op("2026-03-10", 20000, "MARCHÉ"),
      op("2026-04-10", 21000, "MARCHÉ"),
      op("2026-05-10", 19000, "MARCHÉ"),
      op("2026-06-05", 40000, "MARCHÉ"),
    ];
    const faits = observer(donnees(ops), MAINTENANT);
    expect(faits.some((f) => f.id === "derive:e1")).toBe(true);
  });

  it("n'affirme jamais un chiffre invalide", () => {
    const ops: Transaction[] = [];
    for (let m = 1; m <= 5; m += 1)
      for (let j = 1; j <= 6; j += 1)
        ops.push(op(`2026-0${m}-0${j}`, 1500, "MARCHÉ", `ACHAT ${j}`));
    ops.push(op("2026-06-01", 120000, "MARCHÉ", "SALAIRE", "revenu"));
    for (const f of observer(donnees(ops), MAINTENANT)) {
      const phrases = [f.constat, f.action, ...f.etapes, ...f.preuves].join(" ");
      expect(phrases).not.toMatch(/NaN|Infinity|undefined|-\d+ FCFA/);
      expect(f.echantillon).toBeGreaterThanOrEqual(3);
    }
  });

  it("évite de répéter un conseil déjà donné", () => {
    const ops = [
      op("2026-03-10", 20000, "MARCHÉ"),
      op("2026-04-10", 21000, "MARCHÉ"),
      op("2026-05-10", 19000, "MARCHÉ"),
      op("2026-06-05", 40000, "MARCHÉ"),
      op("2026-06-01", 60000, "MARCHÉ", "SALAIRE", "revenu"),
    ];
    const premier = raisonner(donnees(ops), "conseil", APPRIS, undefined, MAINTENANT);
    const second = raisonner(
      donnees(ops),
      "conseil",
      { ...APPRIS, dejaDits: new Set([premier.empreinte]) },
      undefined,
      MAINTENANT,
    );
    expect(second.empreinte).not.toBe(premier.empreinte);
  });
});
