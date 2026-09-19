import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, Repeat } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { suggererOperation, type SuggestionOperation } from "@/lib/ia-operation";

export const Route = createFileRoute("/decrire")({
  head: () => ({
    meta: [
      { title: "Décrire une opération — SUPER APP" },
      {
        name: "description",
        content:
          "Écrivez votre opération en une phrase : l'application propose l'enveloppe, le compte et le type de mouvement en FCFA.",
      },
      { property: "og:title", content: "Décrire une opération en une phrase" },
      {
        property: "og:description",
        content:
          "Une phrase libre suffit : l'assistant reconnaît la dépense, le revenu ou le transfert, puis propose l'enveloppe et le compte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageDecrire,
});

function PageDecrire() {
  const { enveloppes, comptes, sourcesRevenu, transactions, ajouterTransaction } = useSuperApp();
  const navigate = useNavigate();

  const [texte, setTexte] = useState("");
  const [analyse, setAnalyse] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionOperation | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);

  // Champs modifiables issus de la proposition.
  const [type, setType] = useState<"depense" | "revenu">("depense");
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [enveloppe, setEnveloppe] = useState("");
  const [compte, setCompte] = useState("");
  const [source, setSource] = useState("");

  const valeur = Number(montant.replace(/\s/g, "")) || 0;

  async function analyser() {
    if (texte.trim().length < 3) {
      toast.error("Décrivez l'opération en quelques mots.");
      return;
    }
    setAnalyse(true);
    setAvertissement(null);
    try {
      const { suggestion: s, avertissement: a } = await suggererOperation(
        texte,
        enveloppes,
        comptes,
        sourcesRevenu,
        transactions,
      );
      setSuggestion(s);
      setAvertissement(a ?? null);
      setType(s.type === "revenu" ? "revenu" : "depense");
      setMontant(s.montant ? grouperMontant(String(s.montant)) : "");
      setLibelle(s.libelle);
      setEnveloppe(s.enveloppe ?? "");
      setCompte(s.compte ?? comptes[0] ?? "");
      setSource(s.source ?? sourcesRevenu[0] ?? "");
    } finally {
      setAnalyse(false);
    }
  }

  function enregistrer() {
    if (valeur <= 0) {
      toast.error("Indiquez le montant en FCFA.");
      return;
    }
    if (!compte) {
      toast.error("Choisissez le compte concerné.");
      return;
    }
    if (type === "depense" && !enveloppe) {
      toast.error("Choisissez l'enveloppe de la dépense.");
      return;
    }
    ajouterTransaction({
      type,
      montant: valeur,
      libelle: libelle.trim() || (type === "revenu" ? source : "Dépense"),
      categorie: type === "depense" ? enveloppe : source,
      compte,
      date: new Date().toISOString(),
    });
    toast.success(
      `${type === "revenu" ? "Revenu" : "Dépense"} de ${formatFCFA(valeur)} enregistré${type === "revenu" ? "" : "e"}.`,
    );
    void navigate({ to: "/" });
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="size-5 text-primary" /> Décrire une opération
        </h1>
        <p className="text-xs text-muted-foreground">
          Écrivez simplement, par exemple : « j&apos;ai payé 2500 de zem hier » ou « salaire de
          150000 reçu sur Mobile Money ». Seule votre phrase et les noms de vos enveloppes et
          comptes sont utilisés pour la proposition ; vos montants et soldes restent sur le
          téléphone.
        </p>
      </header>

      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="d-texte">
          Votre phrase
        </label>
        <textarea
          id="d-texte"
          rows={3}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Ex. : acheté du riz et de l'huile au marché pour 7 500 FCFA"
          className="w-full rounded-lg border border-input bg-background p-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void analyser()}
          disabled={analyse}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {analyse ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {analyse ? "Analyse en cours…" : "Analyser ma phrase"}
        </button>
      </div>

      {avertissement && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          {avertissement}
        </p>
      )}

      {suggestion && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs leading-relaxed">
            <span className="font-semibold">Proposition</span> ({suggestion.confiance} % de
            confiance,{" "}
            {suggestion.origine === "modele" ? "assistant en ligne" : "calcul sur le téléphone"})
            {" — "}
            {suggestion.raison}
          </p>

          {suggestion.type === "transfert" ? (
            <Link
              to="/comptes/transferts/nouveau"
              className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold"
            >
              <Repeat className="size-4" /> Cela ressemble à un transfert : ouvrir la page
              Transferts
            </Link>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 text-xs font-semibold text-muted-foreground">
              Type de mouvement
              <select
                value={type}
                data-clavier="off"
                onChange={(e) => setType(e.target.value as "depense" | "revenu")}
                className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
              >
                <option value="depense">Dépense</option>
                <option value="revenu">Revenu</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-muted-foreground">
              Montant (FCFA)
              <input
                inputMode="numeric"
                value={montant}
                onChange={(e) => setMontant(grouperMontant(e.target.value))}
                className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-semibold text-muted-foreground">
              Libellé
              <input
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
              />
            </label>

            {type === "depense" ? (
              <label className="col-span-2 text-xs font-semibold text-muted-foreground">
                Enveloppe
                <select
                  value={enveloppe}
                  data-clavier="off"
                  onChange={(e) => setEnveloppe(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
                >
                  <option value="">— Choisir —</option>
                  {enveloppes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.emoji} {e.nom}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="col-span-2 text-xs font-semibold text-muted-foreground">
                Source du revenu
                <select
                  value={source}
                  data-clavier="off"
                  onChange={(e) => setSource(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
                >
                  <option value="">— Choisir —</option>
                  {sourcesRevenu.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="col-span-2 text-xs font-semibold text-muted-foreground">
              Compte
              <select
                value={compte}
                data-clavier="off"
                onChange={(e) => setCompte(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal"
              >
                <option value="">— Choisir —</option>
                {comptes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={enregistrer}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-success-foreground"
          >
            <Check className="size-4" /> Enregistrer cette opération
          </button>
        </div>
      )}
    </div>
  );
}
