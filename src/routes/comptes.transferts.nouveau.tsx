import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { BoutonRetour } from "@/components/BoutonRetour";
import { ErreurPopup } from "@/components/ErreurPopup";

export const Route = createFileRoute("/comptes/transferts/nouveau")({
  head: () => ({
    meta: [
      { title: "Nouveau transfert — SUPER APP" },
      {
        name: "description",
        content: "Transférez des francs CFA d'un compte du foyer vers un autre en quatre questions.",
      },
      { property: "og:title", content: "Nouveau transfert entre comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Transfert interne en FCFA guidé, avec contrôle du solde.",
      },
    ],
  }),
  component: NouveauTransfert,
});

type Demande = { source: string; destination: string; montant: number; note: string } | null;

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function NouveauTransfert() {
  const { comptes, soldesParCompte, ajouterTransfert } = useSuperApp();
  const navigate = useNavigate();

  const [source, setSource] = useState(comptes[0] ?? "");
  const [destination, setDestination] = useState(comptes[1] ?? "");
  const [montant, setMontant] = useState("");
  const [note, setNote] = useState("");
  const [demande, setDemande] = useState<Demande>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const dispo = soldesParCompte[source] ?? 0;

  function choisirSource(valeur: string) {
    setSource(valeur);
    if (valeur === destination) {
      setDestination(comptes.find((c) => c !== valeur) ?? "");
    }
  }

  function choisirDestination(valeur: string) {
    setDestination(valeur);
    if (valeur === source) {
      setSource(comptes.find((c) => c !== valeur) ?? "");
    }
  }

  function envoyer(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(montant);
    if (!source || !destination) {
      setErreur("Choisissez les deux comptes concernés par le transfert.");
      return;
    }
    if (source === destination) {
      setErreur("Le compte d'origine et le compte destinataire doivent être différents.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0 || !Number.isInteger(valeur)) {
      setErreur("Montant invalide : entrez un nombre entier de FCFA supérieur à zéro.");
      return;
    }
    if (valeur > dispo) {
      setErreur(`Solde insuffisant sur ${source} : ${formatFCFA(dispo)} disponibles.`);
      return;
    }
    setDemande({ source, destination, montant: valeur, note: note.trim() });
  }

  function confirmer() {
    if (!demande) return;
    ajouterTransfert({
      source: demande.source,
      destination: demande.destination,
      montant: demande.montant,
      note: demande.note,
      date: new Date().toISOString(),
    });
    setDemande(null);
    toast.success("Transfert enregistré.");
    void navigate({ to: "/comptes/transferts" });
  }

  return (
    <div className="page-anim space-y-5">
      <BoutonRetour to="/comptes/transferts" label="Retour aux transferts" />

      <section className="carte space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ArrowLeftRight className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Nouveau transfert</h2>
            <p className="text-sm text-muted-foreground">
              Répondez aux quatre questions ci-dessous pour déplacer l'argent.
            </p>
          </div>
        </div>

        {comptes.length < 2 ? (
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
            Créez au moins deux comptes avant d'effectuer un transfert.
          </p>
        ) : (
          <form onSubmit={envoyer} className="space-y-4">
            <div>
              <label htmlFor="source" className="text-sm font-medium">
                1. D'où part l'argent ?
              </label>
              <select
                id="source"
                value={source}
                onChange={(ev) => choisirSource(ev.target.value)}
                className={champ}
              >
                {comptes.map((c) => (
                  <option key={c} value={c}>
                    {c} — {formatFCFA(soldesParCompte[c] ?? 0)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="destination" className="text-sm font-medium">
                2. Vers quel compte va-t-il ?
              </label>
              <select
                id="destination"
                value={destination}
                onChange={(ev) => choisirDestination(ev.target.value)}
                className={champ}
              >
                {comptes
                  .filter((c) => c !== source)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c} — {formatFCFA(soldesParCompte[c] ?? 0)}
                    </option>
                  ))}
              </select>
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
                3. Quel montant souhaitez-vous transférer (FCFA) ?
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
                4. Pourquoi ce transfert ? (facultatif)
              </label>
              <input
                id="note-transfert"
                value={note}
                onChange={(ev) => setNote(ev.target.value)}
                placeholder="Retrait vers espèces"
                className={champ}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
              >
                Transférer
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: "/comptes/transferts" })}
                className="rounded-xl border border-input px-4 py-3 font-medium transition-colors hover:bg-secondary"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </section>

      <ErreurPopup
        ouvert={erreur !== null}
        message={erreur ?? ""}
        onFermer={() => setErreur(null)}
      />

      <Confirmation
        ouvert={demande !== null}
        titre="Confirmer le transfert"
        message={
          demande
            ? `Transférer ${formatFCFA(demande.montant)} de ${demande.source} vers ${demande.destination} ?`
            : ""
        }
        confirmerLabel="Confirmer"
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
