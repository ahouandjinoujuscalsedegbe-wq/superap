import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { alertesLocales } from "@/lib/analyste-local";
import { useSuperApp } from "@/lib/store";

/**
 * Boule flottante d'« Analyse intelligente », disponible sur toutes les pages :
 * une véritable sphère en lévitation perpétuelle, un appui déroule les constats
 * calculés localement sur le téléphone.
 */
export function BouleAnalyse() {
  const { enveloppes, transactions } = useSuperApp();
  const [ouvert, setOuvert] = useState(false);

  const alertes = useMemo(
    () => alertesLocales(enveloppes, transactions),
    [enveloppes, transactions],
  );

  if (alertes.length === 0) return null;

  const urgentes = alertes.filter((a) => a.niveau === "alerte").length;

  return (
    <>
      {ouvert && (
        <div
          onClick={() => setOuvert(false)}
          className="animate-fade-in fixed inset-0 z-[65] bg-black/40"
          aria-hidden
        />
      )}

      {ouvert && (
        <section
          role="dialog"
          aria-label="Analyse intelligente"
          className="carte animate-scale-in fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-3 right-3 z-[66] max-h-[55vh] space-y-2 overflow-y-auto p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Analyse intelligente
              </h2>
              <p className="text-xs text-muted-foreground">
                Calculée sur votre téléphone, sans aucune connexion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer l'analyse"
              className="rounded-full p-1.5 transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <ul className="space-y-1.5 text-sm">
            {alertes.map((a) => (
              <li key={a.id} className="rounded-lg bg-muted/50 px-3 py-2">
                <span
                  className={
                    a.niveau === "alerte"
                      ? "font-semibold text-destructive"
                      : a.niveau === "attention"
                        ? "font-semibold text-warning"
                        : "font-semibold"
                  }
                >
                  {a.titre}
                </span>
                <span className="block text-xs text-muted-foreground">{a.texte}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sphère flottante : lévitation + rotation + halo, sans arrêt. */}
      <div className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[67] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-label={`Analyse intelligente : ${alertes.length} constat${alertes.length > 1 ? "s" : ""}`}
          aria-expanded={ouvert}
          className="boule-levite pointer-events-auto relative h-16 w-16 rounded-full transition-transform active:scale-95"
        >
          <span className="boule-halo absolute -inset-2 rounded-full" aria-hidden />
          <span className="boule-orbite absolute -inset-1 rounded-full" aria-hidden />
          <span className="boule-3d-tournante absolute inset-0 flex items-center justify-center rounded-full text-primary-foreground">
            <span className="boule-eclat absolute inset-0 rounded-full" aria-hidden />
            <Sparkles className="relative h-6 w-6 drop-shadow" aria-hidden />
          </span>
          <span
            className={`absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold shadow ${
              urgentes > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-card text-foreground"
            }`}
          >
            {alertes.length}
          </span>
        </button>
        <span
          className="boule-ombre mt-1 h-2 w-10 rounded-[50%] bg-foreground/25 blur-[3px]"
          aria-hidden
        />
      </div>
    </>
  );
}
