import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import type { AlerteLocale } from "@/lib/analyste-local";

/**
 * Résume l'« Analyse intelligente » de l'accueil en une seule boule flottante :
 * un appui déroule les constats calculés sur le téléphone.
 */
export function BouleAnalyse({ alertes }: { alertes: AlerteLocale[] }) {
  const [ouvert, setOuvert] = useState(false);
  if (alertes.length === 0) return null;

  const urgentes = alertes.filter((a) => a.niveau === "alerte").length;

  return (
    <>
      <AnimatePresence>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOuvert(false)}
            className="fixed inset-0 z-[65] bg-black/40"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ouvert && (
          <motion.section
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            role="dialog"
            aria-label="Analyse intelligente"
            className="carte fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-3 right-3 z-[66] max-h-[55vh] space-y-2 overflow-y-auto p-4"
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
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label={`Analyse intelligente : ${alertes.length} constat${alertes.length > 1 ? "s" : ""}`}
        aria-expanded={ouvert}
        whileTap={{ scale: 0.92 }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[67] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
      >
        <Sparkles className="h-6 w-6" aria-hidden />
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
            urgentes > 0
              ? "bg-destructive text-destructive-foreground"
              : "bg-card text-foreground"
          }`}
        >
          {alertes.length}
        </span>
      </motion.button>
    </>
  );
}
