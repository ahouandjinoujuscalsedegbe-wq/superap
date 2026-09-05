import { useCallback, useEffect, useRef } from "react";
import { useSuperApp } from "@/lib/store";
import {
  ecrireFile,
  ecrireReglagesMail,
  lireFile,
  lirePhrase,
  lireReglagesMail,
  preparerColis,
} from "@/lib/sauvegarde-email";
import { envoyerColisSauvegarde } from "@/lib/sauvegarde-email.functions";

/** Délai avant chiffrement d'une saisie (évite un colis à chaque frappe). */
const DELAI_CHIFFREMENT = 4_000;
/** Nouvelle tentative d'envoi périodique tant que le colis attend. */
const DELAI_REESSAI = 60_000;

/**
 * Sauvegarde automatique : chaque modification est chiffrée cinq fois puis
 * envoyée à l'adresse e-mail de l'utilisateur. Hors connexion, le colis
 * patiente sur l'appareil et part dès le retour d'Internet ou à la
 * réouverture de l'application.
 */
export function SauvegardeEmailAuto() {
  const etat = useSuperApp();
  const { chargement } = etat;
  const enCours = useRef(false);

  const envoyer = useCallback(async () => {
    if (enCours.current) return;
    const reglages = lireReglagesMail();
    const colis = lireFile();
    if (!reglages.actif || !reglages.email || !colis) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    enCours.current = true;
    try {
      const resultat = await envoyerColisSauvegarde({
        data: {
          email: reglages.email,
          appareil: reglages.appareil,
          colis: colis.contenu,
          creeLe: new Date(colis.creeLe).toLocaleString("fr-FR"),
        },
      });
      if (resultat.envoye) {
        ecrireFile(null);
        ecrireReglagesMail({
          ...reglages,
          dernierEnvoi: new Date().toISOString(),
          derniereEmpreinte: colis.empreinte,
          ...(reglages.dernierEchec ? { dernierEchec: undefined } : {}),
        });
      } else {
        ecrireReglagesMail({ ...reglages, dernierEchec: new Date().toISOString() });
      }
    } catch {
      ecrireReglagesMail({ ...lireReglagesMail(), dernierEchec: new Date().toISOString() });
    } finally {
      enCours.current = false;
    }
  }, []);

  // 1. Chiffrement du nouvel état, peu après la dernière saisie.
  useEffect(() => {
    if (chargement) return;
    const reglages = lireReglagesMail();
    if (!reglages.actif || !reglages.email) return;
    const minuterie = window.setTimeout(() => {
      void (async () => {
        const phrase = await lirePhrase();
        if (!phrase) return;
        const instantane = {
          transactions: etat.transactions,
          enveloppes: etat.enveloppes,
          categories: etat.categories,
          comptes: etat.comptes,
          comptesExclus: etat.comptesExclus,
          ordreComptes: etat.ordreComptes,
          iconesComptes: etat.iconesComptes,
          transferts: etat.transferts,
          remplissages: etat.remplissages,
          budgets: etat.budgets,
          dettes: etat.dettes,
          objectifs: etat.objectifs,
          corbeille: etat.corbeille,
          membres: etat.membres,
          transparence: etat.transparence,
          nomUtilisateur: etat.nomUtilisateur,
        };
        const colis = await preparerColis(instantane, phrase);
        const actuel = lireReglagesMail();
        const attente = lireFile();
        if (colis.empreinte === actuel.derniereEmpreinte && !attente) return;
        ecrireFile(colis);
        await envoyer();
      })();
    }, DELAI_CHIFFREMENT);
    return () => window.clearTimeout(minuterie);
  }, [chargement, etat, envoyer]);

  // 2. Reprise automatique : retour du réseau, retour dans l'application,
  //    et nouvelle tentative régulière tant qu'un colis attend.
  useEffect(() => {
    const reprendre = () => void envoyer();
    window.addEventListener("online", reprendre);
    const auRetour = () => {
      if (document.visibilityState === "visible") reprendre();
    };
    document.addEventListener("visibilitychange", auRetour);
    const minuterie = window.setInterval(reprendre, DELAI_REESSAI);
    reprendre();
    return () => {
      window.removeEventListener("online", reprendre);
      document.removeEventListener("visibilitychange", auRetour);
      window.clearInterval(minuterie);
    };
  }, [envoyer]);

  return null;
}
