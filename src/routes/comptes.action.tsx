import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PencilLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { FormulaireCompte, type DemandeCompte } from "@/components/FormulaireCompte";
import { suggererIcone } from "@/lib/icone-auto";
import { enregistrerActionCompte } from "@/lib/historique-comptes";

type Demande = DemandeCompte | { type: "suppression"; nom: string };

export const Route = createFileRoute("/comptes/action")({
  head: () => ({
    meta: [
      { title: "Renommer ou supprimer un compte — SUPER APP" },
      {
        name: "description",
        content:
          "Renommez un compte existant, ajustez son solde ou retirez-le du foyer, avec confirmation avant chaque opération.",
      },
      { property: "og:title", content: "Comptes existants — SUPER APP" },
      {
        property: "og:description",
        content: "Modification et suppression de comptes existants en francs CFA.",
      },
    ],
  }),
  component: ActionComptes,
});

function ActionComptes() {
  const navigate = useNavigate();
  const {
    comptes,
    comptesExclus,
    iconesComptes,
    definirIconeCompte,
    definirCompteDisponible,
    transactions,
    nomUtilisateur,
    transferts,
    soldesParCompte,
    ajouterTransaction,
    renommerCompte,
    supprimerCompte,
  } = useSuperApp();

  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [demande, setDemande] = useState<Demande | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function retirer(compte: string) {
    if (transactions.some((t) => t.compte === compte)) {
      setErreur("Ce compte contient des opérations : il ne peut pas être supprimé.");
      return;
    }
    if (transferts.some((t) => t.source === compte || t.destination === compte)) {
      setErreur("Ce compte est lié à des transferts : il ne peut pas être supprimé.");
      return;
    }
    if ((soldesParCompte[compte] ?? 0) !== 0) {
      setErreur("Videz d'abord ce compte : son solde n'est pas nul.");
      return;
    }
    setDemande({ type: "suppression", nom: compte });
  }

  function confirmer() {
    if (!demande) return;
    const auteur = nomUtilisateur?.trim() || "Utilisateur";
    if (demande.type === "renommage") {
      if (demande.disponible === comptesExclus.includes(demande.ancien)) {
        definirCompteDisponible(demande.ancien, demande.disponible);
      }
      if (demande.nom !== demande.ancien) {
        renommerCompte(demande.ancien, demande.nom);
      }
      definirIconeCompte(demande.nom, demande.emoji);
      if (demande.ajustement !== 0) {
        ajouterTransaction({
          type: demande.ajustement > 0 ? "revenu" : "depense",
          montant: Math.abs(demande.ajustement),
          libelle: "AJUSTEMENT DE SOLDE",
          categorie: "Autre",
          compte: demande.nom,
          date: new Date().toISOString().slice(0, 10),
        });
      }
      const changements = [
        demande.nom !== demande.ancien ? `nom : « ${demande.ancien} » → « ${demande.nom} »` : null,
        demande.ajustement !== 0
          ? `solde ajusté de ${formatFCFA(Math.abs(demande.ajustement))}`
          : null,
        demande.disponible === comptesExclus.includes(demande.ancien)
          ? `solde disponible : ${demande.disponible ? "compté" : "exclu"}`
          : null,
      ].filter(Boolean);
      enregistrerActionCompte({
        compte: demande.nom,
        ancienNom: demande.ancien !== demande.nom ? demande.ancien : undefined,
        action: demande.ancien !== demande.nom ? "renommage" : "modification",
        auteur,
        details: changements.length > 0 ? changements.join(" · ") : "logo mis à jour",
      });
      toast.success(`Compte « ${demande.nom} » enregistré.`, {
        description: "Retour à la liste des comptes.",
      });
      setDemande(null);
      setEnEdition(null);
      navigate({ to: "/comptes" });
      return;
    }
    if (demande.type === "suppression") {
      supprimerCompte(demande.nom);
      enregistrerActionCompte({
        compte: demande.nom,
        action: "suppression",
        auteur,
        details: "Compte retiré du foyer (solde nul, sans opération liée).",
      });
      toast.success(`Compte « ${demande.nom} » supprimé.`, {
        description: "Retour à la liste des comptes.",
      });
      setDemande(null);
      setEnEdition(null);
      navigate({ to: "/comptes" });
      return;
    }
    setDemande(null);
    setEnEdition(null);
  }

  const danger = demande?.type === "suppression";

  return (
    <div className="page-anim space-y-5">
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
              <li
                key={c}
                className="rounded-xl border border-border/70 bg-secondary/40 p-3 transition-colors hover:bg-secondary"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-lg">
                      {iconesComptes[c] ?? suggererIcone(c, "compte")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFCFA(soldesParCompte[c] ?? 0)}
                        {comptesExclus.includes(c) ? " · hors solde disponible" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setEnEdition(c)}
                      aria-label={`Modifier ${c}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent/40"
                    >
                      <PencilLine className="h-3.5 w-3.5" aria-hidden /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => retirer(c)}
                      aria-label={`Supprimer ${c}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
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

      {enEdition !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Modifier le compte"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setEnEdition(null)}
        >
          <div
            className="carte popup-anim w-full max-w-md space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold">Modifier le compte</h3>
                <p className="text-xs text-muted-foreground">Renommez le compte « {enEdition} ».</p>
              </div>
              <button
                type="button"
                onClick={() => setEnEdition(null)}
                aria-label="Fermer"
                className="rounded-full p-1.5 transition-colors hover:bg-secondary"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            <FormulaireCompte
              key={enEdition}
              compte={enEdition}
              onDemande={setDemande}
              onAnnuler={() => setEnEdition(null)}
            />
          </div>
        </div>
      )}

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={demande !== null}
        titre={danger ? "Supprimer ce compte ?" : "Confirmer la modification"}
        message={
          danger
            ? `Le compte « ${demande?.type === "suppression" ? demande.nom : ""} » sera définitivement supprimé. Cette action est irréversible.`
            : "Vérifiez le nouveau nom du compte avant de valider."
        }
        details={
          demande?.type === "renommage"
            ? [
                {
                  label: "Logo",
                  avant: iconesComptes[demande.ancien] ?? suggererIcone(demande.ancien, "compte"),
                  apres: demande.emoji || suggererIcone(demande.nom, "compte"),
                },
                { label: "Nom", avant: demande.ancien, apres: demande.nom },
                {
                  label: "Solde",
                  avant: formatFCFA(soldesParCompte[demande.ancien] ?? 0),
                  apres: formatFCFA((soldesParCompte[demande.ancien] ?? 0) + demande.ajustement),
                },
                {
                  label: "Solde disponible",
                  avant: comptesExclus.includes(demande.ancien) ? "Exclu" : "Compté",
                  apres: demande.disponible ? "Compté" : "Exclu",
                },
              ]
            : demande?.type === "suppression"
              ? [
                  {
                    label: "Logo",
                    apres: iconesComptes[demande.nom] ?? suggererIcone(demande.nom, "compte"),
                  },
                  { label: "Compte", apres: demande.nom },
                  { label: "Solde", apres: formatFCFA(soldesParCompte[demande.nom] ?? 0) },
                  {
                    label: "Solde disponible",
                    apres: comptesExclus.includes(demande.nom) ? "Exclu" : "Compté",
                  },
                ]
              : []
        }
        confirmerLabel={danger ? "Supprimer" : "Enregistrer"}
        danger={danger}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
