import { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";

/**
 * Purge complète : vide localStorage ET sessionStorage puis recharge
 * l'application. Deux confirmations explicites, fermeture par Échap
 * ou clic en dehors (sans supprimer).
 */
export function SectionPurge() {
  const [etape, setEtape] = useState<0 | 1 | 2>(0);

  const fermer = () => setEtape(0);

  const purger = () => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* noop */
    }
    window.location.reload();
  };

  return (
    <section className="carte space-y-3 border-destructive/40 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-destructive">
        <TriangleAlert className="h-4 w-4" aria-hidden /> Zone dangereuse
      </h2>
      <p className="text-sm text-muted-foreground">
        Supprime définitivement toutes les données de l'application sur cet appareil : comptes,
        enveloppes, opérations, dettes, budgets, sauvegardes automatiques, paramètres et code PIN.
        Cette action est irréversible.
      </p>
      <button
        type="button"
        onClick={() => setEtape(1)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground"
      >
        <Trash2 className="h-4 w-4" aria-hidden /> Supprimer toutes les données
      </button>

      {etape > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmation de suppression totale"
          onClick={fermer}
          onKeyDown={(e) => e.key === "Escape" && fermer()}
        >
          <div
            className="surface w-full max-w-sm space-y-4 rounded-2xl border border-border p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {etape === 1 ? (
              <>
                <h3 className="text-lg font-bold text-destructive">Tout supprimer ?</h3>
                <p className="text-sm text-muted-foreground">
                  Vous êtes sur le point d'effacer <strong>toutes</strong> vos données locales.
                  Aucune copie ne sera conservée sur cet appareil. Pensez à faire une sauvegarde
                  chiffrée avant de continuer.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fermer}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => setEtape(2)}
                    className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground"
                  >
                    Continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-destructive">Dernière confirmation</h3>
                <p className="text-sm text-muted-foreground">
                  Cette action est <strong>définitive et irréversible</strong>. L'application
                  redémarrera vide, comme à la première installation.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fermer}
                    className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={purger}
                    className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground"
                  >
                    Supprimer définitivement
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
