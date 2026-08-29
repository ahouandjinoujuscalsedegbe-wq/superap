import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/enveloppes/action")({
  head: () => ({
    meta: [
      { title: "Action — Gérer les enveloppes budgétaires" },
      {
        name: "description",
        content:
          "Ajoutez, modifiez ou supprimez les enveloppes budgétaires du foyer et leurs plafonds en francs CFA.",
      },
      { property: "og:title", content: "Action — SUPER APP" },
      {
        property: "og:description",
        content: "Gestion des enveloppes : création, modification des plafonds et suppression en FCFA.",
      },
    ],
  }),
  component: ActionEnveloppes,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function ActionEnveloppes() {
  const { enveloppes, ajouterEnveloppe, modifierEnveloppe, supprimerEnveloppe } = useSuperApp();

  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [plafond, setPlafond] = useState("");
  const [edition, setEdition] = useState<string | null>(null);
  const [eNom, setENom] = useState("");
  const [eEmoji, setEEmoji] = useState("");
  const [ePlafond, setEPlafond] = useState("");

  function creerEnveloppe(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(plafond);
    if (!nom.trim()) {
      toast.error("Donnez un nom à l'enveloppe.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      toast.error("Plafond invalide.");
      return;
    }
    ajouterEnveloppe({ nom: nom.trim(), emoji: emoji.trim() || "💡", plafond: valeur });
    setNom("");
    setPlafond("");
    setEmoji("💡");
    toast.success("Enveloppe ajoutée.");
  }

  function validerEdition(id: string) {
    const valeur = Number(ePlafond);
    if (!eNom.trim()) {
      toast.error("Le nom ne peut pas être vide.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      toast.error("Plafond invalide.");
      return;
    }
    modifierEnveloppe(id, {
      nom: eNom.trim(),
      emoji: eEmoji.trim() || "💡",
      plafond: valeur,
    });
    setEdition(null);
    toast.success("Enveloppe modifiée.");
  }

  return (
    <div className="space-y-5">
      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <form onSubmit={creerEnveloppe} className="space-y-3">
          <div className="flex gap-2">
            <div className="w-20">
              <label htmlFor="e-emoji" className="text-sm font-medium">
                Emoji
              </label>
              <input
                id="e-emoji"
                value={emoji}
                onChange={(ev) => setEmoji(ev.target.value)}
                className={champ}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="e-nom" className="text-sm font-medium">
                Nouvelle enveloppe
              </label>
              <input
                id="e-nom"
                value={nom}
                onChange={(ev) => setNom(ev.target.value)}
                placeholder="Santé"
                className={champ}
              />
            </div>
          </div>

          <div>
            <label htmlFor="e-plafond" className="text-sm font-medium">
              Plafond (FCFA)
            </label>
            <input
              id="e-plafond"
              inputMode="numeric"
              value={plafond}
              onChange={(ev) => setPlafond(ev.target.value.replace(/[^\d]/g, ""))}
              placeholder="25000"
              className={champ}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Ajouter l'enveloppe
          </button>
        </form>

        <ul className="space-y-2">
          {enveloppes.map((e) => (
            <li key={e.id} className="rounded-xl border border-border/70 p-3">
              {edition === e.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={eEmoji}
                      onChange={(ev) => setEEmoji(ev.target.value)}
                      aria-label="Emoji"
                      className={`${champ} w-16`}
                    />
                    <input
                      value={eNom}
                      onChange={(ev) => setENom(ev.target.value)}
                      aria-label="Nom de l'enveloppe"
                      className={champ}
                    />
                  </div>
                  <input
                    inputMode="numeric"
                    value={ePlafond}
                    onChange={(ev) => setEPlafond(ev.target.value.replace(/[^\d]/g, ""))}
                    aria-label="Plafond"
                    className={champ}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => validerEdition(e.id)}
                      className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdition(null)}
                      className="flex-1 rounded-xl border border-input py-2 text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    <span aria-hidden>{e.emoji}</span> {e.nom} · {formatFCFA(e.plafond)}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEdition(e.id);
                        setENom(e.nom);
                        setEEmoji(e.emoji);
                        setEPlafond(String(e.plafond));
                      }}
                      className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        supprimerEnveloppe(e.id);
                        toast.success("Enveloppe supprimée.");
                      }}
                      className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-destructive"
                    >
                      Supprimer
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
