import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarRange,
  LineChart,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { resteDu, useSuperApp } from "@/lib/store";
import { formatDateFr, formatFCFA } from "@/lib/format";
import { etatEnveloppe } from "@/lib/enveloppe-etat";
import { alertesLocales } from "@/lib/analyste-local";

import logoSuperAppAsset from "@/assets/logo-super-app.png.asset.json";
const logoSuperApp = logoSuperAppAsset.url;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Accueil — SUPER APP, budget du foyer en FCFA" },
      {
        name: "description",
        content:
          "Suivez le solde du foyer, les revenus et les dépenses du mois en francs CFA, hors ligne et en français.",
      },
      { property: "og:title", content: "Accueil — SUPER APP" },
      {
        property: "og:description",
        content: "Solde du foyer, revenus et dépenses du mois en francs CFA.",
      },
    ],
  }),
  component: Accueil,
});

function Accueil() {
  const {
    solde,
    totalRevenus,
    totalDepenses,
    transactions,
    budgets,
    dettes,
    enveloppes,
    depensesParEnveloppe,
    nomUtilisateur,
    chargement,
  } = useSuperApp();
  const dernieres = transactions.slice(0, 8);

  const aujourdHui = new Date().toISOString().slice(0, 10);
  const dansSeptJours = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Rappels : échéances planifiées à venir, dettes échues et enveloppes en zone rouge.
  const echeancesProches = budgets
    .filter((b) => b.actif && b.prochaine.slice(0, 10) <= dansSeptJours)
    .sort((a, b) => a.prochaine.localeCompare(b.prochaine))
    .slice(0, 3);
  const dettesEchues = dettes.filter(
    (d) => d.dateLimite && d.dateLimite <= aujourdHui && resteDu(d) > 0,
  );
  const enveloppesRouges = enveloppes.filter(
    (e) => etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0).plafondAtteint,
  );
  const rappels = echeancesProches.length + dettesEchues.length + enveloppesRouges.length;

  // Analyse locale : prévision d'épuisement des enveloppes et dépenses inhabituelles.
  const alertesIntelligentes = useMemo(
    () => alertesLocales(enveloppes, transactions),
    [enveloppes, transactions],
  );



  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pr-12">
        <img
          src={logoSuperApp}
          alt="Logo SUPER APP"
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl object-cover shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Bonjour 👋</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue{nomUtilisateur ? ` ${nomUtilisateur}` : ""}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/planning"
            aria-label="Planning 14 semaines"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-transform hover:bg-accent/60 active:scale-95"
          >
            <CalendarRange className="h-5 w-5" aria-hidden />
          </Link>
          <Link
            to="/analyses"
            aria-label="Analyses et Conseils"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-transform hover:bg-accent/60 active:scale-95"
          >
            <LineChart className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>




      <section className="carte p-5">
        <p className="text-sm text-muted-foreground">
          {chargement ? "Ouverture du coffre chiffré…" : "Solde disponible"}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-primary">
          {chargement ? "—" : formatFCFA(solde)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success/15 p-3">
            <span className="flex items-center gap-1.5 text-xs text-success/80">
              <ArrowUpRight className="h-4 w-4" aria-hidden /> Revenus
            </span>
            <p className="mt-1 font-semibold text-success">{formatFCFA(totalRevenus)}</p>
          </div>
          <div className="rounded-xl bg-destructive/15 p-3">
            <span className="flex items-center gap-1.5 text-xs text-destructive/80">
              <ArrowDownRight className="h-4 w-4" aria-hidden /> Dépenses
            </span>
            <p className="mt-1 font-semibold text-destructive">{formatFCFA(totalDepenses)}</p>
          </div>
        </div>
      </section>




      {rappels > 0 && (
        <section className="carte space-y-2 border-destructive/30 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
            Rappels ({rappels})
          </h2>
          <ul className="space-y-1.5 text-sm">
            {echeancesProches.map((b) => (
              <li key={b.id} className="flex justify-between gap-2">
                <Link
                  to="/enveloppes/budgetisation"
                  className="truncate underline-offset-2 hover:underline"
                >
                  {b.libelle} · {formatDateFr(b.prochaine)}
                </Link>
                <span className="shrink-0 font-semibold">{formatFCFA(b.montant)}</span>
              </li>
            ))}
            {dettesEchues.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <Link to="/dettes" className="truncate underline-offset-2 hover:underline">
                  {d.sens === "dette" ? "À rembourser" : "À encaisser"} — {d.personne}
                </Link>
                <span className="shrink-0 font-semibold text-destructive">
                  {formatFCFA(resteDu(d))}
                </span>
              </li>
            ))}
            {enveloppesRouges.map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <Link
                  to="/enveloppes/details"
                  className="truncate underline-offset-2 hover:underline"
                >
                  {e.emoji} {e.nom} — plafond atteint
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {alertesIntelligentes.length > 0 && (
        <section className="carte space-y-2 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Analyse intelligente
          </h2>
          <p className="text-xs text-muted-foreground">
            Calculée sur votre téléphone, sans aucune connexion.
          </p>
          <ul className="space-y-1.5 text-sm">
            {alertesIntelligentes.map((a) => (
              <li key={a.id} className="rounded-lg bg-muted/50 px-3 py-2">
                <span
                  className={
                    a.niveau === "alerte"
                      ? "font-semibold text-destructive"
                      : a.niveau === "attention"
                        ? "font-semibold text-warning"
                        : "font-semibold"
                  }
                >
                  {a.titre}
                </span>
                <span className="block text-xs text-muted-foreground">{a.texte}</span>
              </li>
            ))}
          </ul>
        </section>
      )}



      <section className="grid grid-cols-2 gap-3">
        <Link
          to="/revenu"
          className="carte flex flex-col gap-1 bg-success/15 p-4 text-left text-success transition-transform active:scale-[0.98]"
        >
          <ArrowUpRight className="h-5 w-5" aria-hidden />
          <span className="font-semibold">Ajouter un revenu</span>
          <span className="text-xs text-success/80">Salaire, activité, aide…</span>
        </Link>
        <Link
          to="/depense"
          className="carte flex flex-col gap-1 bg-destructive/15 p-4 text-left text-destructive transition-transform active:scale-[0.98]"
        >
          <ArrowDownRight className="h-5 w-5" aria-hidden />
          <span className="font-semibold">Ajouter une dépense</span>
          <span className="text-xs text-destructive/80">En 2 secondes</span>
        </Link>
      </section>

      <section className="carte p-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Dernières opérations</h2>
        {chargement ? (
          <div className="mt-3 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : dernieres.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Wallet className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucune opération enregistrée pour le moment.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {dernieres.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.compte} · {formatDateFr(t.date)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    t.type === "revenu" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "revenu" ? "+" : "−"} {formatFCFA(t.montant)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
