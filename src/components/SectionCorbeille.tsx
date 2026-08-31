import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatDateFr, formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";

/**
 * Corbeille locale : les opérations supprimées restent récupérables
 * pendant 30 jours avant d'être effacées automatiquement.
 */
export function SectionCorbeille() {
  const { corbeille, restaurerTransaction, supprimerDefinitivement, viderCorbeille } =
    useSuperApp();
  const [vider, setVider] = useState(false);

  return (
    <section className="carte space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Corbeille ({corbeille.length})</h2>
        {corbeille.length > 0 && (
          <button
            type="button"
            onClick={() => setVider(true)}
            className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
          >
            Tout vider
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Les opérations supprimées restent récupérables pendant 30 jours, puis disparaissent
        automatiquement.
      </p>

      {corbeille.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">La corbeille est vide.</p>
      ) : (
        <ul className="space-y-2">
          {corbeille.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.libelle}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.type === "revenu" ? "Revenu" : "Dépense"} · {formatFCFA(c.montant)} ·
                  supprimée le {formatDateFr(c.supprimeLe.slice(0, 10))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  restaurerTransaction(c.id);
                  toast.success("Opération restaurée.");
                }}
                aria-label={`Restaurer ${c.libelle}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-primary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  supprimerDefinitivement(c.id);
                  toast.success("Opération effacée définitivement.");
                }}
                aria-label={`Effacer définitivement ${c.libelle}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Confirmation
        ouvert={vider}
        danger
        confirmerLabel="Tout vider"
        titre="Vider la corbeille ?"
        message="Toutes les opérations supprimées seront définitivement effacées."
        onAnnuler={() => setVider(false)}
        onConfirmer={() => {
          viderCorbeille();
          setVider(false);
          toast.success("Corbeille vidée.");
        }}
      />
    </section>
  );
}
