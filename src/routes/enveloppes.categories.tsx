import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";

export const Route = createFileRoute("/enveloppes/categories")({
  head: () => ({
    meta: [
      { title: "Catégories — Organiser les enveloppes du foyer" },
      {
        name: "description",
        content:
          "Créez, renommez et supprimez les catégories et sous-catégories utilisées pour classer vos enveloppes budgétaires en FCFA.",
      },
      { property: "og:title", content: "Catégories — SUPER APP" },
      {
        property: "og:description",
        content: "Page dédiée à la gestion des catégories et sous-catégories des enveloppes budgétaires.",
      },
    ],
  }),
  component: PageCategories,
});

const champ =
  "w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

type Demande =
  | { type: "creation-categorie"; nom: string }
  | { type: "renommage-categorie"; id: string; ancien: string; nom: string }
  | { type: "suppression-categorie"; id: string; nom: string; nbEnveloppes: number }
  | { type: "creation-sous"; id: string; categorie: string; nom: string }
  | { type: "renommage-sous"; id: string; categorie: string; ancien: string; nom: string }
  | { type: "suppression-sous"; id: string; categorie: string; nom: string; nbEnveloppes: number }
  | null;

function PageCategories() {
  const {
    categories,
    enveloppes,
    ajouterCategorie,
    renommerCategorie,
    supprimerCategorie,
    ajouterSousCategorie,
    renommerSousCategorie,
    supprimerSousCategorie,
  } = useSuperApp();

  const [nouvelleSous, setNouvelleSous] = useState<Record<string, string>>({});
  const [editionCat, setEditionCat] = useState<string | null>(null);
  const [valeurCat, setValeurCat] = useState("");
  const [editionSous, setEditionSous] = useState<string | null>(null);
  const [valeurSous, setValeurSous] = useState("");
  const [demande, setDemande] = useState<Demande>(null);
  const [popupCreation, setPopupCreation] = useState(false);
  const [nomCreation, setNomCreation] = useState("");
  const [erreurPopup, setErreurPopup] = useState<string | null>(null);

  const compter = (cat: string, sous?: string) =>
    enveloppes.filter(
      (e) =>
        (e.categorie ?? "") === cat && (sous === undefined || (e.sousCategorie ?? "") === sous),
    ).length;

  function ouvrirCreation() {
    setNomCreation("");
    setErreurPopup(null);
    setPopupCreation(true);
  }

  function validerCreation() {
    const nom = nomCreation.trim();
    if (!nom) {
      setErreurPopup("Donnez un nom à la catégorie.");
      return;
    }
    if (categories.some((c) => c.nom === nom)) {
      setErreurPopup("Cette catégorie existe déjà.");
      return;
    }
    setErreurPopup(null);
    setPopupCreation(false);
    setDemande({ type: "creation-categorie", nom });
  }

  function confirmer() {
    if (!demande) return;
    switch (demande.type) {
      case "creation-categorie":
        ajouterCategorie(demande.nom);
        setNomCreation("");
        toast.success("Catégorie créée.");
        break;
      case "renommage-categorie":
        renommerCategorie(demande.id, demande.nom);
        setEditionCat(null);
        toast.success("Catégorie renommée.");
        break;
      case "suppression-categorie":
        supprimerCategorie(demande.id);
        toast.success("Catégorie supprimée.");
        break;
      case "creation-sous":
        ajouterSousCategorie(demande.id, demande.nom);
        setNouvelleSous((s) => ({ ...s, [demande.id]: "" }));
        toast.success("Sous-catégorie créée.");
        break;
      case "renommage-sous":
        renommerSousCategorie(demande.id, demande.ancien, demande.nom);
        setEditionSous(null);
        toast.success("Sous-catégorie renommée.");
        break;
      case "suppression-sous":
        supprimerSousCategorie(demande.id, demande.nom);
        toast.success("Sous-catégorie supprimée.");
        break;
    }
    setDemande(null);
  }

  const titres: Record<NonNullable<Demande>["type"], string> = {
    "creation-categorie": "Créer cette catégorie ?",
    "renommage-categorie": "Renommer cette catégorie ?",
    "suppression-categorie": "Supprimer cette catégorie ?",
    "creation-sous": "Créer cette sous-catégorie ?",
    "renommage-sous": "Renommer cette sous-catégorie ?",
    "suppression-sous": "Supprimer cette sous-catégorie ?",
  };

  function details(): { label: string; avant?: string; apres: string }[] {
    if (!demande) return [];
    switch (demande.type) {
      case "creation-categorie":
        return [{ label: "Catégorie", apres: demande.nom }];
      case "renommage-categorie":
        return [{ label: "Catégorie", avant: demande.ancien, apres: demande.nom }];
      case "suppression-categorie":
        return [
          { label: "Catégorie", apres: demande.nom },
          { label: "Enveloppes déclassées", apres: String(demande.nbEnveloppes) },
        ];
      case "creation-sous":
        return [
          { label: "Catégorie", apres: demande.categorie },
          { label: "Sous-catégorie", apres: demande.nom },
        ];
      case "renommage-sous":
        return [
          { label: "Catégorie", apres: demande.categorie },
          { label: "Sous-catégorie", avant: demande.ancien, apres: demande.nom },
        ];
      case "suppression-sous":
        return [
          { label: "Catégorie", apres: demande.categorie },
          { label: "Sous-catégorie", apres: demande.nom },
          { label: "Enveloppes déclassées", apres: String(demande.nbEnveloppes) },
        ];
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <BoutonRetour to="/enveloppes/action" label="Retour à Action" />
        </div>
        <button
          type="button"
          onClick={ouvrirCreation}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Plus aria-hidden className="h-4 w-4" /> Ajouter une nouvelle catégorie
        </button>
      </div>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Catégories et sous-catégories</h1>
        <p className="text-sm text-muted-foreground">
          Organisez le classement de vos enveloppes. Chaque action est confirmée.
        </p>
      </header>

      {popupCreation && (
        <div className="carte space-y-3 p-4">
          <label htmlFor="nouvelle-categorie" className="text-sm font-medium">
            Nouvelle catégorie
          </label>
          <input
            id="nouvelle-categorie"
            autoFocus
            value={nomCreation}
            onChange={(e) => {
              setNomCreation(e.target.value);
              setErreurPopup(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") validerCreation();
              if (e.key === "Escape") setPopupCreation(false);
            }}
            placeholder="Transport, Factures…"
            className={champ}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPopupCreation(false)}
              className="flex-1 rounded-xl border border-input py-2.5 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={validerCreation}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Plus aria-hidden className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {categories.map((c) => (
          <li key={c.id} className="carte space-y-3 p-4">
            {editionCat === c.id ? (
              <div className="flex gap-2">
                <input
                  aria-label={`Nouveau nom pour ${c.nom}`}
                  value={valeurCat}
                  onChange={(e) => setValeurCat(e.target.value)}
                  className={champ}
                />
                <button
                  type="button"
                  aria-label="Valider le renommage"
                  onClick={() => {
                    const nom = valeurCat.trim();
                    if (!nom) { toast.error("Nom vide."); return; }
                    setDemande({ type: "renommage-categorie", id: c.id, ancien: c.nom, nom });
                  }}
                  className="rounded-xl bg-primary px-3 text-primary-foreground"
                >
                  <Check aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Annuler"
                  onClick={() => setEditionCat(null)}
                  className="rounded-xl border border-input px-3"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {compter(c.nom)} enveloppe(s) · {c.sousCategories.length} sous-catégorie(s)
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Renommer ${c.nom}`}
                    onClick={() => {
                      setEditionCat(c.id);
                      setValeurCat(c.nom);
                    }}
                    className="rounded-full p-2 hover:bg-secondary"
                  >
                    <Pencil aria-hidden className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${c.nom}`}
                    onClick={() =>
                      setDemande({
                        type: "suppression-categorie",
                        id: c.id,
                        nom: c.nom,
                        nbEnveloppes: compter(c.nom),
                      })
                    }
                    className="rounded-full p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <ul className="space-y-2">
              {c.sousCategories.map((s) => (
                <li key={s} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 p-2">
                  {editionSous === `${c.id}:${s}` ? (
                    <>
                      <input
                        aria-label={`Nouveau nom pour ${s}`}
                        value={valeurSous}
                        onChange={(e) => setValeurSous(e.target.value)}
                        className={champ}
                      />
                      <button
                        type="button"
                        aria-label="Valider le renommage de la sous-catégorie"
                        onClick={() => {
                          const nom = valeurSous.trim();
                          if (!nom) { toast.error("Nom vide."); return; }
                          setDemande({
                            type: "renommage-sous",
                            id: c.id,
                            categorie: c.nom,
                            ancien: s,
                            nom,
                          });
                        }}
                        className="rounded-xl bg-primary px-3 py-2 text-primary-foreground"
                      >
                        <Check aria-hidden className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Annuler"
                        onClick={() => setEditionSous(null)}
                        className="rounded-xl border border-input px-3 py-2"
                      >
                        <X aria-hidden className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 truncate text-sm">{s}</span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Renommer ${s}`}
                          onClick={() => {
                            setEditionSous(`${c.id}:${s}`);
                            setValeurSous(s);
                          }}
                          className="rounded-full p-2 hover:bg-secondary"
                        >
                          <Pencil aria-hidden className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Supprimer ${s}`}
                          onClick={() =>
                            setDemande({
                              type: "suppression-sous",
                              id: c.id,
                              categorie: c.nom,
                              nom: s,
                              nbEnveloppes: compter(c.nom, s),
                            })
                          }
                          className="rounded-full p-2 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <input
                aria-label={`Nouvelle sous-catégorie de ${c.nom}`}
                value={nouvelleSous[c.id] ?? ""}
                onChange={(e) => setNouvelleSous((v) => ({ ...v, [c.id]: e.target.value }))}
                placeholder="Carburant, Facture SBEE…"
                className={champ}
              />
              <button
                type="button"
                onClick={() => {
                  const nom = (nouvelleSous[c.id] ?? "").trim();
                  if (!nom) { toast.error("Donnez un nom à la sous-catégorie."); return; }
                  if (c.sousCategories.includes(nom)) { toast.error("Elle existe déjà."); return; }
                  setDemande({ type: "creation-sous", id: c.id, categorie: c.nom, nom });
                }}
                className="shrink-0 rounded-xl bg-secondary px-3 font-medium"
              >
                Ajouter
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Confirmation
        ouvert={demande !== null}
        titre={demande ? titres[demande.type] : ""}
        message="Vérifiez les informations ci-dessous avant de valider."
        details={details()}
        danger={demande?.type.startsWith("suppression") ?? false}
        confirmerLabel={demande?.type.startsWith("suppression") ? "Supprimer" : "Confirmer"}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
