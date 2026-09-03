import { useMemo } from "react";
import { suggererIcones, type Domaine } from "@/lib/icone-auto";

/**
 * Sélecteur d'icône : l'intelligence locale propose des logos adaptés au nom
 * saisi (compte, catégorie ou enveloppe) et l'utilisateur choisit celui qui
 * lui convient, ou saisit le sien.
 */
export function ChoixIcone({
  nom,
  domaine,
  valeur,
  onChoisir,
  titre = "Logo proposé",
}: {
  nom: string;
  domaine: Domaine;
  valeur: string;
  onChoisir: (emoji: string) => void;
  titre?: string;
}) {
  const propositions = useMemo(() => suggererIcones(nom, domaine, 10), [nom, domaine]);

  return (
    <div className="rounded-xl border border-input bg-background/60 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-xl">
          {valeur || "❓"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{titre}</p>
          <p className="text-xs text-muted-foreground">
            Touchez un logo pour le choisir, ou saisissez le vôtre.
          </p>
        </div>
        <input
          value={valeur}
          onChange={(ev) => onChoisir(ev.target.value.slice(0, 4))}
          aria-label="Logo personnalisé"
          className="w-14 rounded-lg border border-input bg-background px-2 py-1.5 text-center text-lg outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {propositions.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChoisir(e)}
            aria-label={`Choisir le logo ${e}`}
            aria-pressed={valeur === e}
            className={`grid h-10 w-10 place-items-center rounded-full text-xl transition-transform active:scale-95 ${
              valeur === e ? "bg-primary/15 ring-2 ring-primary" : "bg-secondary"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
