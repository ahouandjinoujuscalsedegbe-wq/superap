import { useCallback, useEffect, useRef } from "react";
import { useSuperApp } from "@/lib/store";
import { suivreObjectifs } from "@/lib/objectifs";
import { noteObjectif, prelevementsDus } from "@/lib/prelevement-objectifs";

/**
 * Effectue seul, une fois par mois, le virement d'épargne de chaque objectif :
 * le compte courant choisi est débité et le compte d'épargne (exclu du solde
 * disponible) est crédité du montant nécessaire pour tenir l'échéance.
 */
export function PrelevementObjectifsAuto() {
  const {
    objectifs,
    transactions,
    transferts,
    chargement,
    ajouterTransfert,
    remplirEnveloppe,
  } = useSuperApp();
  const enCours = useRef(false);

  const appliquer = useCallback(() => {
    if (chargement || enCours.current) return;
    const suivis = suivreObjectifs(objectifs, transactions, new Date(), transferts);
    const dus = prelevementsDus(suivis, transferts);
    if (dus.length === 0) return;
    enCours.current = true;
    for (const d of dus) {
      ajouterTransfert({
        source: d.compteSource,
        destination: d.compteEpargne,
        montant: d.montant,
        note: noteObjectif(d.objectif),
        date: d.date,
      });
      if (d.objectif.enveloppeId) {
        remplirEnveloppe(d.objectif.enveloppeId, d.montant, d.compteEpargne, "manuel", d.date);
      }
    }
    enCours.current = false;
  }, [chargement, objectifs, transactions, transferts, ajouterTransfert, remplirEnveloppe]);

  useEffect(() => {
    appliquer();
    const minuterie = window.setInterval(appliquer, 60 * 60 * 1000);
    const auRetour = () => {
      if (document.visibilityState === "visible") appliquer();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [appliquer]);

  return null;
}
