import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function jourISO(d: Date): string {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}

type Props = {
  /** Jour sélectionné au format YYYY-MM-DD */
  valeur: string;
  onSelection: (jour: string) => void;
  /** Bornes de la période mise en évidence (YYYY-MM-DD) */
  plage?: { debut: string; fin: string };
};

export function Calendrier({ valeur, onSelection, plage }: Props) {
  const base = valeur ? new Date(`${valeur}T12:00:00`) : new Date();
  const [curseur, setCurseur] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1));

  const jours = useMemo(() => {
    const premier = new Date(curseur.getFullYear(), curseur.getMonth(), 1);
    const decalage = (premier.getDay() + 6) % 7; // lundi en premier
    const debut = new Date(premier);
    debut.setDate(premier.getDate() - decalage);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(debut);
      d.setDate(debut.getDate() + i);
      return d;
    });
  }, [curseur]);

  const aujourdhui = jourISO(new Date());

  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mois précédent"
          onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() - 1, 1))}
          className="rounded-lg border border-input p-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold capitalize">
          {MOIS[curseur.getMonth()]} {curseur.getFullYear()}
        </p>
        <button
          type="button"
          aria-label="Mois suivant"
          onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1))}
          className="rounded-lg border border-input p-1.5"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {JOURS.map((j, i) => (
          <span key={`${j}-${i}`}>{j}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {jours.map((d) => {
          const iso = jourISO(d);
          const horsMois = d.getMonth() !== curseur.getMonth();
          const dansPlage = plage ? iso >= plage.debut && iso <= plage.fin : false;
          const choisi = iso === valeur;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelection(iso)}
              aria-pressed={choisi}
              className={[
                "h-8 rounded-lg text-xs transition-colors",
                choisi
                  ? "bg-primary font-semibold text-primary-foreground"
                  : dansPlage
                    ? "bg-primary/15 text-foreground"
                    : horsMois
                      ? "text-muted-foreground/50"
                      : "text-foreground hover:bg-secondary",
                iso === aujourdhui && !choisi ? "ring-1 ring-primary/60" : "",
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
