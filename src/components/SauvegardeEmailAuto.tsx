import { useCallback, useEffect, useRef, useState } from "react";
import { useSuperApp } from "@/lib/store";
import {
  ecrireFile,
  ecrireReglagesMail,
  lireFile,
  lirePhrase,
  lireReglagesMail,
  noterJournalMail,
  preparerColis,
} from "@/lib/sauvegarde-email";
import { toast } from "sonner";
import { envoyerColisSauvegarde } from "@/lib/sauvegarde-email.functions";
import { ajouterVersion, lireVersions, marquerVersionEnvoyee } from "@/lib/versions-sauvegarde";
import { classerSaisie } from "@/lib/classement-coffre";
import { deposerDansCloud } from "@/lib/coffre-cloud";
import { deposerDansDossier } from "@/lib/coffre-dossier";
import { instantaneEtat } from "@/lib/instantane";
import { EVENEMENT_BROUILLON } from "@/lib/brouillons";
import {
  confierColisArrierePlan,
  oublierColisArrierePlan,
  preparerArrierePlan,
} from "@/lib/sauvegarde-arriere-plan";

/** Délai avant chiffrement d'une saisie (évite un colis à chaque frappe). */
const DELAI_CHIFFREMENT = 1_500;
/** Nouvelle fiche nommée : la copie classée part presque immédiatement. */
const DELAI_SAISIE_NOMMEE = 1_200;
/** Nouvelle tentative d'envoi périodique tant que le colis attend. */
const DELAI_REESSAI = 60_000;

/** Marque posée uniquement lorsqu'une sauvegarde locale a échoué. */
const CLE_ALERTE = "superapp:sauvegarde:alerte:v1";

function alerteActive(): boolean {
  try {
    return window.localStorage.getItem(CLE_ALERTE) !== null;
  } catch {
    return false;
  }
}

function poserAlerte(motif: string): void {
  try {
    window.localStorage.setItem(CLE_ALERTE, motif);
  } catch {
    /* stockage indisponible */
  }
}

