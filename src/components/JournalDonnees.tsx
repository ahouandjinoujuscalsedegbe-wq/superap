import { useState } from "react";
import { History, Trash } from "lucide-react";
import {
  formaterHorodatage,
  LIBELLES,
  lireJournal,
  viderJournal,
  type EntreeJournal,
} from "@/lib/journal-donnees";

/** Journal horodaté des exports chiffrés, purges et restaurations. */
export function JournalDonnees() {
  const [entrees, setEntrees] = useState<EntreeJournal[]>(() =>
    typeof window === "undefined" ? [] : lireJournal(),
  );

  return (
    <section className="carte space-y-3 p-4" data-test="journal-donnees">
      <h2 className="flex items-center gap-2 font-semibold">
        <History className="h-4 w-4" aria-hidden /> Journal des données
      </h2>
      <p className="text-sm text-muted-foreground">
        Trace locale et horodatée des exports chiffrés, des purges complètes et des restaurations
        effectuées sur cet appareil.
      </p>

      {entrees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          Aucune opération enregistrée pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {entrees.map((e) => (
            <li key={e.id} className="rounded-xl border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{LIBELLES[e.type] ?? e.type}</span>
                <span className="text-xs text-muted-foreground">
                  {formaterHorodatage(e.horodatage)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{e.details}</p>
            </li>
          ))}
        </ul>
      )}

      {entrees.length > 0 && (
        <button
          type="button"
          onClick={() => {
            viderJournal();
            setEntrees([]);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
        >
          <Trash className="h-4 w-4" aria-hidden /> Effacer le journal
        </button>
      )}
    </section>
  );
}
