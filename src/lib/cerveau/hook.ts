import { useMemo } from "react";
import { useSuperApp } from "../store";
import { analyser, type Analyse } from "./index";

/**
 * Accès unique au cerveau local depuis un écran React.
 *
 * Tous les composants qui affichent un chiffre, une alerte ou un conseil
 * doivent passer par ce hook : l'analyse est calculée une seule fois et
 * partagée, donc l'application dit partout la même chose.
 */
export function useCerveau(): Analyse {
  const { transactions, enveloppes, dettes, objectifs, solde } = useSuperApp();
  return useMemo(
    () => analyser({ transactions, enveloppes, dettes, objectifs, solde }),
    [transactions, enveloppes, dettes, objectifs, solde],
  );
}
