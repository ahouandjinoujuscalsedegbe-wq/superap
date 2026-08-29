import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";

export const Route = createFileRoute("/comptes")({
  head: () => ({
    meta: [
      { title: "Comptes — Soldes, actions et transferts en FCFA" },
      {
        name: "description",
        content:
          "Consultez le solde de chaque compte du foyer, ajoutez ou modifiez vos comptes et effectuez des transferts en francs CFA.",
      },
      { property: "og:title", content: "Comptes — SUPER APP" },
      {
        property: "og:description",
        content: "Soldes par compte, gestion des comptes et transferts internes en FCFA.",
      },
    ],
  }),
  component: Comptes,
});

const champ =
  "mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring";

function Comptes() {
  const {
    comptes,
    transactions,
    transferts,
    soldesParCompte,
    ajouterCompte,
    renommerCompte,
    supprimerCompte,
    ajouterTransfert,
    supprimerTransfert,
  } = useSuperApp();

  const [nouveauCompte, setNouveauCompte] = useState("");
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [nomEdite, setNomEdite] = useState("");

  const [source, setSource] = useState(comptes[0] ?? "");
  const [destination, setDestination] = useState(comptes[1] ?? "");
  const [montant, setMontant] = useState("");
  const [note, setNote] = useState("");

  const lignes = comptes.map((compte) => {
    const liees = transactions.filter((t) => t.compte === compte);
    const entrees = liees.filter((t) => t.type === "revenu").reduce((s, t) => s + t.montant, 0);
    const sorties = liees.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
    const recus = transferts
      .filter((t) => t.destination === compte)
      .reduce((s, t) => s + t.montant, 0);
    const envoyes = transferts
      .filter((t) => t.source === compte)
      .reduce((s, t) => s + t.montant, 0);
    return {
      compte,
      entrees: entrees + recus,
      sorties: sorties + envoyes,
      solde: soldesParCompte[compte] ?? 0,
      nb: liees.length,
    };
  });

  const total = lignes.reduce((s, l) => s + l.solde, 0);

  function creerCompte(ev: React.FormEvent) {
    ev.preventDefault();
    const nom = nouveauCompte.trim();
    if (!nom) { toast.error("Donnez un nom au compte."); return; }
    if (comptes.includes(nom)) { toast.error("Ce compte existe déjà."); return; }
    ajouterCompte(nom);
    setNouveauCompte("");
    toast.success(`Compte « ${nom} » ajouté.`);
  }

  function validerEdition(ancien: string) {
    const nom = nomEdite.trim();
    if (!nom) { toast.error("Le nom ne peut pas être vide."); return; }
    if (nom !== ancien && comptes.includes(nom)) { toast.error("Ce compte existe déjà."); return; }
    renommerCompte(ancien, nom);
    setEnEdition(null);
    toast.success("Compte modifié.");
  }

  function retirerCompte(nom: string) {
    if (transactions.some((t) => t.compte === nom)) {
      { toast.error("Ce compte contient des opérations."); return; }
    }
    if (transferts.some((t) => t.source === nom || t.destination === nom)) {
      { toast.error("Ce compte est lié à des transferts."); return; }
    }
    supprimerCompte(nom);
    toast.success("Compte supprimé.");
  }

  function faireTransfert(ev: React.FormEvent) {
    ev.preventDefault();
    const valeur = Number(montant);
    if (!Number.isFinite(valeur) || valeur <= 0) { toast.error("Montant invalide."); return; }
    if (!source || !destination) { toast.error("Choisissez les deux comptes."); return; }
    if (source === destination) { toast.error("Choisissez deux comptes différents."); return; }
    ajouterTransfert({
      source,
      destination,
      montant: valeur,
      note: note.trim(),
      date: new Date().toISOString(),
    });
    setMontant("");
    setNote("");
    toast.success("Transfert enregistré.");
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comptes</h1>
        <p className="text-sm text-muted-foreground">Répartition de votre argent par support.</p>
      </header>

      <section className="carte p-4">
        <p className="text-sm text-muted-foreground">Total disponible</p>
        <p className="mt-1 text-3xl font-bold text-primary">{formatFCFA(total)}</p>
      </section>

      <ul className="space-y-3">
        {lignes.map((l) => (
          <li key={l.compte} className="carte p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{l.compte}</span>
              <span className="font-bold">{formatFCFA(l.solde)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>
                + {formatFCFA(l.entrees)} · − {formatFCFA(l.sorties)}
              </span>
              <span>
                {l.nb} opération{l.nb > 1 ? "s" : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Action</h2>

        <form onSubmit={creerCompte} className="space-y-2">
          <label htmlFor="nouveau-compte" className="text-sm font-medium">
            Nouveau compte
          </label>
          <div className="flex gap-2">
            <input
              id="nouveau-compte"
              value={nouveauCompte}
              onChange={(ev) => setNouveauCompte(ev.target.value)}
              placeholder="Ex. Tontine du quartier"
              className={champ}
            />
            <button
              type="submit"
              className="mt-1.5 shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Ajouter
            </button>
          </div>
        </form>

        <ul className="space-y-2">
          {comptes.map((c) => (
            <li key={c} className="rounded-xl border border-border/70 p-3">
              {enEdition === c ? (
                <div className="flex gap-2">
                  <input
                    value={nomEdite}
                    onChange={(ev) => setNomEdite(ev.target.value)}
                    aria-label={`Nouveau nom pour ${c}`}
                    className={champ}
                  />
                  <button
                    type="button"
                    onClick={() => validerEdition(c)}
                    className="mt-1.5 shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnEdition(null)}
                    className="mt-1.5 shrink-0 rounded-xl border border-input px-3 py-2 text-sm"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{c}</span>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEnEdition(c);
                        setNomEdite(c);
                      }}
                      className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => retirerCompte(c)}
                      className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-destructive"
                    >
                      Supprimer
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="carte space-y-4 p-4">
        <h2 className="text-lg font-semibold">Transferts</h2>

        <form onSubmit={faireTransfert} className="space-y-3">
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
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground"
          >
            Transférer
          </button>
        </form>

        {transferts.length > 0 && (
          <ul className="space-y-2">
            {transferts.slice(0, 8).map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border/70 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t.source} → {t.destination}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateFr(t.date)}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{formatFCFA(t.montant)}</span>
                  <button
                    type="button"
                    onClick={() => supprimerTransfert(t.id)}
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
    </div>
  );
}
