import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { X, Plus, Pencil } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";

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

  const [modal, setModal] = useState<"creer" | "modifier" | null>(null);

  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("💡");
  const [plafond, setPlafond] = useState("");

  const [edition, setEdition] = useState<string | null>(null);
  const [eNom, setENom] = useState("");
  const [eEmoji, setEEmoji] = useState("");
  const [ePlafond, setEPlafond] = useState("");

  function ouvrirCreer() {
    setNom("");
    setEmoji("💡");
    setPlafond("");
    setModal("creer");
  }

  function ouvrirModifier() {
    setEdition(null);
    setModal("modifier");
  }

  function fermer() {
    setModal(null);
    setEdition(null);
  }

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
    fermer();
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
      <BoutonRetour to="/enveloppes/" label="Retour aux enveloppes" />
      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <div className="space-y-3">
          <button
            type="button"
            onClick={ouvrirCreer}
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Créer une nouvelle enveloppe</p>
              <p className="text-sm text-muted-foreground">Ajoutez une enveloppe avec son plafond.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={ouvrirModifier}
            className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Pencil aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Modifier une enveloppe existante</p>
              <p className="text-sm text-muted-foreground">Renommez, changez le plafond ou supprimez.</p>
            </div>
          </button>
        </div>
      </section>

      {modal === "creer" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Créer une nouvelle enveloppe"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={fermer}
        >
          <div
            className="carte w-full max-w-md space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Nouvelle enveloppe</h3>
                <p className="text-xs text-muted-foreground">Créez une enveloppe budgétaire.</p>
              </div>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="rounded-full p-1.5 transition-colors hover:bg-secondary"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

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
                    Nom
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

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={fermer}
                  className="flex-1 rounded-xl border border-input py-3 font-medium"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "modifier" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Modifier une enveloppe existante"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={fermer}
        >
          <div
            className="carte flex max-h-[80vh] w-full max-w-md flex-col space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Modifier une enveloppe existante</h3>
                <p className="text-xs text-muted-foreground">{enveloppes.length} enveloppe{enveloppes.length > 1 ? "s" : ""}.</p>
              </div>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="rounded-full p-1.5 transition-colors hover:bg-secondary"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            <div className="-mr-2 overflow-y-auto pr-2">
              {enveloppes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune enveloppe à modifier.</p>
              ) : (
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
              )}
            </div>

            <button
              type="button"
              onClick={fermer}
              className="w-full rounded-xl border border-input py-3 font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
