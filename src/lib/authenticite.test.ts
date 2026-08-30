import { describe, expect, it } from "vitest";
import { empreinteTicket, verifierAuthenticite } from "@/lib/authenticite";
import { extraireMontant, parseMontant, structurerTicket } from "@/lib/extraction";

const TICKET_VRAI = `SUPERMARCHE EREVAN
RCCM RB/COT/12345 - IFU 3201
Caisse 2 - Ticket 0451 - 14:32
RIZ 5KG        6 000
HUILE 1L       2 500
SAVON          1 500
TOTAL TTC     10 000
TVA 18%        1 525
ESPECES       20 000
RENDU         10 000
29/08/2026 FCFA`;

const TICKET_FAUX = `FACTURE
TOTAL 50 000
TVA 9 000
15/12/2030`;

describe("Extraction fiable des montants", () => {
  it("lit les séparateurs de milliers et les décimales", () => {
    expect(parseMontant("1.250.000")).toBe(1250000);
    expect(parseMontant("12 500")).toBe(12500);
    expect(parseMontant("1 234,56")).toBe(1235);
  });

  it("retient le total imprimé et ignore les espèces et le rendu", () => {
    expect(extraireMontant(TICKET_VRAI)).toBe(10000);
  });

  it("structure les lignes du ticket", () => {
    const s = structurerTicket(TICKET_VRAI);
    expect(s.totalAnnonce).toBe(10000);
    expect(s.especes).toBe(20000);
    expect(s.rendu).toBe(10000);
    expect(s.articles.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Contrôle d'authenticité", () => {
  it("valide un ticket cohérent", () => {
    const v = verifierAuthenticite(TICKET_VRAI, {
      confianceOcr: 92,
      montant: 10000,
      dateOperation: "2026-08-29",
      aujourdHui: new Date("2026-08-30"),
    });
    expect(v.score).toBeGreaterThanOrEqual(70);
    expect(v.blocageRecommande).toBe(false);
  });

  it("rejette un document incohérent et daté dans le futur", () => {
    const v = verifierAuthenticite(TICKET_FAUX, {
      confianceOcr: 88,
      montant: 50000,
      dateOperation: "2030-12-15",
      aujourdHui: new Date("2026-08-30"),
    });
    expect(v.verdict).toBe("suspect");
    expect(v.blocageRecommande).toBe(true);
    expect(v.indices.some((i) => i.code === "date-future")).toBe(true);
  });

  it("détecte un ticket déjà enregistré", () => {
    const empreinte = empreinteTicket(TICKET_VRAI);
    const v = verifierAuthenticite(TICKET_VRAI, {
      montant: 10000,
      empreintesConnues: [empreinte],
      aujourdHui: new Date("2026-08-30"),
    });
    expect(v.indices.some((i) => i.code === "ticket-deja-vu")).toBe(true);
  });

  it("signale une photo illisible", () => {
    const v = verifierAuthenticite("??  ##", { confianceOcr: 20, montant: 0 });
    expect(v.verdict).toBe("suspect");
  });
});
