import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlarmClock, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { ajusterAuRevenu, proposerDotations } from "@/lib/budget-auto";
import { lireReglagesAlarme } from "@/lib/alarme";
import { jouerSonAlarme, notifierAlarme, vibrerAlarme } from "@/lib/alarme-appareil";
import { publierAlerteConseiller } from "@/lib/alertes-conseiller";
import {
  DUREE_SONNERIE_MS,
  lireEtatRappel,
  marquerBudgetAutomatique,
  marquerCreneauSonne,
  periodeRappelTerminee,
  sonnerieADeclencher,
} from "@/lib/rappel-budget";

/** Intervalle entre deux bips pendant la sonnerie continue. */
const PAS_BIP_MS = 3_000;

/**
 * Rappelle à l'utilisateur de revoir son budget après le renouvellement
 * automatique des enveloppes du 1er du mois. L'alarme sonne toutes les
 * 6 heures pendant les deux premiers jours (8 fois), chaque sonnerie durant
 * jusqu'à 5 minutes tant que l'utilisateur n'y touche pas. Passé ce délai,
 * la proposition locale devient le budget du mois.
 */
export function RappelBudgetMensuel() {
  const { transactions, enveloppes, modifierEnveloppe, chargement } = useSuperApp();
  const [visible, setVisible] = useState(false);
  const [sonne, setSonne] = useState(false);
  const bips = useRef<number | null>(null);
  const finSonnerie = useRef<number | null>(null);
  const autoFait = useRef(false);

  const arreterSonnerie = useCallback(() => {
    if (bips.current !== null) window.clearInterval(bips.current);
    if (finSonnerie.current !== null) window.clearTimeout(finSonnerie.current);
    bips.current = null;
    finSonnerie.current = null;
    setSonne(false);
  }, []);

  /** Applique d'office la proposition locale (fin des deux premiers jours). */
  const appliquerProposition = useCallback(() => {
    const budget = ajusterAuRevenu(proposerDotations(transactions, enveloppes));
    let modifiees = 0;
    for (const p of budget.propositions) {
      const env = enveloppes.find((e) => e.id === p.enveloppeId);
      if (!env || p.proposee <= 0 || p.proposee === p.actuelle) continue;
      modifierEnveloppe(env.id, {
        dotation: p.proposee,
        plafond: Math.min(env.plafond, p.proposee),
      });
      modifiees += 1;
    }
    marquerBudgetAutomatique();
    if (modifiees > 0) {
      toast.info(
        `Budget du mois validé automatiquement : ${modifiees} enveloppe(s) ajustée(s) par l'analyse locale.`,
      );
    }
  }, [transactions, enveloppes, modifierEnveloppe]);

  const verifier = useCallback(() => {
    if (chargement) return;
    const etat = lireEtatRappel();

    // Après les deux premiers jours : la proposition locale devient le budget.
    if (etat.statut === "attente" && periodeRappelTerminee()) {
      if (!autoFait.current) {
        autoFait.current = true;
        appliquerProposition();
      }
      setVisible(false);
      arreterSonnerie();
      return;
    }

    if (etat.statut !== "attente") {
      setVisible(false);
      arreterSonnerie();
      return;
    }

    setVisible(true);

    const creneau = sonnerieADeclencher();
    if (!creneau) return;
    marquerCreneauSonne(creneau);

    const reglages = lireReglagesAlarme();
    if (!reglages.active) return;

    setSonne(true);
    const titreRappel = "Budget du mois à vérifier";
    const texteRappel =
      "Vos enveloppes viennent d'être renouvelées. Modifiez votre budget, sinon la proposition automatique sera retenue.";
    if (reglages.notification) {
      void notifierAlarme(
        "Budget du mois à vérifier",
        "Vos enveloppes viennent d'être renouvelées. Modifiez votre budget, sinon la proposition automatique sera retenue.",
        true,
      );
    } else {
      void publierAlerteConseiller({ titre: titreRappel, texte: texteRappel, urgent: true });
    }
    const bip = () => {
      if (reglages.son) void jouerSonAlarme(reglages.volume, true);
      if (reglages.vibration) void vibrerAlarme(true);
    };
    bip();
    if (reglages.son || reglages.vibration) {
      bips.current = window.setInterval(bip, PAS_BIP_MS);
      // La sonnerie s'arrête d'elle-même au bout de 5 minutes.
      finSonnerie.current = window.setTimeout(arreterSonnerie, DUREE_SONNERIE_MS);
    }
  }, [chargement, appliquerProposition, arreterSonnerie]);

  useEffect(() => {
    const depart = window.setTimeout(verifier, 2000);
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

  if (!visible) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Rappel du budget mensuel"
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: "calc(10.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-primary/50 bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <AlarmClock
            className={`mt-0.5 h-5 w-5 shrink-0 text-primary ${sonne ? "animate-pulse" : ""}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Budget du mois à vérifier</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vos enveloppes ont été renouvelées le 1er. Modifiez votre budget avant la fin du 2e
              jour, sinon la proposition automatique sera retenue pour tout le mois.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to="/enveloppes/budgetisation"
                search={{ onglet: "auto" }}
                onClick={arreterSonnerie}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden /> Modifier mon budget
              </Link>
              <button
                type="button"
                onClick={() => {
                  arreterSonnerie();
                  appliquerProposition();
                  setVisible(false);
                }}
                className="rounded-lg border border-input px-2.5 py-1 text-xs font-medium"
              >
                Garder la proposition
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
