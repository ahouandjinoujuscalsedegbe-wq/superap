import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { BoutonRetour } from "@/components/BoutonRetour";

type Demande = { id: string; libelle: string } | null;

export const Route = createFileRoute("/comptes/transferts/")({
  head: () => ({
    meta: [
      { title: "Transferts — Déplacer de l'argent entre comptes" },
      {
        name: "description",
        content:
          "Transférez des francs CFA d'un compte du foyer vers un autre et consultez l'historique des transferts récents.",
      },
      { property: "og:title", content: "Transferts entre comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Transferts internes en FCFA avec contrôle du solde et historique.",
      },
    ],
  }),
  component: Transferts,
});

function Transferts() {
  const { transferts, supprimerTransfert } = useSuperApp();
  const [demande, setDemande] = useState<Demande>(null);

  function confirmer() {
    if (!demande) return;
    supprimerTransfert(demande.id);
    setDemande(null);
    toast.success("Transfert supprimé.");
  }

  return (
    <div className="page-anim space-y-5">
      <BoutonRetour to="/comptes/" label="Retour aux comptes" />

      <Link
        to="/comptes/transferts/nouveau"
        className="carte flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ArrowLeftRight className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block font-semibold">Nouveau transfert</span>
          <span className="block text-sm text-muted-foreground">
            L'argent quitte un compte et arrive immédiatement sur l'autre.
          </span>
        </span>
      </Link>

      <section className="carte space-y-3 p-4">
        <h2 className="text-lg font-semibold">Derniers transferts</h2>
        {transferts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun transfert enregistré.</p>
        ) : (
          <ul className="space-y-2">
            {transferts.slice(0, 10).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-secondary/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t.source} → {t.destination}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateFr(t.date)}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{formatFCFA(t.montant)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDemande({
                        id: t.id,
                        libelle: `${t.source} → ${t.destination} (${formatFCFA(t.montant)})`,
                      })
                    }
                    aria-label="Supprimer le transfert"
                    className="rounded-lg border border-input px-2 py-1 text-xs text-destructive"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirmation
        ouvert={demande !== null}
        titre="Supprimer ce transfert ?"
        message={
          demande ? `Le transfert ${demande.libelle} sera supprimé et les soldes recalculés.` : ""
        }
        confirmerLabel="Supprimer"
        danger
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
