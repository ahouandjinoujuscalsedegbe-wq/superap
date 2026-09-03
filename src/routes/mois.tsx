import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Lightbulb, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { useSuperApp } from "@/lib/store";
import { decalerMois } from "@/lib/budget-mensuel";
import { dotationDe, etatEnveloppe } from "@/lib/enveloppe-etat";
import { libelleMois } from "@/lib/rapport-mensuel";
import { calculerAlarmes, lireReglagesAlarme, type Alarme } from "@/lib/alarme";
import { conseiller } from "@/lib/conseil";

export const Route = createFileRoute("/mois")({
  head: () => ({
    meta: [
      { title: "Vue globale du mois — Revenus, dépenses et alarmes" },
      {
        name: "description",
        content:
          "Tout le mois en un écran : revenus, dépenses, solde global, enveloppes épuisées, alarmes actives et un conseil personnalisé, calculés hors ligne.",
      },
      { property: "og:title", content: "Vue globale du mois — SUPER APP" },
      {
        property: "og:description",
        content:
          "Revenus, dépenses, solde global, enveloppes épuisées, alarmes et conseil personnalisé du mois.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageMois,
});

function PageMois() {
  const { transactions, enveloppes, budgets, dettes, soldesParCompte, depensesParEnveloppe } =
    useSuperApp();
  const moisActuel = new Date().toISOString().slice(0, 7);
  const [mois, setMois] = useState(moisActuel);
  const [alarmes, setAlarmes] = useState<Alarme[]>([]);

  const soldeGlobal = useMemo(
    () => Object.values(soldesParCompte).reduce((s, v) => s + v, 0),
    [soldesParCompte],
  );

  const bilan = useMemo(() => {
    const duMois = transactions.filter((t) => t.date.slice(0, 7) === mois);
    const revenus = duMois.filter((t) => t.type === "revenu").reduce((s, t) => s + t.montant, 0);
    const depenses = duMois.filter((t) => t.type === "depense").reduce((s, t) => s + t.montant, 0);
    const precedent = transactions
      .filter((t) => t.type === "depense" && t.date.slice(0, 7) === decalerMois(mois, -1))
      .reduce((s, t) => s + t.montant, 0);
    const variation = precedent > 0 ? ((depenses - precedent) / precedent) * 100 : 0;
    return {
      revenus,
      depenses,
      net: revenus - depenses,
      nbOperations: duMois.length,
      variation,
      tauxEpargne: revenus > 0 ? ((revenus - depenses) / revenus) * 100 : 0,
    };
  }, [transactions, mois]);

  const depensesMoisParEnveloppe = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== "depense" || t.date.slice(0, 7) !== mois) continue;
      map[t.categorie] = (map[t.categorie] ?? 0) + t.montant;
    }
    return map;
  }, [transactions, mois]);

  const epuisees = useMemo(
    () =>
      enveloppes
        .map((e) => ({
          enveloppe: e,
          etat: etatEnveloppe(e, depensesParEnveloppe[e.id] ?? 0),
          duMois: depensesMoisParEnveloppe[e.id] ?? 0,
        }))
        .filter((l) => l.etat.epuisee || l.etat.plafondAtteint)
        .sort((a, b) => b.etat.utilise - a.etat.utilise),
    [enveloppes, depensesParEnveloppe, depensesMoisParEnveloppe],
  );

  useEffect(() => {
    try {
      const reglages = lireReglagesAlarme();
      setAlarmes(
        calculerAlarmes(
          {
            budgets,
            enveloppes,
            transactions,
            solde: soldeGlobal,
            soldesParCompte,
            depensesParEnveloppe,
          },
          reglages,
        ),
      );
    } catch {
      setAlarmes([]);
    }
  }, [budgets, enveloppes, transactions, soldeGlobal, soldesParCompte, depensesParEnveloppe]);

  const conseil = useMemo(() => {
    const recos = conseiller({
      transactions,
      enveloppes,
      budgets,
      dettes,
      depensesParEnveloppe,
      solde: soldeGlobal,
    });
    return recos[0];
  }, [transactions, enveloppes, budgets, dettes, depensesParEnveloppe, soldeGlobal]);

  const choixMois = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => decalerMois(moisActuel, -i)),
    [moisActuel],
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Vue globale du mois</h1>
        <p className="text-sm text-muted-foreground capitalize">{libelleMois(mois)}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {choixMois.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMois(m)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              m === mois ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {libelleMois(m)}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3">
        <div className="surface rounded-2xl border border-border p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Revenus
          </p>
          <p className="text-lg font-bold text-emerald-600">{formatFCFA(bilan.revenus)}</p>
        </div>
        <div className="surface rounded-2xl border border-border p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden /> Dépenses
          </p>
          <p className="text-lg font-bold text-destructive">{formatFCFA(bilan.depenses)}</p>
          {bilan.variation !== 0 && (
            <p className="text-xs text-muted-foreground">
              {bilan.variation > 0 ? "+" : ""}
              {Math.round(bilan.variation)} % vs mois précédent
            </p>
          )}
        </div>
        <div className="surface rounded-2xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Résultat du mois</p>
          <p
            className={`text-lg font-bold ${
              bilan.net >= 0 ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {bilan.net >= 0 ? "+" : ""}
            {formatFCFA(bilan.net)}
          </p>
          <p className="text-xs text-muted-foreground">
            Épargne {Math.round(bilan.tauxEpargne)} % · {bilan.nbOperations} opérations
          </p>
        </div>
        <div className="surface rounded-2xl border border-border p-3">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" aria-hidden /> Solde global
          </p>
          <p
            className={`text-lg font-bold ${
              soldeGlobal >= 0 ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {formatFCFA(soldeGlobal)}
          </p>
          <p className="text-xs text-muted-foreground">Tous comptes réunis</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden /> Enveloppes épuisées
        </h2>
        {epuisees.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune enveloppe épuisée : vos limites sont respectées.
          </p>
        ) : (
          <ul className="space-y-2">
            {epuisees.map(({ enveloppe, etat, duMois }) => (
              <li
                key={enveloppe.id}
                className="surface flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {enveloppe.emoji} {enveloppe.nom}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {etat.epuisee ? "Dotation épuisée" : "Plafond atteint"} · {formatFCFA(duMois)}{" "}
                    ce mois
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFCFA(etat.utilise)} / {formatFCFA(dotationDe(enveloppe))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-primary" aria-hidden /> Alarmes actives
        </h2>
        {alarmes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alarme en cours.</p>
        ) : (
          <ul className="space-y-2">
            {alarmes.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className={`surface rounded-xl border px-3 py-2 ${
                  a.niveau === "alerte"
                    ? "border-destructive/60"
                    : a.niveau === "attention"
                      ? "border-amber-500/60"
                      : "border-border"
                }`}
              >
                <p className="text-sm font-medium">{a.titre}</p>
                <p className="text-xs text-muted-foreground">{a.texte}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface space-y-2 rounded-2xl border border-border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> Conseil personnalisé
        </h2>
        {conseil ? (
          <>
            <p className="text-sm font-medium">{conseil.titre}</p>
            <p className="text-sm text-muted-foreground">{conseil.explication}</p>
            <p className="text-sm">{conseil.action}</p>
            {conseil.gainMensuel > 0 && (
              <p className="text-xs text-emerald-600">
                Gain estimé : {formatFCFA(conseil.gainMensuel)} par mois
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Votre gestion est équilibrée ce mois-ci : continuez ainsi.
          </p>
        )}
      </section>
    </div>
  );
}
