import { describe, expect, it, beforeEach } from "vitest";
import {
  analyserSms,
  analyserMessages,
  apprendreSms,
  messagesDepuisTexte,
  oublierApprentissageSms,
  signatureSms,
  type ContexteSms,
} from "./sms-transactions";

const contexte: ContexteSms = {
  comptes: ["MTN MoMo", "Caisse", "UBA"],
  enveloppes: [
    { id: "e1", nom: "Carburant", categorie: "Transport" },
    { id: "e2", nom: "Électricité", categorie: "Factures" },
  ],
};

function sms(corps: string, expediteur = "MTN") {
  return { id: `m-${corps.length}-${expediteur}`, expediteur, corps, date: Date.parse("2026-09-02") };
}

beforeEach(() => {
  localStorage.clear();
  oublierApprentissageSms();
});

describe("analyserSms", () => {
  it("détecte un encaissement Mobile Money", () => {
    const op = analyserSms(
      sms("Vous avez recu 25 000 FCFA de Jean KODJO. Frais: 0 FCFA. Nouveau solde: 132 500 FCFA. Ref: ABC12345"),
      contexte,
    );
    expect(op?.type).toBe("revenu");
    expect(op?.montant).toBe(25000);
    expect(op?.soldeApres).toBe(132500);
    expect(op?.reference).toBe("ABC12345");
    expect(op?.compte).toBe("MTN MoMo");
  });

  it("détecte un décaissement avec frais", () => {
    const op = analyserSms(
      sms("Transfert de 10.000 FCFA vers Marie ADJA effectue. Frais: 150 FCFA. Solde: 45 000 FCFA"),
      contexte,
    );
    expect(op?.type).toBe("depense");
    expect(op?.montant).toBe(10000);
    expect(op?.frais).toBe(150);
  });

  it("rattache une enveloppe grâce aux mots-clés", () => {
    const op = analyserSms(sms("Paiement de 7 500 FCFA a la station TOTAL ENERGIES"), contexte);
    expect(op?.enveloppeId).toBe("e1");
  });

  it("ignore les messages qui ne sont pas des opérations", () => {
    expect(analyserSms(sms("Votre code de verification est 4821"), contexte)).toBeNull();
    expect(analyserSms(sms("Promo: 2 Go a 1000 FCFA, abonnez-vous maintenant"), contexte)).toBeNull();
  });

  it("apprend la correction de l'utilisateur", () => {
    const message = sms("Debit de 3 000 FCFA pour service divers");
    const avant = analyserSms(message, contexte);
    expect(avant).not.toBeNull();
    apprendreSms(avant!, { type: "depense", enveloppeId: "e2", compte: "UBA" });
    const apres = analyserSms(message, contexte);
    expect(apres?.enveloppeId).toBe("e2");
    expect(apres?.compte).toBe("UBA");
    expect(apres!.confiance).toBeGreaterThan(avant!.confiance);
  });

  it("produit la même signature quel que soit le montant", () => {
    const a = signatureSms("MTN", "Vous avez recu 1 000 FCFA de Paul");
    const b = signatureSms("MTN", "Vous avez recu 90 000 FCFA de Paul");
    expect(a).toBe(b);
  });
});

describe("analyserMessages", () => {
  it("ignore les messages déjà enregistrés", () => {
    const liste = [sms("Vous avez recu 5 000 FCFA de Ana"), sms("Retrait de 2 000 FCFA au guichet")];
    const ops = analyserMessages(liste, contexte, [liste[0]!.id]);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.type).toBe("depense");
  });

  it("découpe un texte collé en messages", () => {
    const messages = messagesDepuisTexte(
      "Vous avez recu 5 000 FCFA de Ana\n\nRetrait de 2 000 FCFA au guichet",
    );
    expect(messages).toHaveLength(2);
    expect(analyserMessages(messages, contexte, [])).toHaveLength(2);
  });
});
