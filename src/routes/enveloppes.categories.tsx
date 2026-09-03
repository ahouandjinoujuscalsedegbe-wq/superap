import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChoixIcone } from "@/components/ChoixIcone";
import { suggererIcone } from "@/lib/icone-auto";
import { Plus, Pencil, Trash2, ChevronDown, GripVertical, Undo2 } from "lucide-react";
import type { CategorieEnveloppe } from "@/lib/store";
import { useSuperApp } from "@/lib/store";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { PopupSaisie } from "@/components/PopupSaisie";

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
        content:
          "Page dédiée à la gestion des catégories et sous-catégories des enveloppes budgétaires.",
      },
    ],
  }),
  component: PageCategories,
});

/** Pop-up de saisie en cours : toute création/modification passe par là. */
type Saisie =
  | { type: "creation-categorie" }
  | { type: "renommage-categorie"; id: string; ancien: string }
  | { type: "creation-sous"; id: string; categorie: string; existantes: string[] }
  | { type: "renommage-sous"; id: string; categorie: string; ancien: string }
  | null;

/** Confirmation obligatoire avant application de la modification. */
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
    definirIconeCategorie,
    renommerCategorie,
    supprimerCategorie,
    ajouterSousCategorie,
    renommerSousCategorie,
    supprimerSousCategorie,
    reordonnerCategories,
    reordonnerSousCategories,
    restaurerCategories,
  } = useSuperApp();

  const [saisie, setSaisie] = useState<Saisie>(null);
  const [valeur, setValeur] = useState("");
  const [demande, setDemande] = useState<Demande>(null);
  const [erreurPopup, setErreurPopup] = useState<string | null>(null);
  const [categorieOuverte, setCategorieOuverte] = useState<string | null>(null);
  const [dragCat, setDragCat] = useState<number | null>(null);
  /** Catégorie dont on choisit le logo. */
  const [iconeCat, setIconeCat] = useState<{ id: string; nom: string; emoji: string } | null>(null);
  const [dragSous, setDragSous] = useState<{ id: string; index: number } | null>(null);
  /** Ordre enregistré avant la dernière réorganisation — permet de l’annuler. */
  const [ordrePrecedent, setOrdrePrecedent] = useState<CategorieEnveloppe[] | null>(null);

  /** Mémorise l’ordre actuel avant d’appliquer une réorganisation. */
  function sauvegarderOrdre() {
    setOrdrePrecedent(categories.map((c) => ({ ...c, sousCategories: [...c.sousCategories] })));
  }

  function annulerReorganisation() {
    if (!ordrePrecedent) return;
    restaurerCategories(ordrePrecedent);
    setOrdrePrecedent(null);
    toast.success("Réorganisation annulée : l’ordre précédent est restauré.");
  }

  const compter = (cat: string, sous?: string) =>
    enveloppes.filter(
      (e) =>
        (e.categorie ?? "") === cat && (sous === undefined || (e.sousCategorie ?? "") === sous),
    ).length;

  function ouvrirSaisie(s: NonNullable<Saisie>) {
    setSaisie(s);
    setValeur(s.type === "renommage-categorie" || s.type === "renommage-sous" ? s.ancien : "");
    setErreurPopup(null);
  }

  /** Valide la saisie du pop-up puis ouvre la confirmation obligatoire. */
  function validerSaisie() {
    if (!saisie) return;
    const nom = valeur.trim();
    if (!nom) {
      setSaisie(null);
      setErreurPopup("Le nom ne peut pas être vide. Reprenez votre action.");
      return;
    }
    switch (saisie.type) {
      case "creation-categorie":
        if (categories.some((c) => c.nom.toLowerCase() === nom.toLowerCase())) {
          setSaisie(null);
          setErreurPopup(`La catégorie « ${nom} » existe déjà. Reprenez votre action.`);
          return;
        }
        setDemande({ type: "creation-categorie", nom });
        break;
      case "renommage-categorie":
        if (
          nom !== saisie.ancien &&
          categories.some((c) => c.nom.toLowerCase() === nom.toLowerCase())
        ) {
          setSaisie(null);
          setErreurPopup(`La catégorie « ${nom} » existe déjà. Reprenez votre action.`);
          return;
        }
        setDemande({ type: "renommage-categorie", id: saisie.id, ancien: saisie.ancien, nom });
        break;
      case "creation-sous":
        if (saisie.existantes.some((s) => s.toLowerCase() === nom.toLowerCase())) {
          setSaisie(null);
          setErreurPopup(
            `La sous-catégorie « ${nom} » existe déjà dans ${saisie.categorie}. Reprenez votre action.`,
          );
          return;
        }
        setDemande({ type: "creation-sous", id: saisie.id, categorie: saisie.categorie, nom });
        break;
      case "renommage-sous": {
        const cat = categories.find((c) => c.id === saisie.id);
        if (
          nom !== saisie.ancien &&
          cat?.sousCategories.some((s) => s.toLowerCase() === nom.toLowerCase())
        ) {
          setSaisie(null);
          setErreurPopup(
            `La sous-catégorie « ${nom} » existe déjà dans ${saisie.categorie}. Reprenez votre action.`,
          );
          return;
        }
        setDemande({
          type: "renommage-sous",
          id: saisie.id,
          categorie: saisie.categorie,
          ancien: saisie.ancien,
          nom,
        });
        break;
      }
    }
    setSaisie(null);
    setValeur("");
  }

  function confirmer() {
    if (!demande) return;
    switch (demande.type) {
      case "creation-categorie":
        ajouterCategorie(demande.nom, suggererIcone(demande.nom, "enveloppe"));
        toast.success("Catégorie créée.");
        break;
      case "renommage-categorie":
        renommerCategorie(demande.id, demande.nom);
        toast.success("Catégorie renommée.");
        break;
      case "suppression-categorie":
        supprimerCategorie(demande.id);
        toast.success("Catégorie supprimée.");
        break;
      case "creation-sous":
        ajouterSousCategorie(demande.id, demande.nom);
        toast.success("Sous-catégorie créée.");
        break;
      case "renommage-sous":
        renommerSousCategorie(demande.id, demande.ancien, demande.nom);
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

  const titreSaisie: Record<NonNullable<Saisie>["type"], string> = {
    "creation-categorie": "Ajouter une nouvelle catégorie",
    "renommage-categorie": "Renommer la catégorie",
    "creation-sous": "Ajouter une sous-catégorie",
    "renommage-sous": "Renommer la sous-catégorie",
  };

  const labelSaisie: Record<NonNullable<Saisie>["type"], string> = {
    "creation-categorie": "Nom de la nouvelle catégorie",
    "renommage-categorie": "Nouveau nom de la catégorie",
    "creation-sous": "Nom de la nouvelle sous-catégorie",
    "renommage-sous": "Nouveau nom de la sous-catégorie",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex-1"></div>
        <button
          type="button"
          onClick={() => ouvrirSaisie({ type: "creation-categorie" })}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" /> Ajouter une nouvelle catégorie
        </button>
      </div>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Catégories et sous-catégories</h1>
        <p className="text-sm text-muted-foreground">
          Toute création ou modification se fait dans un pop-up, avec confirmation obligatoire.
        </p>
      </header>

      <p className="text-xs text-muted-foreground">
        Astuce : faites glisser une bande par sa poignée{" "}
        <GripVertical aria-hidden className="inline h-3.5 w-3.5 align-text-bottom" /> (ou une
        sous-catégorie) pour la réorganiser. L’ordre est enregistré automatiquement.
      </p>

      {ordrePrecedent && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3">
          <p className="text-xs text-muted-foreground">
            Une réorganisation vient d’être appliquée.
          </p>
          <button
            type="button"
            onClick={annulerReorganisation}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <Undo2 aria-hidden className="h-3.5 w-3.5" /> Annuler la réorganisation
          </button>
        </div>
      )}

      <ul className="space-y-3">
        {categories.map((c, index) => {
          const ouverte = categorieOuverte === c.id;
          return (
            <li
              key={c.id}
              draggable
              onDragStart={() => setDragCat(index)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                if (dragCat !== null && dragCat !== index) {
                  sauvegarderOrdre();
                  reordonnerCategories(dragCat, index);
                  toast.success("Ordre des catégories enregistré.");
                }
                setDragCat(null);
              }}
              onDragEnd={() => setDragCat(null)}
              className={`carte overflow-hidden transition-colors transition-shadow hover:border-primary/50 hover:bg-secondary/40 hover:shadow-md ${
                dragCat === index ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-2 p-4">
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Glisser-déposer pour réorganiser ${c.nom}`}
                  title="Glisser pour réorganiser"
                  className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded-md border border-border/70 bg-secondary/60 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
                >
                  <GripVertical aria-hidden className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  aria-label={`Choisir le logo de ${c.nom}`}
                  onClick={() =>
                    setIconeCat({
                      id: c.id,
                      nom: c.nom,
                      emoji: c.emoji ?? suggererIcone(c.nom, "enveloppe"),
                    })
                  }
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg"
                >
                  {c.emoji ?? suggererIcone(c.nom, "enveloppe")}
                </button>
                <button
                  type="button"
                  onClick={() => setCategorieOuverte(ouverte ? null : c.id)}
                  aria-expanded={ouverte}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown
                    aria-hidden
                    className={`h-4 w-4 shrink-0 transition-transform ${ouverte ? "rotate-180" : ""}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.nom}</span>
                    <span className="block text-xs text-muted-foreground">
                      {compter(c.nom)} enveloppe(s) · {c.sousCategories.length} sous-catégorie(s)
                    </span>
                  </span>
                </button>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                  {compter(c.nom)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Renommer ${c.nom}`}
                    onClick={() =>
                      ouvrirSaisie({ type: "renommage-categorie", id: c.id, ancien: c.nom })
                    }
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

              {ouverte && (
                <div className="space-y-3 border-t border-border/70 p-4">
                  <ul className="space-y-2">
                    {c.sousCategories.length === 0 && (
                      <li className="text-xs text-muted-foreground">
                        Aucune sous-catégorie pour l’instant.
                      </li>
                    )}
                    {c.sousCategories.map((s, iSous) => (
                      <li
                        key={s}
                        draggable
                        onDragStart={(ev) => {
                          ev.stopPropagation();
                          setDragSous({ id: c.id, index: iSous });
                        }}
                        onDragOver={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                        }}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (dragSous && dragSous.id === c.id && dragSous.index !== iSous) {
                            sauvegarderOrdre();
                            reordonnerSousCategories(c.id, dragSous.index, iSous);
                            toast.success("Ordre des sous-catégories enregistré.");
                          }
                          setDragSous(null);
                        }}
                        onDragEnd={() => setDragSous(null)}
                        className={`flex items-center justify-between gap-2 rounded-xl border border-border/70 p-2 transition-colors transition-shadow hover:border-primary/50 hover:bg-secondary/50 hover:shadow-sm ${
                          dragSous?.id === c.id && dragSous.index === iSous ? "opacity-60" : ""
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            role="button"
                            tabIndex={-1}
                            aria-label={`Glisser-déposer pour réorganiser ${s}`}
                            title="Glisser pour réorganiser"
                            className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded-md border border-border/70 bg-secondary/60 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
                          >
                            <GripVertical aria-hidden className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 truncate text-sm">{s}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                            {compter(c.nom, s)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Renommer ${s}`}
                            onClick={() =>
                              ouvrirSaisie({
                                type: "renommage-sous",
                                id: c.id,
                                categorie: c.nom,
                                ancien: s,
                              })
                            }
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
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() =>
                      ouvrirSaisie({
                        type: "creation-sous",
                        id: c.id,
                        categorie: c.nom,
                        existantes: c.sousCategories,
                      })
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium"
                  >
                    <Plus aria-hidden className="h-4 w-4" /> Ajouter une sous-catégorie
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <PopupSaisie
        ouvert={saisie !== null}
        titre={saisie ? titreSaisie[saisie.type] : ""}
        label={saisie ? labelSaisie[saisie.type] : ""}
        valeur={valeur}
        placeholder="Transport, Facture SBEE…"
        onChanger={setValeur}
        onValider={validerSaisie}
        onAnnuler={() => setSaisie(null)}
      />

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

      <ErreurPopup
        ouvert={erreurPopup !== null}
        message={erreurPopup ?? ""}
        onFermer={() => setErreurPopup(null)}
      />

      {iconeCat && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Logo de ${iconeCat.nom}`}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setIconeCat(null)}
        >
          <div
            className="carte popup-anim w-full max-w-md space-y-3 p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Logo de « {iconeCat.nom} »</h3>
            <ChoixIcone
              nom={iconeCat.nom}
              domaine="enveloppe"
              valeur={iconeCat.emoji}
              onChoisir={(emoji) => setIconeCat({ ...iconeCat, emoji })}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  definirIconeCategorie(iconeCat.id, iconeCat.emoji);
                  setIconeCat(null);
                  toast.success("Logo enregistré.");
                }}
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setIconeCat(null)}
                className="flex-1 rounded-xl border border-input py-3 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
