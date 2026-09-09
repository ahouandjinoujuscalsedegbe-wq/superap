import { useMemo, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import {
  journalObjectif,
  libelleEtatRappel,
  type EtatRappel,
  type LigneJournalRappel,
} from "@/lib/rappels-objectifs";

const COULEUR_ETAT: Record<EtatRappel, string> = {
  approuve: "bg-emerald-100 text-emerald-700",
  rejete: "bg-rose-100 text-rose-700",
  non_lu: "bg-amber-100 text-amber-700",
};

/** Date et heure lisibles : « 09/09/2026 à 08:14 ». */
function dateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Historique des rappels envoyés pour un objectif : date, heure et état
 * (approuvé, rejeté ou non lu). Tout est lu depuis l'appareil.
 */
export function HistoriqueRappels({ objectifId }: { objectifId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const lignes = useMemo<LigneJournalRappel[]>(
    () => (ouvert ? journalObjectif(objectifId) : []),
    [ouvert, objectifId],
  );

  return (
    <div className="rounded-xl border border-input">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold"
      >
        <span className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" aria-hidden />
          Historique des rappels
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {ouvert && (
        <div className="space-y-2 border-t border-input px-3 py-2">
          {lignes.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun rappel envoyé pour le moment.</p>
          )}
          {lignes.map((l) => (
            <div key={l.cle} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium">{dateHeure(l.envoyeLe)}</p>
                <p className="text-muted-foreground">
                  Échéance du {l.dateEcheance} · {formatFCFA(l.montant)}
                  {l.reponduLe ? ` · réponse le ${dateHeure(l.reponduLe)}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${COULEUR_ETAT[l.etat]}`}
              >
                {libelleEtatRappel(l.etat)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
