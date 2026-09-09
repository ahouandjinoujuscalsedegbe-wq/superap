import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, PencilLine, Plus, RotateCcw, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Confirmation } from "@/components/Confirmation";
import { FormulaireObjectif } from "@/components/FormulaireObjectif";
import { useSuperApp, type Objectif } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";

export const Route = createFileRoute("/objectifs/action")({
  head: () => ({
    meta: [
      { title: "Action sur un objectif — SUPER APP" },
      {
        name: "description",
        content:
          "Modifier, clôturer ou supprimer un objectif d'épargne, d'achat programmé ou de tontine.",
      },
      { property: "og:title", content: "Action sur un objectif — SUPER APP" },
      {
        property: "og:description",
        content: "Toutes les opérations possibles sur vos objectifs, en un seul endroit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActionObjectifs,
});

const LIBELLE_TYPE: Record<string, string> = {
  epargne: "Épargne",
  achat: "Achat programmé",
  tontine: "Tontine",
};

function ActionObjectifs() {
  const { objectifs, modifierObjectif, supprimerObjectif } = useSuperApp();
  const [formulaire, setFormulaire] = useState<{ objectif: Objectif | null } | null>(null);
  const [aSupprimer, setASupprimer] = useState<Objectif | null>(null);
  const [aCloturer, setACloturer] = useState<Objectif | null>(null);
  const [dateAtteinte, setDateAtteinte] = useState("");
  const [montantFinal, setMontantFinal] = useState("");
  const [note, setNote] = useState("");

  const ouvrirCloture = (o: Objectif) => {
    setACloturer(o);
    setDateAtteinte(new Date().toISOString().slice(0, 10));
    setMontantFinal(grouperMontant(String(o.cible)));
    setNote("");
  };

  const enregistrerCloture = () => {
    if (!aCloturer) return;
    const montant = Number(deGrouperMontant(montantFinal));
    if (!dateAtteinte) {
      toast.error("Indiquez la date à laquelle l'objectif a été atteint.");
      return;
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error("Indiquez le montant réellement réuni.");
      return;
    }
    modifierObjectif(aCloturer.id, {
      atteintLe: dateAtteinte,
      montantFinal: montant,
      noteCloture: note.trim() || undefined,
      rappelActif: false,
      prelevementAuto: false,
    });
    toast.success("Objectif marqué comme atteint. Les rappels sont arrêtés.");
    setACloturer(null);
  };

  const rouvrir = (o: Objectif) => {
    modifierObjectif(o.id, {
      atteintLe: undefined,
      montantFinal: undefined,
      noteCloture: undefined,
    });
    toast.success("Objectif rouvert.");
  };

  return (
    <div className="space-y-4 p-4 pb-28">
      <h1 className="text-lg font-semibold">Action sur un objectif</h1>
      <p className="text-sm text-muted-foreground">
        Créez, modifiez, déclarez atteint ou supprimez vos objectifs d'épargne, achats programmés et
        tontines.
      </p>

      {formulaire ? (
        <FormulaireObjectif objectif={formulaire.objectif} onTermine={() => setFormulaire(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setFormulaire({ objectif: null })}
          className="carte flex w-full items-start gap-3 p-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">Créer un objectif</span>
            <span className="block text-xs text-muted-foreground">
              Épargne, achat programmé ou tontine, avec rappels.
            </span>
          </span>
        </button>
      )}

      {objectifs.length === 0 && (
        <div className="carte flex flex-col items-center gap-2 p-8 text-center">
          <Target className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Aucun objectif enregistré pour le moment.</p>
        </div>
      )}

      {objectifs.map((o) => (
        <article key={o.id} className="carte space-y-3 p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{o.libelle}</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {LIBELLE_TYPE[o.type ?? "epargne"]}
              </span>
              {o.atteintLe && (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Atteint le {o.atteintLe}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Objectif : {formatFCFA(o.cible)} · échéance {o.dateCible}
            </p>
            {o.montantFinal !== undefined && (
              <p className="text-xs text-muted-foreground">
                Montant réuni : {formatFCFA(o.montantFinal)}
                {o.noteCloture ? ` · ${o.noteCloture}` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFormulaire({ objectif: o });
                if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium"
            >
              <PencilLine className="h-4 w-4" aria-hidden /> Modifier
            </button>

            {o.atteintLe ? (
              <button
                type="button"
                onClick={() => rouvrir(o)}
                className="flex items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Rouvrir
              </button>
            ) : (
              <button
                type="button"
                onClick={() => ouvrirCloture(o)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Objectif atteint
              </button>
            )}

            <button
              type="button"
              onClick={() => setASupprimer(o)}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-card px-3 py-2 text-sm font-medium text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Supprimer
            </button>
          </div>

          {aCloturer?.id === o.id && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/50 p-3">
              <label className="block text-xs font-medium text-muted-foreground">
                Date à laquelle l'objectif a été atteint
                <input
                  type="date"
                  value={dateAtteinte}
                  onChange={(e) => setDateAtteinte(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Montant réellement réuni (FCFA)
                <input
                  inputMode="numeric"
                  value={montantFinal}
                  onChange={(e) => setMontantFinal(grouperMontant(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Remarque (facultatif)
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex. : tontine reçue, achat effectué…"
                  className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setACloturer(null)}
                  className="flex-1 rounded-xl border border-input bg-card px-4 py-2 text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={enregistrerCloture}
                  className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </article>
      ))}

      {aSupprimer && (
        <Confirmation
          ouvert
          danger
          confirmerLabel="Supprimer"
          titre="Supprimer cet objectif ?"
          message="Le suivi sera définitivement retiré. Vos opérations ne sont pas touchées."
          onAnnuler={() => setASupprimer(null)}
          onConfirmer={() => {
            supprimerObjectif(aSupprimer.id);
            setASupprimer(null);
            toast.success("Objectif supprimé.");
          }}
        />
      )}
    </div>
  );
}
