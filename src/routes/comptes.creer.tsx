import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { enregistrerActionCompte } from "@/lib/historique-comptes";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { FormulaireCompte, type DemandeCompte } from "@/components/FormulaireCompte";

export const Route = createFileRoute("/comptes/creer")({
  head: () => ({
    meta: [
      { title: "Créer un compte — SUPER APP" },
      {
        name: "description",
        content:
          "Ajoutez un nouveau compte du foyer avec son logo, son solde initial et sa place dans le solde disponible.",
      },
      { property: "og:title", content: "Créer un compte — SUPER APP" },
      {
        property: "og:description",
        content: "Ajoutez un nouveau compte du foyer en francs CFA.",
      },
    ],
  }),
  component: CreerCompte,
});

function CreerCompte() {
  const navigate = useNavigate();
  const { ajouterCompte, ajouterTransaction, nomUtilisateur } = useSuperApp();
  const [demande, setDemande] = useState<DemandeCompte | null>(null);

  function confirmer() {
    if (!demande || demande.type !== "creation") return;
    ajouterCompte(demande.nom, demande.disponible, demande.emoji);
    if (demande.solde > 0) {
      ajouterTransaction({
        type: "revenu",
        montant: demande.solde,
        libelle: "SOLDE INITIAL",
        categorie: "Autre",
        compte: demande.nom,
        date: new Date().toISOString().slice(0, 10),
      });
    }
    enregistrerActionCompte({
      compte: demande.nom,
      action: "creation",
      auteur: nomUtilisateur?.trim() || "Utilisateur",
      details: `Solde initial ${formatFCFA(demande.solde)} · ${demande.disponible ? "compté dans" : "exclu du"} solde disponible`,
    });
    toast.success(`Compte « ${demande.nom} » créé.`, {
      description: "Retour à la liste des comptes.",
    });
    setDemande(null);
    navigate({ to: "/comptes" });
  }

  return (
    <div className="page-anim space-y-5">
      <section className="carte space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          Créez un compte du foyer : banque, mobile money, espèces, tontine…
        </p>
        <FormulaireCompte onDemande={setDemande} />
      </section>

      <Confirmation
        ouvert={demande !== null}
        titre="Confirmer la création"
        message="Vérifiez le récapitulatif complet avant de valider la création."
        details={
          demande?.type === "creation"
            ? [
                { label: "Logo", apres: demande.emoji },
                { label: "Nom", apres: demande.nom },
                { label: "Solde initial", apres: formatFCFA(demande.solde) },
                { label: "Solde disponible", apres: demande.disponible ? "Compté" : "Exclu" },
              ]
            : []
        }
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
