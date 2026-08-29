import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import {
  categoriesDisponibles,
  sousCategoriesDisponibles,
  grouperParCategorie,
} from "@/lib/categories";

export const Route = createFileRoute("/enveloppes/modifier")({
  head: () => ({
    meta: [
      { title: "Modifier une enveloppe — SUPER APP" },
      {
        name: "description",
        content:
          "Page dédiée à la modification et à la suppression des enveloppes budgétaires du foyer, avec confirmation avant chaque action.",
      },
      { property: "og:title", content: "Modifier une enveloppe — SUPER APP" },
      {
        property: "og:description",
        content: "Modifiez le nom, l'emoji et le plafond de vos enveloppes en FCFA, ou supprimez-les après confirmation.",
      },
    ],
  }),
  component: ModifierEnveloppe,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

type Demande =
  | {
      type: "modification";
      id: string;
      nom: string;
      emoji: string;
      plafond: number;
      categorie: string;
      sousCategorie: string;
    }
  | { type: "suppression"; id: string; nom: string }
  | null;

function ModifierEnveloppe() {
  const { enveloppes, modifierEnveloppe, supprimerEnveloppe } = useSuperApp();

  const [edition, setEdition] = useState<string | null>(null);
  const [eNom, setENom] = useState("");
  const [eEmoji, setEEmoji] = useState("");
  const [ePlafond, setEPlafond] = useState("");
  const [eCategorie, setECategorie] = useState("");
  const [eSousCategorie, setESousCategorie] = useState("");

  const [demande, setDemande] = useState<Demande>(null);

  const listeCategories = useSuperApp().categories;
  const categories = categoriesDisponibles(enveloppes, listeCategories);
  const sousCategories = sousCategoriesDisponibles(enveloppes, eCategorie.trim(), listeCategories);
  const groupes = grouperParCategorie(enveloppes);

  function commencerEdition(id: string) {
    const e = enveloppes.find((x) => x.id === id);
    if (!e) return;
    setEdition(id);
    setENom(e.nom);
    setEEmoji(e.emoji);
    setEPlafond(String(e.plafond));
    setECategorie(e.categorie ?? "");
    setESousCategorie(e.sousCategorie ?? "");
  }

  function demanderModification(id: string) {
    const valeur = Number(ePlafond);
    if (!eNom.trim()) {
      toast.error("Le nom ne peut pas être vide.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur < 0) {
      toast.error("Plafond invalide.");
      return;
    }
    if (eSousCategorie.trim() && !eCategorie.trim()) {
      toast.error("Choisissez d'abord une catégorie.");
      return;
    }
    setDemande({
      type: "modification",
      id,
      nom: eNom.trim(),
      emoji: eEmoji.trim() || "💡",
      plafond: valeur,
      categorie: eCategorie.trim(),
      sousCategorie: eSousCategorie.trim(),
    });
  }

  function demanderSuppression(id: string) {
    const e = enveloppes.find((x) => x.id === id);
    if (!e) return;
    setDemande({ type: "suppression", id, nom: e.nom });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "modification") {
      modifierEnveloppe(demande.id, {
        nom: demande.nom,
        emoji: demande.emoji,
        plafond: demande.plafond,
        categorie: demande.categorie,
        sousCategorie: demande.sousCategorie,
      });
      setEdition(null);
      toast.success("Enveloppe modifiée.");
    } else {
      supprimerEnveloppe(demande.id);
      if (edition === demande.id) setEdition(null);
      toast.success("Enveloppe supprimée.");
    }
    setDemande(null);
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour à Action" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Modifier une enveloppe existante</h1>
        <p className="text-sm text-muted-foreground">
          {enveloppes.length} enveloppe{enveloppes.length > 1 ? "s" : ""} · chaque changement demande une confirmation.
        </p>
      </header>

      {enveloppes.length === 0 ? (
        <p className="carte p-4 text-sm text-muted-foreground">Aucune enveloppe à modifier.</p>
      ) : (
        <div className="space-y-5">
          {groupes.map((g) => (
            <section key={g.categorie} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-primary">{g.categorie}</h2>
              {g.sousCategories.map((s) => (
                <div key={s.sousCategorie} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.sousCategorie}
                  </p>
                  <ul className="space-y-3">
                    {s.enveloppes.map((e) => (
            <li key={e.id} className="carte p-4">
              {edition === e.id ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="w-20">
                      <label htmlFor={`emoji-${e.id}`} className="text-sm font-medium">
                        Emoji
                      </label>
                      <input
                        id={`emoji-${e.id}`}
                        value={eEmoji}
                        onChange={(ev) => setEEmoji(ev.target.value)}
                        className={champ}
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor={`nom-${e.id}`} className="text-sm font-medium">
                        Nom
                      </label>
                      <input
                        id={`nom-${e.id}`}
                        value={eNom}
                        onChange={(ev) => setENom(ev.target.value)}
                        className={champ}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`plafond-${e.id}`} className="text-sm font-medium">
                      Plafond (FCFA)
                    </label>
                    <input
                      id={`plafond-${e.id}`}
                      inputMode="numeric"
                      value={ePlafond}
                      onChange={(ev) => setEPlafond(ev.target.value.replace(/[^\d]/g, ""))}
                      className={champ}
                    />
                  </div>
                  <div>
                    <label htmlFor={`categorie-${e.id}`} className="text-sm font-medium">
                      Catégorie
                    </label>
                    <input
                      id={`categorie-${e.id}`}
                      list="liste-categories-mod"
                      value={eCategorie}
                      onChange={(ev) => {
                        setECategorie(ev.target.value);
                        setESousCategorie("");
                      }}
                      placeholder="Transport, Factures…"
                      className={champ}
                    />
                  </div>
                  <div>
                    <label htmlFor={`sous-categorie-${e.id}`} className="text-sm font-medium">
                      Sous-catégorie
                    </label>
                    <input
                      id={`sous-categorie-${e.id}`}
                      list="liste-sous-categories-mod"
                      value={eSousCategorie}
                      onChange={(ev) => setESousCategorie(ev.target.value)}
                      placeholder="Carburant, Facture SBEE…"
                      className={champ}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => demanderModification(e.id)}
                      className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdition(null)}
                      className="flex-1 rounded-xl border border-input py-3 font-medium"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      <span aria-hidden>{e.emoji}</span> {e.nom}
                    </span>
                    <span className="text-sm text-muted-foreground">Plafond : {formatFCFA(e.plafond)}</span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => commencerEdition(e.id)}
                      className="flex items-center gap-1 rounded-lg border border-input px-3 py-2 text-xs font-medium"
                    >
                      <Pencil aria-hidden className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => demanderSuppression(e.id)}
                      className="flex items-center gap-1 rounded-lg border border-input px-3 py-2 text-xs font-medium text-destructive"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </span>
                </div>
              )}
            </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <datalist id="liste-categories-mod">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="liste-sous-categories-mod">
        {sousCategories.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Confirmation
        ouvert={demande !== null}
        titre={demande?.type === "suppression" ? "Supprimer cette enveloppe ?" : "Confirmer la modification"}
        message={
          demande?.type === "suppression"
            ? `L'enveloppe « ${demande.nom} » sera définitivement supprimée. Cette action est irréversible.`
            : demande
              ? `L'enveloppe sera enregistrée sous « ${demande.nom} » (${demande.categorie || "sans catégorie"}${demande.sousCategorie ? ` › ${demande.sousCategorie}` : ""}) avec un plafond de ${formatFCFA(demande.plafond)}.`
              : ""
        }
        confirmerLabel={demande?.type === "suppression" ? "Supprimer" : "Enregistrer"}
        danger={demande?.type === "suppression"}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
