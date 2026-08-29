import { createFileRoute } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/analyses")({
  head: () => ({
    meta: [
      { title: "Analyses et Conseils — Budget du foyer" },
      {
        name: "description",
        content:
          "Analyse de vos dépenses par enveloppe, taux d'épargne et conseils personnalisés en francs CFA.",
      },
      { property: "og:title", content: "Analyses et Conseils — SUPER APP" },
      {
        property: "og:description",
        content: "Répartition des dépenses, taux d'épargne et conseils pour votre foyer.",
      },
    ],
  }),
  component: Analyses,
});

function Analyses() {
  const { totalRevenus, totalDepenses, solde, enveloppes, depensesParEnveloppe } = useSuperApp();

  const tauxEpargne = totalRevenus > 0 ? Math.round((solde / totalRevenus) * 100) : 0;
  const repartition = enveloppes
    .map((e) => ({ ...e, utilise: depensesParEnveloppe[e.id] ?? 0 }))
    .sort((a, b) => b.utilise - a.utilise);
  const plusGrosse = repartition[0];

  const conseils: string[] = [];
  if (totalRevenus === 0) {
    conseils.push("Enregistrez d'abord un revenu pour obtenir une analyse fiable.");
  } else if (tauxEpargne < 0) {
    conseils.push("Vos dépenses dépassent vos revenus : réduisez d'urgence les postes non vitaux.");
  } else if (tauxEpargne < 10) {
    conseils.push("Visez au moins 10 % d'épargne : mettez de côté dès la réception du revenu.");
  } else {
    conseils.push("Bon rythme d'épargne, pensez à constituer 3 mois de dépenses en réserve.");
  }
  if (plusGrosse && plusGrosse.utilise > 0) {
    conseils.push(
      `Le poste « ${plusGrosse.nom} » pèse le plus lourd (${formatFCFA(plusGrosse.utilise)}). Fixez-lui un plafond réaliste.`,
    );
  }
  const depassees = repartition.filter((e) => e.utilise > e.plafond);
  if (depassees.length > 0) {
    conseils.push(
      `${depassees.length} enveloppe(s) dépassent leur plafond : ${depassees.map((e) => e.nom).join(", ")}.`,
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Analyses et Conseils</h1>
        <p className="text-sm text-muted-foreground">Comprendre où va votre argent.</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="carte p-4">
          <p className="text-xs text-muted-foreground">Taux d'épargne</p>
          <p className="mt-1 text-2xl font-bold text-primary">{tauxEpargne} %</p>
        </div>
        <div className="carte p-4">
          <p className="text-xs text-muted-foreground">Dépensé</p>
          <p className="mt-1 text-2xl font-bold">{formatFCFA(totalDepenses)}</p>
        </div>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Répartition des dépenses</h2>
        {totalDepenses === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune dépense enregistrée.</p>
        ) : (
          repartition
            .filter((e) => e.utilise > 0)
            .map((e) => {
              const part = Math.round((e.utilise / totalDepenses) * 100);
              return (
                <div key={e.id}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {e.emoji} {e.nom}
                    </span>
                    <span className="font-semibold">{part} %</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(part, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
        )}
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Conseils</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {conseils.map((c) => (
            <li key={c} className="flex gap-2">
              <span aria-hidden>💡</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
