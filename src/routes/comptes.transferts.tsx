import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeftRight, X } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { Confirmation } from "@/components/Confirmation";
import { BoutonRetour } from "@/components/BoutonRetour";
import { ErreurPopup } from "@/components/ErreurPopup";

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

  const [popupOuvert, setPopupOuvert] = useState(false);
  const [source, setSource] = useState(comptes[0] ?? "");
  const [destination, setDestination] = useState(comptes[1] ?? "");
  const [montant, setMontant] = useState("");
  const [note, setNote] = useState("");
  const [demande, setDemande] = useState<Demande>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const dispo = soldesParCompte[source] ?? 0;

  useEffect(() => {
    if (!popupOuvert) return;
    function surTouche(ev: KeyboardEvent) {
      if (ev.key === "Escape") setPopupOuvert(false);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [popupOuvert]);

  function ouvrirPopup() {
    if (comptes.length < 2) {
      setErreur("Créez au moins deux comptes avant d'effectuer un transfert.");
      return;
    }
    setSource(comptes[0] ?? "");
    setDestination(comptes[1] ?? "");
    setMontant("");
    setNote("");
    setPopupOuvert(true);
  }

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
      setPopupOuvert(false);
      toast.success("Transfert enregistré.");
    } else {
      supprimerTransfert(demande.id);
      toast.success("Transfert supprimé.");
    }
    setDemande(null);
  }

  const danger = demande?.type === "suppression";

  return (
    <div className="page-anim space-y-5">
      <BoutonRetour to="/comptes/" label="Retour aux comptes" />

      <button
        type="button"
        onClick={ouvrirPopup}
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
      </button>

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

      {popupOuvert && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setPopupOuvert(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-transfert"
            className="carte popup-anim max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto p-5"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="titre-transfert" className="text-lg font-semibold">
                  Nouveau transfert
                </h2>
                <p className="text-sm text-muted-foreground">
                  Répondez aux quatre questions ci-dessous pour déplacer l'argent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopupOuvert(false)}
                aria-label="Fermer"
                className="rounded-full border border-input p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

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
                  onClick={() => setPopupOuvert(false)}
                  className="rounded-xl border border-input px-4 py-3 font-medium transition-colors hover:bg-secondary"
                >
                  Annuler
                </button>
              </div>
            </form>
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
