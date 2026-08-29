import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { avancerDate } from "./periodes";

export type Enveloppe = {
  id: string;
  nom: string;
  emoji: string;
  plafond: number;
};

export type Transaction = {
  id: string;
  type: "revenu" | "depense";
  montant: number;
  libelle: string;
  categorie: string;
  compte: string;
  date: string;
};

export type Transfert = {
  id: string;
  source: string;
  destination: string;
  montant: number;
  note: string;
  date: string;
};

export type Periode = "jour" | "semaine" | "mois" | "trimestre" | "semestre" | "annee";

export const PERIODES: { id: Periode; label: string; parAn: number }[] = [
  { id: "jour", label: "Journalière", parAn: 365 },
  { id: "semaine", label: "Hebdomadaire", parAn: 52 },
  { id: "mois", label: "Mensuelle", parAn: 12 },
  { id: "trimestre", label: "Trimestrielle", parAn: 4 },
  { id: "semestre", label: "Semestrielle", parAn: 2 },
  { id: "annee", label: "Annuelle", parAn: 1 },
];

export type Budget = {
  id: string;
  libelle: string;
  enveloppeId: string;
  montant: number;
  periode: Periode;
  compte: string;
  prochaine: string;
  actif: boolean;
};

export const COMPTES = [
  "Espèces",
  "Banque",
  "MTN MoMo",
  "Moov Money",
  "Wave",
  "Carte virtuelle",
] as const;

export const ENVELOPPES_PAR_DEFAUT: Enveloppe[] = [
  { id: "vitaux", nom: "Besoins vitaux", emoji: "🍚", plafond: 150000 },
  { id: "transport", nom: "Transport", emoji: "🛵", plafond: 40000 },
  { id: "maison", nom: "Maison & Factures", emoji: "🏠", plafond: 60000 },
  { id: "epargne", nom: "Épargne", emoji: "🐖", plafond: 50000 },
  { id: "envies", nom: "Projets & Envies", emoji: "✨", plafond: 30000 },
  { id: "imprevus", nom: "Imprévus", emoji: "🚨", plafond: 20000 },
];

const SOURCES_REVENU = ["Salaire", "Activité", "Aide famille", "Prime", "Autre"];

type Etat = {
  transactions: Transaction[];
  enveloppes: Enveloppe[];
  comptes: string[];
  transferts: Transfert[];
  budgets: Budget[];
  transparence: number;
};

const ETAT_INITIAL: Etat = {
  transactions: [],
  enveloppes: ENVELOPPES_PAR_DEFAUT,
  comptes: [...COMPTES],
  transferts: [],
  budgets: [],
  transparence: 85,
};

type Contexte = Etat & {
  sourcesRevenu: string[];
  ajouterTransaction: (t: Omit<Transaction, "id">) => void;
  supprimerTransaction: (id: string) => void;
  ajouterCompte: (nom: string) => void;
  renommerCompte: (ancien: string, nouveau: string) => void;
  supprimerCompte: (nom: string) => void;
  ajouterTransfert: (t: Omit<Transfert, "id">) => void;
  supprimerTransfert: (id: string) => void;
  ajouterEnveloppe: (e: Omit<Enveloppe, "id">) => void;
  modifierEnveloppe: (id: string, e: Partial<Omit<Enveloppe, "id">>) => void;
  supprimerEnveloppe: (id: string) => void;
  ajouterBudget: (b: Omit<Budget, "id">) => void;
  convertirBudget: (id: string, fois?: number) => void;
  genererEcheancesDues: () => void;
  modifierBudget: (id: string, b: Partial<Omit<Budget, "id">>) => void;
  supprimerBudget: (id: string) => void;
  definirTransparence: (v: number) => void;
  reinitialiser: () => void;
  totalRevenus: number;
  totalDepenses: number;
  solde: number;
  depensesParEnveloppe: Record<string, number>;
  soldesParCompte: Record<string, number>;
};

const CLE = "superapp:etat:v1";
const SuperAppContext = createContext<Contexte | null>(null);

