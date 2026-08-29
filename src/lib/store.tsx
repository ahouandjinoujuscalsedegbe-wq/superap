import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  transparence: number;
};

const ETAT_INITIAL: Etat = {
  transactions: [],
  enveloppes: ENVELOPPES_PAR_DEFAUT,
  transparence: 85,
};

type Contexte = Etat & {
  sourcesRevenu: string[];
  ajouterTransaction: (t: Omit<Transaction, "id">) => void;
  supprimerTransaction: (id: string) => void;
  definirTransparence: (v: number) => void;
  reinitialiser: () => void;
  totalRevenus: number;
  totalDepenses: number;
  solde: number;
  depensesParEnveloppe: Record<string, number>;
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

  const definirTransparence = useCallback((v: number) => {
    setEtat((e) => ({ ...e, transparence: v }));
  }, []);

  const reinitialiser = useCallback(() => setEtat(ETAT_INITIAL), []);

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
    return {
      ...etat,
      sourcesRevenu: SOURCES_REVENU,
      ajouterTransaction,
      supprimerTransaction,
      definirTransparence,
      reinitialiser,
      totalRevenus,
      totalDepenses,
      solde: totalRevenus - totalDepenses,
      depensesParEnveloppe,
    };
  }, [etat, ajouterTransaction, supprimerTransaction, definirTransparence, reinitialiser]);

  return <SuperAppContext.Provider value={valeur}>{children}</SuperAppContext.Provider>;
}

export function useSuperApp() {
  const ctx = useContext(SuperAppContext);
  if (!ctx) throw new Error("useSuperApp doit être utilisé dans SuperAppProvider");
  return ctx;
}
