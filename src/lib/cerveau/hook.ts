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
  const { transactions, enveloppes, dettes, objectifs, soldeDisponible, comptesExclus } =
    useSuperApp();
  return useMemo(
    // Le cerveau raisonne sur le solde DISPONIBLE : les comptes réservés
    // (épargne, projet, caisse…) n'entrent pas dans l'argent du quotidien.
    () =>
      analyser({
        transactions,
        enveloppes,
        dettes,
        objectifs,
        solde: soldeDisponible,
        comptesExclus,
      }),
    [transactions, enveloppes, dettes, objectifs, soldeDisponible, comptesExclus],
  );
}
