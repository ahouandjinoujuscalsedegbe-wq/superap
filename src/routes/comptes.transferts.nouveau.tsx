import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";

export const Route = createFileRoute("/comptes/transferts/nouveau")({
  head: () => ({
    meta: [
      { title: "Nouveau transfert — SUPER APP" },
      {
        name: "description",
        content:
          "Transférez des francs CFA d'un compte du foyer vers un autre en quatre questions.",
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

type Demande = {
  source: string;
  destination: string;
  montant: number;
  note: string;
  frais: number;
  fraisSur: "source" | "destination";
} | null;

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function NouveauTransfert() {
  const { comptes, soldesParCompte, ajouterTransfert } = useSuperApp();
  const navigate = useNavigate();

  const [source, setSource] = useState(comptes[0] ?? "");
  const [destination, setDestination] = useState(comptes[1] ?? "");
  const [montant, setMontant] = useState("");
  const [frais, setFrais] = useState("");
  const [fraisSur, setFraisSur] = useState<"source" | "destination">("source");
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
    const fraisValeur = Number(frais.replace(/\s/g, "")) || 0;
    if (!Number.isFinite(fraisValeur) || fraisValeur < 0) {
      setErreur("Frais invalides : entrez un nombre de FCFA égal ou supérieur à zéro.");
      return;
    }
    const sortieSource = valeur + (fraisSur === "source" ? fraisValeur : 0);
    if (sortieSource > dispo) {
      setErreur(
        `Solde insuffisant sur ${source} : ${formatFCFA(dispo)} disponibles pour ${formatFCFA(sortieSource)} (frais compris).`,
      );
      return;
    }
    if (fraisSur === "destination" && fraisValeur >= valeur) {
      setErreur("Les frais ne peuvent pas dépasser le montant reçu par le compte destinataire.");
      return;
    }
    setDemande({
      source,
      destination,
      montant: valeur,
      note: note.trim(),
      frais: fraisValeur,
      fraisSur,
    });
  }

  function confirmer() {
    if (!demande) return;
    ajouterTransfert({
      source: demande.source,
      destination: demande.destination,
      montant: demande.montant,
      note: demande.note,
      date: new Date().toISOString(),
      ...(demande.frais > 0 ? { frais: demande.frais, fraisSur: demande.fraisSur } : {}),
    });
    setDemande(null);
    toast.success("Transfert enregistré.");
    void navigate({ to: "/comptes/transferts" });
  }

  return (
    <div className="page-anim space-y-5">
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
                value={grouperMontant(montant)}
                onChange={(ev) => setMontant(ev.target.value.replace(/[^\d]/g, ""))}
                placeholder="25000"
                className={champ}
              />
            </div>

            <div>
              <label htmlFor="frais-transfert" className="text-sm font-medium">
                4. Frais de transaction supportés (FCFA)
              </label>
              <input
                id="frais-transfert"
                inputMode="numeric"
                value={grouperMontant(frais)}
                onChange={(ev) => setFrais(ev.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className={champ}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Laissez 0 si cette transaction n'a coûté aucun frais.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { id: "source", label: "Frais retirés du compte qui envoie" },
                    { id: "destination", label: "Frais retenus sur le montant reçu" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={fraisSur === o.id}
                    onClick={() => setFraisSur(o.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      fraisSur === o.id
                        ? "border-primary bg-accent font-semibold text-accent-foreground"
                        : "border-input bg-card text-muted-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                Sortie réelle de {source || "—"} :{" "}
                <span className="font-semibold text-foreground">
                  {formatFCFA(
                    (Number(montant) || 0) +
                      (fraisSur === "source" ? Number(frais.replace(/\s/g, "")) || 0 : 0),
                  )}
                </span>{" "}
                · Reçu réel sur {destination || "—"} :{" "}
                <span className="font-semibold text-foreground">
                  {formatFCFA(
                    Math.max(
                      0,
                      (Number(montant) || 0) -
                        (fraisSur === "destination" ? Number(frais.replace(/\s/g, "")) || 0 : 0),
                    ),
                  )}
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="note-transfert" className="text-sm font-medium">
                5. Pourquoi ce transfert ? (facultatif)
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
