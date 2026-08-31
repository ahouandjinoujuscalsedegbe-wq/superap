import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/BoutonRetour";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import {
  ecrireProjets,
  libelleMoisPrevu,
  lireProjets,
  projeter,
  type ProjetFutur,
} from "@/lib/previsions";

export const Route = createFileRoute("/previsions")({
  head: () => ({
    meta: [
      { title: "Prévisions mois par mois — Solde et dépenses à venir" },
      {
        name: "description",
        content:
          "Saisissez vos objectifs futurs et laissez l'application prédire votre solde et vos dépenses mois par mois, hors ligne et en FCFA.",
      },
      { property: "og:title", content: "Prévisions financières — SUPER APP" },
      {
        property: "og:description",
        content:
          "Projection du solde et des dépenses mois par mois à partir de vos habitudes et de vos projets futurs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagePrevisions,
});

const HORIZONS = [3, 6, 12, 24];

function moisSuivant(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 7);
}

function PagePrevisions() {
  const { transactions, enveloppes, objectifs, soldesParCompte } = useSuperApp();
  const [projets, setProjets] = useState<ProjetFutur[]>([]);
  const [horizon, setHorizon] = useState(12);
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [mois, setMois] = useState(moisSuivant());
  const [sens, setSens] = useState<"depense" | "revenu">("depense");
  const [recurrent, setRecurrent] = useState(false);

  useEffect(() => {
    let vivant = true;
    lireProjets().then((liste) => {
      if (vivant) setProjets(liste);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const soldeActuel = useMemo(
    () => Object.values(soldesParCompte).reduce((s, v) => s + v, 0),
    [soldesParCompte],
  );

  const previsions = useMemo(
    () =>
      projeter({
        transactions,
        enveloppes,
        objectifs,
        projets,
        soldeActuel,
        horizon,
      }),
    [transactions, enveloppes, objectifs, projets, soldeActuel, horizon],
  );

  const enregistrer = (liste: ProjetFutur[]) => {
    setProjets(liste);
    ecrireProjets(liste).catch(() => toast.error("Enregistrement impossible."));
  };

  const ajouter = () => {
    const valeur = Number(montant.replace(/\s/g, "").replace(",", "."));
    if (!libelle.trim()) {
      toast.error("Donnez un nom à votre objectif futur.");
      return;
    }
    if (!Number.isFinite(valeur) || valeur <= 0) {
      toast.error("Indiquez un montant valide en FCFA.");
      return;
    }
    enregistrer([
      ...projets,
      {
        id: crypto.randomUUID(),
        libelle: libelle.trim().toUpperCase(),
        montant: Math.round(valeur),
        mois,
        sens,
        recurrent,
      },
    ]);
    setLibelle("");
    setMontant("");
    toast.success("Objectif futur pris en compte dans la prévision.");
  };

  const supprimer = (id: string) => enregistrer(projets.filter((p) => p.id !== id));

  return (
    <div className="space-y-5">
      <BoutonRetour to="/" label="Retour à l'accueil" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Prévisions</h1>
        <p className="text-sm text-muted-foreground">
          Entrez vos objectifs futurs : l'application prédit votre solde et vos dépenses mois par
          mois, sur votre téléphone.
        </p>
      </header>

      <section className="surface space-y-3 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold">Nouvel objectif futur</h2>
        <input
          value={libelle}
          onChange={(e) => setLibelle(e.target.value.toUpperCase())}
          placeholder="EX. ACHAT MOTO, RENTRÉE SCOLAIRE…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            inputMode="numeric"
            placeholder="Montant FCFA"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["depense", "revenu"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSens(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sens === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {s === "depense" ? "Dépense à venir" : "Rentrée à venir"}
            </button>
          ))}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={recurrent}
              onChange={(e) => setRecurrent(e.target.checked)}
            />
            Chaque mois
          </label>
        </div>
        <button
          type="button"
          onClick={ajouter}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden /> Ajouter à la prévision
        </button>
      </section>

      {projets.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Objectifs enregistrés</h2>
          <ul className="space-y-2">
            {projets.map((p) => (
              <li
                key={p.id}
                className="surface flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {libelleMoisPrevu(p.mois)}
                    {p.recurrent ? " · chaque mois" : ""} ·{" "}
                    {p.sens === "revenu" ? "rentrée" : "dépense"}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    p.sens === "revenu" ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {formatFCFA(p.montant)}
                </span>
                <button
                  type="button"
                  onClick={() => supprimer(p.id)}
                  aria-label={`Supprimer ${p.libelle}`}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground active:scale-95"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {HORIZONS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              h === horizon ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {h} mois
          </button>
        ))}
      </div>

      <section className="surface space-y-2 rounded-2xl border border-border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Analyse locale</p>
        <p className="text-sm">{previsions.resume}</p>
        <div className="grid grid-cols-2 gap-3 pt-1 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Revenu moyen / mois</p>
            <p className="font-semibold text-emerald-600">
              {formatFCFA(previsions.revenuMoyen)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dépense moyenne / mois</p>
            <p className="font-semibold text-destructive">
              {formatFCFA(previsions.depenseMoyenne)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Mois par mois</h2>
        <ul className="space-y-2">
          {previsions.moisPrevus.map((m) => (
            <li
              key={m.mois}
              className={`surface space-y-2 rounded-2xl border p-3 ${
                m.niveau === "critique"
                  ? "border-destructive/60"
                  : m.niveau === "tendu"
                    ? "border-amber-500/60"
                    : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold capitalize">{m.libelle}</p>
                <span
                  className={`text-sm font-bold ${
                    m.soldeFin < 0 ? "text-destructive" : "text-emerald-600"
                  }`}
                >
                  {formatFCFA(m.soldeFin)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden /> {formatFCFA(m.revenus)}
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden /> {formatFCFA(m.depenses)}
                </span>
                <span className="text-muted-foreground">
                  Net {m.net >= 0 ? "+" : ""}
                  {formatFCFA(m.net)}
                </span>
              </div>
              {m.epargneObjectifs > 0 && (
                <p className="text-xs text-muted-foreground">
                  Épargne objectifs : {formatFCFA(m.epargneObjectifs)}
                </p>
              )}
              {m.projets.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {m.projets.map((p) => (
                    <li key={p.id}>
                      {p.sens === "revenu" ? "+" : "−"} {p.libelle} · {formatFCFA(p.montant)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
