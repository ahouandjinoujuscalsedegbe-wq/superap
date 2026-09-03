import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlarmClock, Wand2, X } from "lucide-react";
import { lireReglagesAlarme } from "@/lib/alarme";
import { jouerSonAlarme, notifierAlarme, vibrerAlarme } from "@/lib/alarme-appareil";
import { publierAlerteConseiller } from "@/lib/alertes-conseiller";
import {
  DUREE_SONNERIE_MS,
  joursAvantFinBudget,
  lirePeriodeBudget,
  marquerPreavisFinSonne,
  preavisFinADeclencher,
} from "@/lib/rappel-budget";

/** Intervalle entre deux bips pendant la sonnerie continue. */
const PAS_BIP_MS = 3_000;

function texteEcheance(jours: number): string {
  if (jours <= 0) return "Votre budget arrive à son terme aujourd'hui.";
  if (jours === 1) return "Votre budget se termine demain.";
  return `Votre budget se termine dans ${jours} jours.`;
}

/**
 * Rappelle à l'utilisateur, AVANT le terme de la période budgétaire choisie,
 * qu'il doit renouveler son budget : 7 jours, 3 jours, 1 jour avant, puis le
 * jour même. L'alarme sonne jusqu'à 5 minutes et une notification appareil est
 * envoyée pour que le rappel arrive même hors de l'application.
 */
export function RappelFinBudget() {
  const [jours, setJours] = useState<number | null>(null);
  const [sonne, setSonne] = useState(false);
  const [masque, setMasque] = useState(false);
  const bips = useRef<number | null>(null);
  const finSonnerie = useRef<number | null>(null);

  const arreterSonnerie = useCallback(() => {
    if (bips.current !== null) window.clearInterval(bips.current);
    if (finSonnerie.current !== null) window.clearTimeout(finSonnerie.current);
    bips.current = null;
    finSonnerie.current = null;
    setSonne(false);
  }, []);

  const verifier = useCallback(() => {
    const periode = lirePeriodeBudget();
    if (!periode || periode.renouvele) {
      setJours(null);
      arreterSonnerie();
      return;
    }
    const restants = joursAvantFinBudget(periode);
    if (restants < 0 || restants > 7) {
      setJours(null);
      return;
    }
    setJours(restants);

    const preavis = preavisFinADeclencher();
    if (preavis === null) return;
    marquerPreavisFinSonne(preavis);
    setMasque(false);

    const titre = "Budget à renouveler";
    const texte = `${texteEcheance(restants)} Préparez dès maintenant le budget de la période suivante.`;
    void publierAlerteConseiller({ titre, texte, urgent: true });

    const reglages = lireReglagesAlarme();
    if (!reglages.active) return;
    if (reglages.notification) void notifierAlarme(titre, texte, true);

    setSonne(true);
    const bip = () => {
      if (reglages.son) void jouerSonAlarme(reglages.volume, true);
      if (reglages.vibration) void vibrerAlarme(true);
    };
    bip();
    if (reglages.son || reglages.vibration) {
      bips.current = window.setInterval(bip, PAS_BIP_MS);
      finSonnerie.current = window.setTimeout(arreterSonnerie, DUREE_SONNERIE_MS);
    }
  }, [arreterSonnerie]);

  useEffect(() => {
    const depart = window.setTimeout(verifier, 2500);
    const minuterie = window.setInterval(verifier, 60_000);
    const auRetour = () => {
      if (document.visibilityState === "visible") verifier();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearTimeout(depart);
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
      arreterSonnerie();
    };
  }, [verifier, arreterSonnerie]);

  if (jours === null || masque) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Rappel de fin de budget"
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: "calc(15rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-primary/50 bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <AlarmClock
            className={`mt-0.5 h-5 w-5 shrink-0 text-primary ${sonne ? "animate-pulse" : ""}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Budget à renouveler</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {texteEcheance(jours)} Renouvelez votre budget pour la période suivante afin de garder
              vos enveloppes à jour.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to="/budget/auto"
                onClick={arreterSonnerie}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden /> Renouveler mon budget
              </Link>
              <button
                type="button"
                onClick={() => {
                  arreterSonnerie();
                  setMasque(true);
                }}
                className="rounded-lg border border-input px-2.5 py-1 text-xs font-medium"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Arrêter la sonnerie"
            onClick={arreterSonnerie}
            className="rounded-full p-1 text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
