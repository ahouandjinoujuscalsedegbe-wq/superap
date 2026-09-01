import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { COMPTES, useSuperApp } from "@/lib/store";
import { apprendreIcone } from "@/lib/icone-auto";
import { formatFCFA } from "@/lib/format";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { operationsFrequentes } from "@/lib/favoris";
import { DicteeOperation } from "@/components/DicteeOperation";

export const Route = createFileRoute("/depense")({
  head: () => ({
    meta: [
      { title: "Ajouter une dépense — Saisie rapide en FCFA" },
      {
        name: "description",
        content:
          "Saisissez une dépense du foyer en moins de trois secondes : montant, enveloppe et compte, en francs CFA.",
      },
      { property: "og:title", content: "Ajouter une dépense — SUPER APP" },
      {
        property: "og:description",
        content: "Saisie rapide des dépenses du foyer par enveloppe, en francs CFA.",
      },
    ],
  }),
  component: AjouterDepense,
});

const MONTANTS_RAPIDES = [500, 1000, 2000, 5000, 10000];

function AjouterDepense() {
  const { ajouterTransaction, enveloppes, comptes, depensesParEnveloppe, transactions, membres } =
    useSuperApp();
  const navigate = useNavigate();
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [enveloppe, setEnveloppe] = useState<string>(enveloppes[0]?.id ?? "vitaux");
  const [recherche, setRecherche] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [membre, setMembre] = useState("");

  const enveloppeChoisie = useMemo(
    () => enveloppes.find((e) => e.id === enveloppe),
    [enveloppes, enveloppe],
  );

  // Le compte est déduit de l'enveloppe : chaque enveloppe est rattachée à un compte source.
  const compte =
    enveloppeChoisie?.compteSource && comptes.includes(enveloppeChoisie.compteSource)
      ? enveloppeChoisie.compteSource
      : (comptes[0] ?? COMPTES[0]);

  // Regroupement par catégorie + recherche : liste lisible même avec beaucoup d'enveloppes.
  const groupes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtrees = q
      ? enveloppes.filter((e) =>
          `${e.nom} ${e.categorie ?? ""} ${e.sousCategorie ?? ""}`.toLowerCase().includes(q),
        )
      : enveloppes;
    const map = new Map<string, typeof enveloppes>();
    for (const e of filtrees) {
      const cle = e.categorie?.trim() || "Sans catégorie";
      map.set(cle, [...(map.get(cle) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [enveloppes, recherche]);

  // Opérations répétées repérées localement : ressaisie en un seul appui.
  const favoris = useMemo(
    () => operationsFrequentes(transactions, { type: "depense", maximum: 4 }),
    [transactions],
  );

  const valeur = Number(montant.replace(/\s/g, "")) || 0;


  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (valeur <= 0) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    const env = enveloppes.find((x) => x.id === enveloppe);
    ajouterTransaction({
      type: "depense",
      montant: valeur,
      libelle: libelle.trim() || (env?.nom ?? "Dépense"),
      categorie: enveloppe,
      compte,
      date: new Date(date).toISOString(),
      ...(membre ? { membre } : {}),
    });
    // L'IA locale apprend le lien libellé → icône à partir des dépenses validées.
    if (env && libelle.trim()) apprendreIcone(libelle, env.emoji);
    toast.success(`Dépense de ${formatFCFA(valeur)} enregistrée.`);
    if (env) {
      const apres = etatEnveloppe(env, (depensesParEnveloppe[env.id] ?? 0) + valeur);
      if (apres.epuisee) {
        toast.error(
          `Enveloppe « ${env.nom} » épuisée : la somme attribuée et la réserve sont entièrement consommées.`,
        );
      } else if (apres.plafondAtteint) {
        toast.warning(
          `Zone rouge : le plafond de ${formatFCFA(env.plafond)} de « ${env.nom} » est atteint. Vous puisez maintenant dans la réserve (${formatFCFA(apres.reserveDisponible)} disponibles).`,
        );
      }
    }
    navigate({ to: "/" });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter une dépense</h1>
        <p className="text-sm text-muted-foreground">Sortie d'argent du foyer</p>
      </header>

      <DicteeOperation
        type="depense"
        onResultat={(r) => {
          if (r.montant > 0) setMontant(String(Math.round(r.montant)));
          if (r.libelle) setLibelle(r.libelle);
          if (r.date) setDate(r.date);
          if (r.enveloppe && enveloppes.some((e) => e.id === r.enveloppe)) setEnveloppe(r.enveloppe);
        }}
      />

      {favoris.length > 0 && (
        <section className="carte space-y-2 p-4">
          <p className="text-sm font-medium">Dépenses habituelles</p>
          <div className="flex flex-wrap gap-2">
            {favoris.map((f) => (
              <button
                key={f.cle}
                type="button"
                onClick={() => {
                  setMontant(String(f.montant));
                  setLibelle(f.libelle);
                  if (enveloppes.some((e) => e.id === f.categorie)) setEnveloppe(f.categorie);
                  if (comptes.includes(f.compte)) setCompte(f.compte);
                }}
                className="rounded-full border border-input bg-card px-3 py-1.5 text-xs"
              >
                {f.libelle} · {formatFCFA(f.montant)}
              </button>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={enregistrer} className="space-y-4">
        <section className="carte p-4">
          <label htmlFor="montant" className="text-sm font-medium">
            Montant (FCFA)
          </label>
          <input
            id="montant"
            inputMode="numeric"
            value={montant}
            onChange={(ev) => setMontant(ev.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="mt-2 w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-2xl font-bold text-destructive outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {MONTANTS_RAPIDES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMontant(String((Number(montant.replace(/[^\d]/g, "")) || 0) + m))}
                aria-label={`Ajouter ${formatFCFA(m)} au montant`}
                className="min-h-11 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
              >
                +{formatFCFA(m)}
              </button>
            ))}
          </div>
        </section>

        <section className="carte space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Enveloppe</p>
            <span className="truncate text-xs text-muted-foreground">
              {enveloppes.length} disponibles
            </span>
          </div>

          <input
            value={recherche}
            onChange={(ev) => setRecherche(ev.target.value)}
            placeholder="Rechercher une enveloppe…"
            aria-label="Rechercher une enveloppe"
            className="w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          {enveloppeChoisie && (
            <div className="flex items-center gap-2 rounded-xl border border-primary bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground">
              <span aria-hidden className="text-base">
                {enveloppeChoisie.emoji}
              </span>
              <span className="truncate">{enveloppeChoisie.nom}</span>
            </div>
          )}

          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {groupes.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune enveloppe ne correspond.</p>
            )}
            {groupes.map(([categorie, liste]) => (
              <details key={categorie} open={liste.some((e) => e.id === enveloppe) || !!recherche}>
                <summary className="cursor-pointer list-none rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">
                  {categorie} · {liste.length}
                </summary>
                <div className="mt-2 grid gap-2">
                  {liste.map((e) => {
                    const actif = e.id === enveloppe;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={actif}
                        onClick={() => setEnveloppe(e.id)}
                        className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                          actif
                            ? "border-primary bg-accent font-semibold text-accent-foreground"
                            : "border-input bg-background/60 text-muted-foreground"
                        }`}
                      >
                        <span aria-hidden className="shrink-0 text-base">
                          {e.emoji}
                        </span>
                        <span className="truncate">{e.nom}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {e.compteSource ?? ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>

          <p className="rounded-xl bg-secondary px-3 py-2.5 text-xs text-secondary-foreground">
            Compte débité automatiquement : <strong>{compte}</strong>
          </p>
        </section>


        {membres.length > 0 && (
          <section className="carte p-4">
            <p className="text-sm font-medium">Qui a fait cette dépense ?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["", ...membres].map((m) => (
                <button
                  key={m || "aucun"}
                  type="button"
                  aria-pressed={membre === m}
                  onClick={() => setMembre(m)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    membre === m
                      ? "border-primary bg-accent font-semibold text-accent-foreground"
                      : "border-input bg-card text-muted-foreground"
                  }`}
                >
                  {m || "Non précisé"}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="carte space-y-4 p-4">


          <div>
            <label htmlFor="libelle" className="text-sm font-medium">
              Libellé (facultatif)
            </label>
            <input
              id="libelle"
              value={libelle}
              onChange={(ev) => setLibelle(ev.target.value)}
              placeholder="Pain, taxi, recharge téléphonique…"
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(ev) => setDate(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>

        <button
          type="submit"
          className="w-full rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          Enregistrer la dépense
        </button>
      </form>
    </div>
  );
}
