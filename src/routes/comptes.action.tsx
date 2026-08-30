import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { PopupSaisie } from "@/components/PopupSaisie";

type Demande =
  | { type: "creation"; nom: string }
  | { type: "renommage"; ancien: string; nom: string }
  | { type: "suppression"; nom: string }
  | null;

export const Route = createFileRoute("/comptes/action")({
  head: () => ({
    meta: [
      { title: "Action — Ajouter et modifier vos comptes" },
      {
        name: "description",
        content:
          "Créez un nouveau compte, renommez ou supprimez un compte existant du foyer, avec confirmation avant chaque opération.",
      },
      { property: "og:title", content: "Action sur les comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Création, renommage et suppression de comptes en francs CFA.",
      },
    ],
  }),
  component: ActionComptes,
});

function ActionComptes() {
  const {
    comptes,
    transactions,
    transferts,
    soldesParCompte,
    ajouterCompte,
    renommerCompte,
    supprimerCompte,
  } = useSuperApp();

  const [popupCreation, setPopupCreation] = useState(false);
  const [nouveau, setNouveau] = useState("");
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [nomEdite, setNomEdite] = useState("");
  const [demande, setDemande] = useState<Demande>(null);

  function validerCreation() {
    const nom = nouveau.trim();
    if (!nom) return toast.error("Donnez un nom au compte.");
    if (nom.length > 30) return toast.error("Nom trop long (30 caractères maximum).");
    if (comptes.includes(nom)) return toast.error("Ce compte existe déjà.");
    setPopupCreation(false);
    setDemande({ type: "creation", nom });
  }

  function validerRenommage() {
    if (!enEdition) return;
    const nom = nomEdite.trim();
    if (!nom) return toast.error("Le nom ne peut pas être vide.");
    if (nom !== enEdition && comptes.includes(nom)) return toast.error("Ce compte existe déjà.");
    setDemande({ type: "renommage", ancien: enEdition, nom });
  }

  function retirer(nom: string) {
    if (transactions.some((t) => t.compte === nom))
      return toast.error("Ce compte contient des opérations.");
    if (transferts.some((t) => t.source === nom || t.destination === nom))
      return toast.error("Ce compte est lié à des transferts.");
    if ((soldesParCompte[nom] ?? 0) !== 0)
      return toast.error("Videz d'abord ce compte : son solde n'est pas nul.");
    setDemande({ type: "suppression", nom });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "creation") {
      ajouterCompte(demande.nom);
      setNouveau("");
      toast.success(`Compte « ${demande.nom} » ajouté.`);
    } else if (demande.type === "renommage") {
      renommerCompte(demande.ancien, demande.nom);
      setEnEdition(null);
      toast.success("Compte modifié.");
    } else {
      supprimerCompte(demande.nom);
      toast.success("Compte supprimé.");
    }
    setDemande(null);
  }

  const danger = demande?.type === "suppression";
  const titre =
    demande?.type === "creation"
      ? "Confirmer la création du compte"
      : demande?.type === "renommage"
        ? "Confirmer la modification"
        : "Supprimer ce compte ?";
  const message =
    demande?.type === "creation"
      ? `Le compte « ${demande.nom} » sera ajouté à votre liste.`
      : demande?.type === "renommage"
        ? `Le compte « ${demande.ancien} » sera renommé « ${demande.nom} ».`
        : demande?.type === "suppression"
          ? `Le compte « ${demande.nom} » sera définitivement supprimé. Cette action est irréversible.`
          : "";

  return (
    <div className="space-y-4">
      <Link
        to="/comptes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Comptes
      </Link>

      <button
        type="button"
        onClick={() => setPopupCreation(true)}
        className="carte flex w-full items-center gap-3 p-4 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Plus className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block font-semibold">Créer un nouveau compte</span>
          <span className="block text-sm text-muted-foreground">
            Banque, mobile money, espèces, tontine…
          </span>
        </span>
      </button>

      <section className="carte space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">Comptes existants</h2>
          <p className="text-sm text-muted-foreground">
            Renommez ou supprimez un compte. Un compte lié à des opérations ne peut pas être
            supprimé.
          </p>
        </div>

        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {comptes.map((c) => (
              <li key={c} className="rounded-xl border border-border/70 bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFCFA(soldesParCompte[c] ?? 0)}
                    </p>
                  </div>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEnEdition(c);
                        setNomEdite(c);
                      }}
                      aria-label={`Modifier ${c}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium"
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => retirer(c)}
                      aria-label={`Supprimer ${c}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden /> Supprimer
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PopupSaisie
        ouvert={popupCreation}
        titre="Nouveau compte"
        label="Nom du compte"
        valeur={nouveau}
        placeholder="Ex. Tontine du quartier"
        validerLabel="Créer"
        onChanger={setNouveau}
        onValider={validerCreation}
        onAnnuler={() => setPopupCreation(false)}
      />

      <PopupSaisie
        ouvert={enEdition !== null}
        titre="Modifier le compte"
        label="Nouveau nom"
        valeur={nomEdite}
        validerLabel="Enregistrer"
        onChanger={setNomEdite}
        onValider={validerRenommage}
        onAnnuler={() => setEnEdition(null)}
      />

      <Confirmation
        ouvert={demande !== null}
        titre={titre}
        message={message}
        confirmerLabel={danger ? "Supprimer" : "Confirmer"}
        danger={danger}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
