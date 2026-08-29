import { Delete } from "lucide-react";

type Props = {
  /** Longueur attendue du code (4 à 6 chiffres). */
  longueur: number;
  valeur: string;
  onChange: (valeur: string) => void;
  /** Appelé automatiquement dès que le code atteint la longueur attendue. */
  onComplet?: (valeur: string) => void;
  desactive?: boolean;
};

const TOUCHES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Pavé numérique dédié à la saisie d'un code PIN (indépendant du clavier système). */
export function PavePin({ longueur, valeur, onChange, onComplet, desactive }: Props) {
  const ajouter = (chiffre: string) => {
    if (desactive || valeur.length >= longueur) return;
    const suivant = valeur + chiffre;
    onChange(suivant);
    if (suivant.length === longueur) onComplet?.(suivant);
  };

  const effacer = () => {
    if (desactive) return;
    onChange(valeur.slice(0, -1));
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-3" aria-label="Code saisi">
        {Array.from({ length: longueur }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border transition-colors ${
              i < valeur.length ? "border-primary bg-primary" : "border-border bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="mx-auto grid max-w-[16rem] grid-cols-3 gap-3">
        {TOUCHES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={desactive}
            onClick={() => ajouter(t)}
            className="surface rounded-2xl border border-border py-3.5 text-xl font-semibold disabled:opacity-40"
          >
            {t}
          </button>
        ))}
        <span aria-hidden />
        <button
          type="button"
          disabled={desactive}
          onClick={() => ajouter("0")}
          className="surface rounded-2xl border border-border py-3.5 text-xl font-semibold disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          onClick={effacer}
          disabled={desactive || valeur.length === 0}
          aria-label="Effacer le dernier chiffre"
          className="surface flex items-center justify-center rounded-2xl border border-border py-3.5 disabled:opacity-40"
        >
          <Delete className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
