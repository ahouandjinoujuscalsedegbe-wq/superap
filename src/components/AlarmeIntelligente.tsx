import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, BellOff, X } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import {
  calculerAlarmes,
  debloquerAlarme,
  declencherAlarmeAppareil,
  lireReglagesAlarme,
  reporterAlarme,
  type Alarme,
} from "@/lib/alarme";
import { idRappel, programmerNotificationsPlanifiees } from "@/lib/alarme-appareil";
import { occurrencesEntre } from "@/lib/planning";



/**
 * Surveille en continu les dépenses planifiées et les prévisions locales,
 * puis déclenche une alarme sonore et visuelle. Tout est calculé sur
 * l'appareil, sans aucun envoi de données.
 */
export function AlarmeIntelligente() {
  const { budgets, enveloppes, transactions, solde, soldesParCompte, depensesParEnveloppe } =
    useSuperApp();
  const [alarmes, setAlarmes] = useState<Alarme[]>([]);
  const [tick, setTick] = useState(0);
  const dejaSonnees = useRef<Set<string>>(new Set());

  const donnees = useMemo(
    () => ({ budgets, enveloppes, transactions, solde, soldesParCompte, depensesParEnveloppe }),
    [budgets, enveloppes, transactions, solde, soldesParCompte, depensesParEnveloppe],
  );

  const recalculer = useCallback(() => {
    const reglages = lireReglagesAlarme();
    const liste = calculerAlarmes(donnees, reglages);
    setAlarmes(liste);

    const nouvelle = liste.find((a) => !dejaSonnees.current.has(a.id));
    for (const a of liste) dejaSonnees.current.add(a.id);

    if (nouvelle && reglages.active) {
      void declencherAlarmeAppareil({
        volume: reglages.volume,
        urgent: nouvelle.niveau === "alerte",
        son: reglages.son,
        vibration: reglages.vibration,
        notification: reglages.notification,
        titre: nouvelle.titre,
        texte: nouvelle.texte,
      });
    }
  }, [donnees]);

  // Le son et la vibration ne sont autorisés qu'après un premier contact avec
  // l'écran : on prépare le moteur audio et la permission dès ce moment-là.
  useEffect(() => {
    const preparer = () => void debloquerAlarme();
    document.addEventListener("pointerdown", preparer, { once: true });
    document.addEventListener("keydown", preparer, { once: true });
    return () => {
      document.removeEventListener("pointerdown", preparer);
      document.removeEventListener("keydown", preparer);
    };
  }, []);

  useEffect(() => {
    const depart = window.setTimeout(recalculer, 3000);
    const intervalle = window.setInterval(recalculer, 5 * 60_000);
    return () => {
      window.clearTimeout(depart);
      window.clearInterval(intervalle);
    };
  }, [recalculer, tick]);

  // Rappels programmés à l'avance : le téléphone sonne le jour de la dépense
  // planifiée, même si l'application n'a pas été ouverte entre-temps.
  useEffect(() => {
    const reglages = lireReglagesAlarme();
    if (!reglages.active || !reglages.notification) return;

    const aujourdHui = new Date();
    const debut = aujourdHui.toISOString().slice(0, 10);
    const fin = new Date(aujourdHui.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);

    const rappels: { id: number; titre: string; texte: string; quand: Date }[] = [];
    for (const b of budgets) {
      for (const date of occurrencesEntre(b, debut, fin)) {
        const env = enveloppes.find((e) => e.id === b.enveloppeId);
        // Sonnerie à 8 h, avec l'avance choisie dans les réglages.
        const quand = new Date(`${date}T08:00:00`);
        quand.setDate(quand.getDate() - reglages.avanceJours);
        rappels.push({
          id: idRappel(`${b.id}-${date}`),
          titre: `${env ? `${env.emoji} ` : "📌 "}${b.libelle}`,
          texte: `Dépense planifiée de ${Math.round(b.montant).toLocaleString("fr-FR")} FCFA le ${date}.`,
          quand,
        });
      }
    }
    void programmerNotificationsPlanifiees(rappels);
  }, [budgets, enveloppes]);




  if (alarmes.length === 0) return null;
  const alarme = alarmes[0];
  if (!alarme) return null;
  const urgent = alarme.niveau === "alerte";

  function fermer(heures: number) {
    if (!alarme) return;
    reporterAlarme(alarme.id, heures);
    setAlarmes((liste) => liste.filter((a) => a.id !== alarme.id));
    setTick((t) => t + 1);
  }

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Alarme intelligente"
      className="fixed inset-x-0 z-40 px-3"
      style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className={`mx-auto max-w-md rounded-2xl border p-3 shadow-lg backdrop-blur ${
          urgent ? "border-destructive/50 bg-destructive/10" : "border-border bg-card/95"
        }`}
      >
        <div className="flex items-start gap-3">
          <AlarmClock
            className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? "text-destructive" : "text-primary"}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{alarme.titre}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{alarme.texte}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {alarme.type === "echeance"
                ? "Rappel de dépense planifiée"
                : alarme.type === "compte"
                  ? "Seuil de compte atteint"
                  : alarme.type === "plafond"
                    ? "Plafond d'enveloppe dépassé"
                    : "Prévision locale"}
              {alarmes.length > 1 ? ` · ${alarmes.length - 1} autre(s) alarme(s)` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fermer(6)}
                className="rounded-lg border border-input px-2.5 py-1 text-xs font-medium"
              >
                Rappeler dans 6 h
              </button>
              <button
                type="button"
                onClick={() => fermer(24)}
                className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-medium"
              >
                <BellOff className="h-3.5 w-3.5" aria-hidden /> Plus tard (24 h)
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer l'alarme"
            onClick={() => fermer(6)}
            className="rounded-full p-1 text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
