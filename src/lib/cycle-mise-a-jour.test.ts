import { describe, expect, it } from "vitest";

import { dechiffrerCinqFois, empreinte, preparerColis } from "./sauvegarde-email";
import { fusionnerDonneesCompte } from "./multi-appareil";
import type { Etat } from "./store";

/**
 * Simulation du scénario réel : version précédente installée → mouvements et
 * dettes saisis → copie chiffrée envoyée juste avant l'installation de la
 * nouvelle version → Android remplace l'application (données locales perdues)
 * → la copie reçue par e-mail est recollée et tout revient.
 */

const PHRASE = "phrase de recuperation du telephone";

function etatVersionPrecedente() {
  return {
    comptes: ["Principal", "Momo", "Je dois à quelqu'un 🤔", "Quelqu'un me doit 🤔"],
    transactions: [
      {
        id: "t1",
        date: "2026-09-10T08:15:00.000Z",
        type: "revenu",
        montant: 250000,
        libelle: "Salaire septembre",
        categorie: "salaire",
        compte: "Principal",
        frais: 0,
      },
      {
        id: "t2",
        date: "2026-09-11T12:40:00.000Z",
        type: "depense",
        montant: 18500,
        libelle: "Marché Dantokpa",
        categorie: "nourriture",
        compte: "Momo",
        frais: 250,
      },
    ],
    transferts: [
      {
        id: "v1",
        date: "2026-09-12T09:00:00.000Z",
        source: "Principal",
        destination: "Je dois à quelqu'un 🤔",
        montant: 20000,
        frais: 0,
        detteId: "d1",
      },
    ],
    dettes: [
      {
        id: "d1",
        sens: "dette",
        personne: "Tonton Michel",
        montant: 100000,
        date: "2026-09-01",
        remboursements: [{ id: "r1", montant: 20000, date: "2026-09-12", note: "1re tranche" }],
      },
      {
        id: "d2",
        sens: "creance",
        personne: "Chantal",
        montant: 35000,
        date: "2026-09-05",
        remboursements: [],
      },
    ],
    enveloppes: [{ id: "e1", nom: "Nourriture", dotation: 60000 }],
    categories: [],
    budgets: [],
    objectifs: [],
    remplissages: [],
    membres: [],
  } as unknown as Etat;
}

describe("cycle mise à jour : sauvegarde e-mail puis retour des données", () => {
  it("prépare une copie chiffrée illisible en clair", async () => {
    const avant = etatVersionPrecedente();
    const colis = await preparerColis(avant, PHRASE);

    expect(colis.contenu.startsWith("SAM5:")).toBe(true);
    expect(colis.contenu).not.toContain("Tonton Michel");
    expect(colis.contenu).not.toContain("Dantokpa");
    expect(colis.taille).toBeGreaterThan(100);
    expect(colis.empreinte).toBe(await empreinte(JSON.stringify(avant)));
  });

  it("refuse de rendre les données avec une mauvaise phrase", async () => {
    const colis = await preparerColis(etatVersionPrecedente(), PHRASE);
    await expect(dechiffrerCinqFois(colis.contenu, "mauvaise phrase")).rejects.toBeTruthy();
  });

  it("rend exactement les mêmes mouvements et dettes après réinstallation", async () => {
    const avant = etatVersionPrecedente();
    const colis = await preparerColis(avant, PHRASE);

    // La nouvelle version démarre vide : Android a remplacé l'application.
    const apresInstallation = {
      comptes: [],
      transactions: [],
      transferts: [],
      dettes: [],
      enveloppes: [],
      categories: [],
      budgets: [],
      objectifs: [],
      remplissages: [],
      membres: [],
    } as unknown as Etat;

    const brut = await dechiffrerCinqFois(colis.contenu, PHRASE);
    const recu = JSON.parse(brut) as Partial<Etat>;
    const fusion = fusionnerDonneesCompte(apresInstallation, recu);

    expect(fusion.etat.transactions).toEqual(avant.transactions);
    expect(fusion.etat.transferts).toEqual(avant.transferts);
    expect(fusion.etat.dettes).toEqual(avant.dettes);
    expect(fusion.etat.comptes).toEqual(avant.comptes);
    expect(fusion.etat.enveloppes).toEqual(avant.enveloppes);

    // Le remboursement de 20 000 reste rattaché à la dette, au franc près.
    const dette = (fusion.etat.dettes as unknown as { id: string; remboursements: unknown[] }[])[0];
    expect(dette?.remboursements).toHaveLength(1);
    expect(await empreinte(brut)).toBe(colis.empreinte);
  });

  it("ne duplique rien si la copie est recollée deux fois", async () => {
    const avant = etatVersionPrecedente();
    const colis = await preparerColis(avant, PHRASE);
    const recu = JSON.parse(await dechiffrerCinqFois(colis.contenu, PHRASE)) as Partial<Etat>;

    const premier = fusionnerDonneesCompte(
      { ...avant, transactions: [], transferts: [], dettes: [], comptes: [] } as unknown as Etat,
      recu,
    );
    const second = fusionnerDonneesCompte(premier.etat as Etat, recu);
    expect(second.total).toBe(0);
  });
});
