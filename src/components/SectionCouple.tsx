import { useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";

/**
 * Mode couple : liste locale des membres du foyer, utilisée pour attribuer
 * chaque opération à une personne. Aucune donnée ne quitte l'appareil.
 */
export function SectionCouple() {
  const { membres, definirMembres } = useSuperApp();
  const [nom, setNom] = useState("");

  const ajouter = () => {
    const propre = nom.trim();
    if (!propre) return;
    if (membres.some((m) => m.toLowerCase() === propre.toLowerCase())) {
      toast.error("Ce membre existe déjà.");
      return;
    }
    definirMembres([...membres, propre]);
    setNom("");
    toast.success("Membre ajouté.");
  };

  return (
    <section className="carte space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Users className="h-4 w-4 text-primary" aria-hidden />
        Mode couple
      </h2>
      <p className="text-sm text-muted-foreground">
        Ajoutez les membres du foyer pour indiquer qui a fait chaque opération. Tout reste sur cet
        appareil.
      </p>

      <div className="flex gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Prénom du membre"
          aria-label="Nom du membre à ajouter"
          className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={ajouter}
          aria-label="Ajouter ce membre"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {membres.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {membres.map((m) => (
            <li
              key={m}
              className="flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs"
            >
              {m}
              <button
                type="button"
                onClick={() => definirMembres(membres.filter((x) => x !== m))}
                aria-label={`Retirer ${m}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
