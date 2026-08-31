import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/BoutonRetour";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import {
  construireRapport,
  libelleMois,
  moisDisponibles,
  rapportEnTexte,
} from "@/lib/rapport-mensuel";

export const Route = createFileRoute("/rapport")({
  head: () => ({
    meta: [
      { title: "Rapport mensuel automatique — SUPER APP" },
      {
        name: "description",
        content:
          "Bilan complet du mois : revenus, dépenses, taux d'épargne, enveloppes dépassées, fuites d'argent et conseils, calculés hors ligne.",
      },
      { property: "og:title", content: "Rapport mensuel automatique" },
      {
        property: "og:description",
        content: "Le bilan du mois de votre foyer, calculé sur votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageRapport,
});

function PageRapport() {
  const { transactions, enveloppes, dettes } = useSuperApp();
  const mois = useMemo(() => moisDisponibles(transactions), [transactions]);
  const [choisi, setChoisi] = useState<string>(
    () => mois[0] ?? new Date().toISOString().slice(0, 7),
  );

  const rapport = useMemo(
    () => construireRapport(choisi, { transactions, enveloppes, dettes }),
    [choisi, transactions, enveloppes, dettes],
  );

  const partager = async () => {
    const texte = rapportEnTexte(rapport);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(texte);
        toast.success("Rapport copié : collez-le où vous voulez.");
        return;
      }
    } catch {
      /* copie indisponible */
    }
    toast.error("Copie impossible sur cet appareil.");
  };

  return (
    <div className="space-y-4 pt-4">
      <BoutonRetour to="/" label="Accueil" />

      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-primary" aria-hidden />
            Rapport mensuel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bilan automatique de {libelleMois(rapport.mois)}.
          </p>
        </div>
        <button
          type="button"
          onClick={partager}
          aria-label="Copier le rapport"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary"
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {mois.length > 1 && (
        <label className="block text-xs font-medium text-muted-foreground">
          Mois analysé
          <select
            value={choisi}
            onChange={(e) => setChoisi(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {mois.map((m) => (
              <option key={m} value={m}>
                {libelleMois(m)}
              </option>
            ))}
          </select>
        </label>
      )}

      <section className="carte space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-success/15 p-3">
            <p className="text-xs text-success/80">Revenus</p>
            <p className="mt-1 text-sm font-semibold text-success">
              {formatFCFA(rapport.revenus)}
            </p>
          </div>
          <div className="rounded-xl bg-destructive/15 p-3">
            <p className="text-xs text-destructive/80">Dépenses</p>
            <p className="mt-1 text-sm font-semibold text-destructive">
              {formatFCFA(rapport.depenses)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs text-muted-foreground">Reste</p>
            <p className="mt-1 text-sm font-semibold">{formatFCFA(rapport.net)}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Taux d'épargne : <span className="font-semibold text-foreground">
            {rapport.tauxEpargne.toFixed(0)} %
          </span>{" "}
          · {rapport.nbOperations} opérations · dépenses{" "}
          {rapport.variationDepenses >= 0 ? "+" : ""}
          {rapport.variationDepenses.toFixed(0)} % vs mois précédent
        </p>
        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={rapport.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Note du mois"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${rapport.score}%` }} />
          </div>
          <span className="text-sm font-semibold">{rapport.score}/100</span>
        </div>
      </section>

      {rapport.enveloppes.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="text-sm font-semibold">Enveloppes du mois</h2>
          <ul className="space-y-1.5 text-sm">
            {rapport.enveloppes.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {e.emoji} {e.nom}
                </span>
                <span className={e.depassee ? "font-semibold text-destructive" : "font-medium"}>
                  {formatFCFA(e.depense)} / {formatFCFA(e.dotation)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rapport.plusGrossesDepenses.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="text-sm font-semibold">Plus grosses dépenses</h2>
          <ul className="space-y-1.5 text-sm">
            {rapport.plusGrossesDepenses.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate">{t.libelle}</span>
                <span className="shrink-0 font-semibold text-destructive">
                  {formatFCFA(t.montant)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rapport.fuites.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="text-sm font-semibold">Dépenses répétées</h2>
          <ul className="space-y-1.5 text-sm">
            {rapport.fuites.map((f) => (
              <li key={f.libelle} className="flex justify-between gap-2">
                <span className="truncate">
                  {f.libelle} <span className="text-muted-foreground">×{f.occurrences}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatFCFA(f.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(rapport.detteRestante > 0 || rapport.creanceRestante > 0) && (
        <section className="carte space-y-1.5 p-4 text-sm">
          <h2 className="text-sm font-semibold">Dettes et créances</h2>
          <p className="text-muted-foreground">
            À rembourser :{" "}
            <span className="font-semibold text-destructive">
              {formatFCFA(rapport.detteRestante)}
            </span>{" "}
            · à encaisser :{" "}
            <span className="font-semibold text-success">
              {formatFCFA(rapport.creanceRestante)}
            </span>
          </p>
        </section>
      )}

      {rapport.conseils.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="text-sm font-semibold">Conseils</h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {rapport.conseils.map((c, i) => (
              <li key={i} className="rounded-lg bg-muted/50 px-3 py-2">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
