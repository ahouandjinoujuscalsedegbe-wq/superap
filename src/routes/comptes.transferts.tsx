import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";

type Demande =
  | { type: "transfert"; source: string; destination: string; montant: number; note: string }
  | { type: "suppression"; id: string; libelle: string }
  | null;

export const Route = createFileRoute("/comptes/transferts")({
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

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function Transferts() {
  const { comptes, transferts, soldesParCompte, ajouterTransfert, supprimerTransfert } =
    useSuperApp();

  const [source, setSource] = useState(comptes[0] ?? "");
  const [destination, setDestination] = useState(comptes[1] ?? "");
  const [montant, setMontant] = useState("");
  const [note, setNote] = useState("");
  const [demande, setDemande] = useState<Demande>(null);

  const dispo = soldesParCompte[source] ?? 0;

  function envoyer(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(montant);
    if (!source || !destination) {
      toast.error("Choisissez les deux comptes.");
      return;
    }
    if (source === destination) {
      toast.error("Choisissez deux comptes différents.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0 || !Number.isInteger(valeur)) {
      toast.error("Montant invalide : entrez un nombre entier de FCFA.");
      return;
    }
    if (valeur > dispo) {
      toast.error(`Solde insuffisant sur ${source} : ${formatFCFA(dispo)} disponibles.`);
      return;
    }
    setDemande({ type: "transfert", source, destination, montant: valeur, note: note.trim() });
  }

  function confirmer() {
    if (!demande) return;
    if (demande.type === "transfert") {
      ajouterTransfert({
        source: demande.source,
        destination: demande.destination,
        montant: demande.montant,
        note: demande.note,
        date: new Date().toISOString(),
      });
      setMontant("");
      setNote("");
      toast.success("Transfert enregistré.");
    } else {
      supprimerTransfert(demande.id);
      toast.success("Transfert supprimé.");
    }
    setDemande(null);
  }

  const danger = demande?.type === "suppression";

  return (
    <div className="space-y-4">
      <Link to="/comptes" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Comptes
      </Link>

      <section className="carte space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold">Nouveau transfert</h2>
          <p className="text-sm text-muted-foreground">
            L'argent quitte un compte et arrive immédiatement sur l'autre.
          </p>
        </div>

        <form onSubmit={envoyer} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="source" className="text-sm font-medium">
                Compte source
              </label>
              <select
                id="source"
                value={source}
                onChange={(ev) => setSource(ev.target.value)}
                className={champ}
              >
                {comptes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="destination" className="text-sm font-medium">
                Compte destinataire
              </label>
              <select
                id="destination"
                value={destination}
                onChange={(ev) => setDestination(ev.target.value)}
                className={champ}
              >
                {comptes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="truncate">{source || "—"}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{destination || "—"}</span>
            <span className="ml-auto shrink-0 font-medium text-foreground">
              Disponible : {formatFCFA(dispo)}
            </span>
          </p>

          <div>
            <label htmlFor="montant-transfert" className="text-sm font-medium">
              Montant (FCFA)
            </label>
            <input
              id="montant-transfert"
              inputMode="numeric"
              value={montant}
              onChange={(ev) => setMontant(ev.target.value.replace(/[^\d]/g, ""))}
              placeholder="25000"
              className={champ}
            />
          </div>

          <div>
            <label htmlFor="note-transfert" className="text-sm font-medium">
              Note (facultatif)
            </label>
            <input
              id="note-transfert"
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Retrait vers espèces"
              className={champ}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
          >
            Transférer
          </button>
        </form>
      </section>

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
                        type: "suppression",
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
        titre={danger ? "Supprimer ce transfert ?" : "Confirmer le transfert"}
        message={
          demande?.type === "transfert"
            ? `Transférer ${formatFCFA(demande.montant)} de ${demande.source} vers ${demande.destination} ?`
            : demande?.type === "suppression"
              ? `Le transfert ${demande.libelle} sera supprimé et les soldes recalculés.`
              : ""
        }
        confirmerLabel={danger ? "Supprimer" : "Confirmer"}
        danger={danger}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