export function SuperAppProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>(ETAT_INITIAL);

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE);
      if (brut) setEtat({ ...ETAT_INITIAL, ...(JSON.parse(brut) as Partial<Etat>) });
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(etat));
    } catch {
      /* stockage indisponible */
    }
    document.documentElement.style.setProperty(
      "--surface-alpha",
      String(etat.transparence / 100),
    );
  }, [etat]);

  const ajouterTransaction = useCallback((t: Omit<Transaction, "id">) => {
    setEtat((e) => ({
      ...e,
      transactions: [{ ...t, id: crypto.randomUUID() }, ...e.transactions],
    }));
  }, []);

  const supprimerTransaction = useCallback((id: string) => {
    setEtat((e) => ({ ...e, transactions: e.transactions.filter((t) => t.id !== id) }));
  }, []);

  const ajouterCompte = useCallback((nom: string) => {
    setEtat((e) =>
      e.comptes.includes(nom) ? e : { ...e, comptes: [...e.comptes, nom] },
    );
  }, []);

  const renommerCompte = useCallback((ancien: string, nouveau: string) => {
    setEtat((e) => ({
      ...e,
      comptes: e.comptes.map((c) => (c === ancien ? nouveau : c)),
      transactions: e.transactions.map((t) =>
        t.compte === ancien ? { ...t, compte: nouveau } : t,
      ),
      transferts: e.transferts.map((t) => ({
        ...t,
        source: t.source === ancien ? nouveau : t.source,
        destination: t.destination === ancien ? nouveau : t.destination,
      })),
    }));
  }, []);

  const supprimerCompte = useCallback((nom: string) => {
    setEtat((e) => ({ ...e, comptes: e.comptes.filter((c) => c !== nom) }));
  }, []);

  const ajouterTransfert = useCallback((t: Omit<Transfert, "id">) => {
    setEtat((e) => ({
      ...e,
      transferts: [{ ...t, id: crypto.randomUUID() }, ...e.transferts],
    }));
  }, []);

  const supprimerTransfert = useCallback((id: string) => {
    setEtat((e) => ({ ...e, transferts: e.transferts.filter((t) => t.id !== id) }));
  }, []);

  const ajouterEnveloppe = useCallback((env: Omit<Enveloppe, "id">) => {
    setEtat((e) => ({
      ...e,
      enveloppes: [...e.enveloppes, { ...env, id: crypto.randomUUID() }],
    }));
  }, []);

  const modifierEnveloppe = useCallback(
    (id: string, env: Partial<Omit<Enveloppe, "id">>) => {
      setEtat((e) => ({
        ...e,
        enveloppes: e.enveloppes.map((x) => (x.id === id ? { ...x, ...env } : x)),
      }));
    },
    [],
  );

  const supprimerEnveloppe = useCallback((id: string) => {
    setEtat((e) => ({
      ...e,
      enveloppes: e.enveloppes.filter((x) => x.id !== id),
      budgets: e.budgets.filter((b) => b.enveloppeId !== id),
    }));
  }, []);

  const ajouterBudget = useCallback((b: Omit<Budget, "id">) => {
    setEtat((e) => ({ ...e, budgets: [{ ...b, id: crypto.randomUUID() }, ...e.budgets] }));
  }, []);

  const convertirBudget = useCallback((id: string, fois = 1) => {
    setEtat((e) => {
      const b = e.budgets.find((x) => x.id === id);
      if (!b) return e;
      const nouvelles: Transaction[] = [];
      let date = b.prochaine;
      for (let i = 0; i < fois; i += 1) {
        nouvelles.push({
          id: crypto.randomUUID(),
          type: "depense",
          montant: b.montant,
          libelle: b.libelle,
          categorie: b.enveloppeId,
          compte: b.compte,
          date,
        });
        date = avancerDate(date, b.periode);
      }
      return {
        ...e,
        transactions: [...nouvelles, ...e.transactions],
        budgets: e.budgets.map((x) => (x.id === id ? { ...x, prochaine: date } : x)),
      };
    });
  }, []);

  const genererEcheancesDues = useCallback(() => {
    setEtat((e) => {
      const maintenant = Date.now();
      const nouvelles: Transaction[] = [];
      const budgets = e.budgets.map((b) => {
        if (!b.actif) return b;
        let date = b.prochaine;
        let garde = 0;
        while (new Date(date).getTime() <= maintenant && garde < 240) {
          nouvelles.push({
            id: crypto.randomUUID(),
            type: "depense",
            montant: b.montant,
            libelle: b.libelle,
            categorie: b.enveloppeId,
            compte: b.compte,
            date,
          });
          date = avancerDate(date, b.periode);
          garde += 1;
        }
        return garde > 0 ? { ...b, prochaine: date } : b;
      });
      if (nouvelles.length === 0) return e;
      return { ...e, transactions: [...nouvelles, ...e.transactions], budgets };
    });
  }, []);

  const modifierBudget = useCallback((id: string, b: Partial<Omit<Budget, "id">>) => {
    setEtat((e) => ({
      ...e,
      budgets: e.budgets.map((x) => (x.id === id ? { ...x, ...b } : x)),
    }));
  }, []);

  const supprimerBudget = useCallback((id: string) => {
    setEtat((e) => ({ ...e, budgets: e.budgets.filter((b) => b.id !== id) }));
  }, []);

  const definirTransparence = useCallback((v: number) => {
    setEtat((e) => ({ ...e, transparence: v }));
  }, []);

  const reinitialiser = useCallback(() => setEtat(ETAT_INITIAL), []);

  const actions = useMemo(
    () => ({
      ajouterTransaction,
      supprimerTransaction,
      ajouterCompte,
      renommerCompte,
      supprimerCompte,
      ajouterTransfert,
      supprimerTransfert,
      ajouterEnveloppe,
      modifierEnveloppe,
      supprimerEnveloppe,
      ajouterBudget,
      convertirBudget,
      genererEcheancesDues,
      modifierBudget,
      supprimerBudget,
      definirTransparence,
      reinitialiser,
    }),
    [
      ajouterTransaction,
      supprimerTransaction,
      ajouterCompte,
      renommerCompte,
      supprimerCompte,
      ajouterTransfert,
      supprimerTransfert,
      ajouterEnveloppe,
      modifierEnveloppe,
      supprimerEnveloppe,
      ajouterBudget,
      convertirBudget,
      genererEcheancesDues,
      modifierBudget,
      supprimerBudget,
      definirTransparence,
      reinitialiser,
    ],
  );

  const valeur = useMemo<Contexte>(() => {
    const totalRevenus = etat.transactions
      .filter((t) => t.type === "revenu")
      .reduce((s, t) => s + t.montant, 0);
    const totalDepenses = etat.transactions
      .filter((t) => t.type === "depense")
      .reduce((s, t) => s + t.montant, 0);
    const depensesParEnveloppe: Record<string, number> = {};
    for (const t of etat.transactions) {
      if (t.type !== "depense") continue;
      depensesParEnveloppe[t.categorie] = (depensesParEnveloppe[t.categorie] ?? 0) + t.montant;
    }
    const soldesParCompte: Record<string, number> = {};
    for (const c of etat.comptes) soldesParCompte[c] = 0;
    for (const t of etat.transactions) {
      soldesParCompte[t.compte] =
        (soldesParCompte[t.compte] ?? 0) + (t.type === "revenu" ? t.montant : -t.montant);
    }
    for (const t of etat.transferts) {
      soldesParCompte[t.source] = (soldesParCompte[t.source] ?? 0) - t.montant;
      soldesParCompte[t.destination] = (soldesParCompte[t.destination] ?? 0) + t.montant;
    }
    return {
      ...etat,
      sourcesRevenu: SOURCES_REVENU,
      ...actions,
      totalRevenus,
      totalDepenses,
      solde: totalRevenus - totalDepenses,
      depensesParEnveloppe,
      soldesParCompte,
    };
  }, [etat, actions]);

  return <SuperAppContext.Provider value={valeur}>{children}</SuperAppContext.Provider>;
}

export function useSuperApp() {
  const ctx = useContext(SuperAppContext);
  if (!ctx) throw new Error("useSuperApp doit être utilisé dans SuperAppProvider");
  return ctx;
}
