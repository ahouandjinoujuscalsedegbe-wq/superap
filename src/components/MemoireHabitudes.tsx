import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { noterAction } from "@/lib/memoire-utilisateur";

/**
 * Observateur discret des habitudes : il mémorise, sur l'appareil, les écrans
 * visités et les opérations enregistrées, afin que toutes les intelligences
 * de l'application progressent à partir des mêmes observations.
 */
export function MemoireHabitudes() {
  const { transactions, enveloppes, objectifs, budgets } = useSuperApp();
  const chemin = useRouterState({ select: (s) => s.location.pathname });

  const vus = useRef<{
    transactions: number | null;
    enveloppes: number | null;
    objectifs: number | null;
    budgets: number | null;
  }>({ transactions: null, enveloppes: null, objectifs: null, budgets: null });

  // Écran visité : sert à repérer les pages réellement utilisées.
  useEffect(() => {
    noterAction("ecran", chemin);
  }, [chemin]);

  // Nouvelle opération : type, poste concerné et montant sont mémorisés.
  useEffect(() => {
    const precedent = vus.current.transactions;
    vus.current.transactions = transactions.length;
    if (precedent === null || transactions.length <= precedent) return;
    const derniere = transactions[transactions.length - 1];
    if (!derniere) return;
    noterAction(
      derniere.type === "revenu" ? "revenu" : "depense",
      derniere.categorie || derniere.libelle,
      derniere.montant,
    );
  }, [transactions]);

  useEffect(() => {
    const precedent = vus.current.enveloppes;
    vus.current.enveloppes = enveloppes.length;
    if (precedent === null || enveloppes.length <= precedent) return;
    noterAction("enveloppe", enveloppes[enveloppes.length - 1]?.nom ?? "");
  }, [enveloppes]);

  useEffect(() => {
    const precedent = vus.current.objectifs;
    vus.current.objectifs = objectifs.length;
    if (precedent === null || objectifs.length <= precedent) return;
    const dernier = objectifs[objectifs.length - 1];
    noterAction("objectif", dernier?.libelle ?? "", dernier?.cible ?? 0);
  }, [objectifs]);

  useEffect(() => {
    const precedent = vus.current.budgets;
    vus.current.budgets = budgets.length;
    if (precedent === null || budgets.length <= precedent) return;
    const dernier = budgets[budgets.length - 1];
    noterAction("budget", dernier?.libelle ?? "", dernier?.montant ?? 0);
  }, [budgets]);

  return null;
}