function leverAlerte(): void {
  try {
    window.localStorage.removeItem(CLE_ALERTE);
  } catch {
    /* stockage indisponible */
  }
}

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
  // Chaque frappe mémorisée relance la préparation de la copie chiffrée.
  const [frappes, setFrappes] = useState(0);
  useEffect(() => {
    const surFrappe = () => setFrappes((n) => n + 1);
    window.addEventListener(EVENEMENT_BROUILLON, surFrappe);
    return () => window.removeEventListener(EVENEMENT_BROUILLON, surFrappe);
  }, []);

  const envoyer = useCallback(async () => {
    if (enCours.current) return;
    const reglages = lireReglagesMail();
    const colis = lireFile();
    if (!reglages.actif || !reglages.email || !colis) return;
    // Aucun e-mail pour une sauvegarde réussie : le message ne part que si la
    // sauvegarde sur l'appareil a échoué.
    if (!alerteActive()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    enCours.current = true;
    try {
      const resultat = await envoyerColisSauvegarde({
        data: {
          email: reglages.email,
          ...(reglages.emailSecours ? { emailSecours: reglages.emailSecours } : {}),
          appareil: reglages.appareil,
          colis: colis.contenu,
          creeLe: new Date(colis.creeLe).toLocaleString("fr-FR"),
          ...(colis.classement ? { classement: colis.classement } : {}),
          ...(colis.rubrique ? { rubrique: colis.rubrique } : {}),
        },
      });
      if (resultat.envoye && resultat.secoursEnEchec) {
        // L'utilisateur croyait ses deux copies parties : on le prévient.
        toast.warning("La copie vers votre adresse de secours n'est pas partie.", {
          description: `Copie principale envoyée. Vérifiez la seconde adresse (${resultat.messageSecours ?? "envoi impossible"}).`,
          id: "secours-sauvegarde",
        });
      }
      if (resultat.envoye) {
        ecrireFile(null);
        await oublierColisArrierePlan();
        marquerVersionEnvoyee(colis.empreinte);
        leverAlerte();
        noterJournalMail({ date: new Date().toISOString(), etat: "envoye", taille: colis.taille });
        const { dernierEchec: _echec, ...reste } = reglages;
        void _echec;
        ecrireReglagesMail({
          ...reste,
          dernierEnvoi: new Date().toISOString(),
          derniereEmpreinte: colis.empreinte,
          derniereTaille: colis.taille,
        });
      } else {
        noterJournalMail({
          date: new Date().toISOString(),
          etat: "echec",
          taille: colis.taille,
          detail: resultat.message ?? resultat.raison ?? "envoi refusé",
        });
        ecrireReglagesMail({ ...reglages, dernierEchec: new Date().toISOString() });
      }
    } catch {
      noterJournalMail({ date: new Date().toISOString(), etat: "echec", detail: "envoi impossible" });
      ecrireReglagesMail({ ...lireReglagesMail(), dernierEchec: new Date().toISOString() });
    } finally {
      enCours.current = false;
    }
  }, []);

  // 1. Chiffrement du nouvel état, peu après la dernière saisie. Une nouvelle
  //    fiche nommée (dépense, compte, dette, objectif…) part tout de suite.
  useEffect(() => {
    if (chargement) return;
    const reglages = lireReglagesMail();
    if (!reglages.actif || !reglages.email) return;
    const rangement = classerSaisie(etat, false);
    const minuterie = window.setTimeout(() => {
      void (async () => {
        const phrase = await lirePhrase();
        if (!phrase) return;
        const instantane = instantaneEtat(etat);
        const brut = await preparerColis(instantane, phrase);
        // Le classement est mémorisé maintenant : la même fiche ne sera plus
        // comptée comme nouvelle au prochain enregistrement.
        const classement = classerSaisie(etat, true);
        const colis = {
          ...brut,
          classement: classement.chemin,
          rubrique: classement.rubrique,
        };
        const actuel = lireReglagesMail();
        const attente = lireFile();
        if (colis.empreinte === actuel.derniereEmpreinte && !attente) return;
        // Sauvegarde silencieuse sur l'appareil : coffre de versions daté et
        // classé, sans aucun e-mail tant que tout se passe bien.
        let reussie = true;
        try {
          if (!ecrireFile(colis)) throw new Error("file_locale_indisponible");
          ajouterVersion(colis, actuel.appareil, false, classement.chemin);
          const relu = lireFile();
          const versions = lireVersions();
          reussie =
            relu?.empreinte === colis.empreinte &&
            versions.some((v) => v.empreinte === colis.empreinte);
        } catch {
          reussie = false;
        }
        if (reussie) {
          leverAlerte();
          ecrireReglagesMail({
            ...actuel,
            derniereEmpreinte: colis.empreinte,
            derniereTaille: colis.taille,
          });
          // Copie immédiate dans le coffre nommé par l'utilisateur, déjà
          // chiffrée (colis SAM5) et rangée dans l'espace privé de l'app.
          void deposerDansDossier({
            contenu: colis.contenu,
            empreinte: colis.empreinte,
            taille: colis.taille,
            classement: classement.chemin,
          });
          // Dépôt silencieux dans l'espace de stockage rattaché à l'adresse
          // e-mail : aucun message n'est envoyé, la copie est déjà chiffrée.
          void deposerDansCloud(actuel.email, phrase, actuel.appareil, {
            contenu: colis.contenu,
            empreinte: colis.empreinte,
            taille: colis.taille,
            classement: classement.chemin,
          }).then((deposee) => {
            if (!deposee) return;
            const aJour = lireReglagesMail();
            ecrireReglagesMail({ ...aJour, dernierDepotCloud: new Date().toISOString() });
          });
          return;
        }
        // Échec de la sauvegarde locale : l'utilisateur doit être averti et la
        // copie chiffrée part alors par e-mail comme filet de sécurité.
        poserAlerte("sauvegarde locale impossible");
        noterJournalMail({
          date: new Date().toISOString(),
          etat: "echec",
          taille: colis.taille,
          detail: "sauvegarde sur l'appareil impossible",
        });
        const relais = await confierColisArrierePlan({
          email: actuel.email,
          appareil: actuel.appareil,
          colis: colis.contenu,
          creeLe: new Date(colis.creeLe).toLocaleString("fr-FR"),
        });
        if (!relais) {
          // Aucun relais système : sans l'application ouverte, rien ne partira.
          toast.warning("Une copie de secours attend d'être envoyée.", {
            description:
              "Gardez l'application ouverte quelques secondes avec Internet, le temps qu'elle parte.",
            id: "colis-en-attente",
          });
        }
        await envoyer();
      })();
    }, rangement.nouveau ? DELAI_SAISIE_NOMMEE : DELAI_CHIFFREMENT);
    return () => window.clearTimeout(minuterie);
  }, [chargement, etat, frappes, envoyer]);

  // 2. Reprise automatique : retour du réseau, retour dans l'application,
  //    et nouvelle tentative régulière tant qu'un colis attend.
  useEffect(() => {
    void preparerArrierePlan();
    const reprendre = () => void envoyer();
    const depuisRelais = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "sauvegarde-envoyee") {
        ecrireFile(null);
        ecrireReglagesMail({ ...lireReglagesMail(), dernierEnvoi: new Date().toISOString() });
      }
    };
    navigator.serviceWorker?.addEventListener("message", depuisRelais);
    window.addEventListener("online", reprendre);
    // Application fermée ou mise en veille : dernier envoi immédiat.
    window.addEventListener("pagehide", reprendre);
    const auRetour = () => {
      if (document.visibilityState === "visible") reprendre();
    };
    document.addEventListener("visibilitychange", auRetour);
    const surveiller = () => {
      const attente = lireFile();
      if (!attente) return;
      const ageH = (Date.now() - new Date(attente.creeLe).getTime()) / 3_600_000;
      if (ageH >= 2) {
        toast.error("Une copie de sauvegarde n'est toujours pas partie.", {
          description: `En attente depuis ${Math.floor(ageH)} h. Vérifiez votre connexion, puis ouvrez la page Sauvegarde.`,
          id: "colis-bloque",
        });
      }
    };
    surveiller();
    const veille = window.setInterval(surveiller, 30 * 60_000);
    const minuterie = window.setInterval(reprendre, DELAI_REESSAI);
    reprendre();
    return () => {
      navigator.serviceWorker?.removeEventListener("message", depuisRelais);
      window.removeEventListener("online", reprendre);
      window.removeEventListener("pagehide", reprendre);
      document.removeEventListener("visibilitychange", auRetour);
      window.clearInterval(minuterie);
      window.clearInterval(veille);
    };
  }, [envoyer]);

  return null;
}
