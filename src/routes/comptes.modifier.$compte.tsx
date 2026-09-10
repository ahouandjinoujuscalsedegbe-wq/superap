import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { FormulaireCompte, type DemandeCompte } from "@/components/FormulaireCompte";
import { suggererIcone } from "@/lib/icone-auto";
import { enregistrerActionCompte } from "@/lib/historique-comptes";

export const Route = createFileRoute("/comptes/modifier/$compte")({
  head: () => ({
    meta: [
      { title: "Modifier un compte — SUPER APP" },
      {
        name: "description",
        content:
          "Renommez un compte existant, ajustez son solde ou son logo, avec confirmation avant validation.",
      },
      { property: "og:title", content: "Modifier un compte — SUPER APP" },
      {
        property: "og:description",
        content: "Modification d'un compte existant en francs CFA.",
      },
    ],
  }),
  component: PageModifierCompte,
});

function PageModifierCompte() {
  const { compte } = Route.useParams();
  const navigate = useNavigate();
  const {
    comptes,
    comptesExclus,
    iconesComptes,
    definirIconeCompte,
    definirCompteDisponible,
    nomUtilisateur,
    soldesParCompte,
    ajouterTransaction,
    renommerCompte,
  } = useSuperApp();

  const nomCompte = decodeURIComponent(compte);
  const [demande, setDemande] = useState<
    (DemandeCompte & { type: "renommage" }) | null
  >(null);

  if (!comptes.includes(nomCompte)) {
    return (
      <div className="page-anim space-y-5">
        <section className="carte space-y-3 p-4">
          <h2 className="text-lg font-semibold">Compte introuvable</h2>
          <p className="text-sm text-muted-foreground">
            Le compte « {nomCompte} » n'existe pas ou a été supprimé.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/comptes/action" })}
            className="w-full rounded-xl border border-input py-3 font-medium transition-colors hover:bg-accent/40"
          >
            Retour aux comptes existants
          </button>
        </section>
      </div>
    );
  }

  function confirmer() {
    if (!demande) return;
    const auteur = nomUtilisateur?.trim() || "Utilisateur";
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
      demande.ajustement !== 0 ? `solde ajusté de ${formatFCFA(Math.abs(demande.ajustement))}` : null,
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
    toast.success(`Compte « ${demande.nom} » enregistré.`);
    setDemande(null);
    navigate({ to: "/comptes" });
  }

  return (
    <div className="page-anim space-y-5">
      <section className="carte space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">Modifier le compte</h2>
          <p className="text-sm text-muted-foreground">
            Renommez le compte « {nomCompte} », ajustez son solde, son logo ou sa place dans le
            solde disponible.
          </p>
        </div>
        <FormulaireCompte
          key={nomCompte}
          compte={nomCompte}
          onDemande={(d) => {
            if (d.type === "renommage") setDemande(d);
          }}
          onAnnuler={() => navigate({ to: "/comptes/action" })}
        />
      </section>

      <Confirmation
        ouvert={demande !== null}
        titre="Confirmer la modification"
        message="Vérifiez les changements du compte avant de valider."
        details={
          demande
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
            : []
        }
        confirmerLabel="Enregistrer"
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
