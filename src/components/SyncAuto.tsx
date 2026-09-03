import { useEffect, useMemo, useRef, useState } from "react";
import { useSuperApp } from "@/lib/store";
import {
  deposer,
  PHRASE_MIN,
  lireReglagesAuto,
  ecrireReglagesAuto,
  recevoir,
  ecrireBase,
  type ReglagesAuto,
} from "@/lib/sync-auto";

export const EVENEMENT_SYNC_AUTO = "superapp:sync-auto:change";

const DELAI_ENVOI = 2500; // envoi 2,5 s après la dernière modification
const DELAI_LECTURE = 5000; // relève du coffre toutes les 5 s

/**
 * Moteur de synchronisation automatique : dépose les modifications chiffrées
 * et récupère celles de l'autre téléphone, sans aucune action manuelle.
 */
export function SyncAuto() {
  const { etatComplet, remplacerEtat, chargement, stockageIllisible } = useSuperApp();
  const [reglages, setReglages] = useState<ReglagesAuto>(() => lireReglagesAuto());
  const derniereEmpreinte = useRef<string>("");
  const occupe = useRef(false);

  // Recharge les réglages quand la page Synchronisation les modifie.
  useEffect(() => {
    const recharger = () => setReglages(lireReglagesAuto());
    window.addEventListener(EVENEMENT_SYNC_AUTO, recharger);
    return () => window.removeEventListener(EVENEMENT_SYNC_AUTO, recharger);
  }, []);

  // Garde-fou vital : tant que le coffre chiffré n'est pas déchiffré (ou s'il
  // est illisible), l'état en mémoire n'est qu'un état d'usine. Le déposer
  // écraserait le foyer avec des enveloppes vides sur l'autre téléphone.
  const pret = !chargement && !stockageIllisible;

  const actif =
    pret &&
    reglages.actif &&
    reglages.phrase.length >= PHRASE_MIN &&
    reglages.appareil.length > 0;

  // L'état ne change d'identité qu'à chaque modification réelle : l'empreinte
  // n'est donc plus recalculée à chaque rendu (coûteux sur téléphone).
  const etatActuel = etatComplet();
  const empreinte = useMemo(() => (actif ? JSON.stringify(etatActuel) : ""), [actif, etatActuel]);

  // -------- Envoi automatique après chaque modification --------
  useEffect(() => {
    if (!actif) return;
    if (!empreinte || empreinte === derniereEmpreinte.current) return;
    const minuteur = window.setTimeout(async () => {
      if (occupe.current) return;
      occupe.current = true;
      try {
        await deposer(JSON.parse(empreinte), lireReglagesAuto());
        derniereEmpreinte.current = empreinte;
        const suite = { ...lireReglagesAuto(), dernierEnvoi: new Date().toISOString() };
        ecrireReglagesAuto(suite);
        setReglages(suite);
      } catch {
        /* hors ligne : nouvelle tentative à la prochaine modification */
      } finally {
        occupe.current = false;
      }
    }, DELAI_ENVOI);
    return () => window.clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, reglages.phrase, reglages.appareil, empreinte]);

  // -------- Réception automatique --------
  useEffect(() => {
    if (!actif) return;
    let arrete = false;

    const relever = async () => {
      if (arrete || occupe.current) return;
      occupe.current = true;
      try {
        const courant = lireReglagesAuto();
        const resultat = await recevoir(etatComplet(), courant);
        if (resultat.curseur !== courant.curseur) {
          if (resultat.ajoutes > 0) {
            remplacerEtat(resultat.etat);
            // L'état fusionné ne doit PAS être redéposé : nos propres données
            // ont déjà été envoyées, et redéposer relançait un aller-retour
            // permanent entre les deux téléphones.
            derniereEmpreinte.current = JSON.stringify(resultat.etat);
            // Nouvelle référence commune après fusion.
            ecrireBase(resultat.etat);
          }
          const suite = {
            ...courant,
            curseur: resultat.curseur,
            dernierRecu: new Date().toISOString(),
          };
          ecrireReglagesAuto(suite);
          setReglages(suite);
        }
      } catch {
        /* hors ligne : nouvelle tentative au prochain cycle */
      } finally {
        occupe.current = false;
      }
    };

    void relever();
    const boucle = window.setInterval(relever, DELAI_LECTURE);
    return () => {
      arrete = true;
      window.clearInterval(boucle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, reglages.phrase, reglages.appareil]);

  return null;
}
