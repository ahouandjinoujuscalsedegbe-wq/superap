import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PencilLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { suggererIcone } from "@/lib/icone-auto";
import { enregistrerActionCompte } from "@/lib/historique-comptes";

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
    transactions,
    nomUtilisateur,
    transferts,
    soldesParCompte,
    supprimerCompte,
  } = useSuperApp();

  const [suppression, setSuppression] = useState<string | null>(null);
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
    setSuppression(compte);
  }

  function confirmerSuppression() {
    if (suppression === null) return;
    const auteur = nomUtilisateur?.trim() || "Utilisateur";
    supprimerCompte(suppression);
    enregistrerActionCompte({
      compte: suppression,
      action: "suppression",
      auteur,
      details: "Compte retiré du foyer (solde nul, sans opération liée).",
    });
    toast.success(`Compte « ${suppression} » supprimé.`, {
      description: "Retour à la liste des comptes.",
    });
    setSuppression(null);
    navigate({ to: "/comptes" });
  }

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
                      onClick={() =>
                        navigate({
                          to: "/comptes/modifier/$compte",
                          params: { compte: encodeURIComponent(c) },
                        })
                      }
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

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={suppression !== null}
        titre="Supprimer ce compte ?"
        message={`Le compte « ${suppression ?? ""} » sera définitivement supprimé. Cette action est irréversible.`}
        details={
          suppression !== null
            ? [
                {
                  label: "Logo",
                  apres: iconesComptes[suppression] ?? suggererIcone(suppression, "compte"),
                },
                { label: "Compte", apres: suppression },
                { label: "Solde", apres: formatFCFA(soldesParCompte[suppression] ?? 0) },
                {
                  label: "Solde disponible",
                  apres: comptesExclus.includes(suppression) ? "Exclu" : "Compté",
                },
              ]
            : []
        }
        confirmerLabel="Supprimer"
        danger
        onConfirmer={confirmerSuppression}
        onAnnuler={() => setSuppression(null)}
      />
    </div>
  );
}
