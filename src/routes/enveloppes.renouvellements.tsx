import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, Percent, Wallet } from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { formatFCFA } from "@/lib/format";
import { prochainRenouvellement, totalVerse } from "@/lib/remplissage";
import { useSuperApp, type Remplissage } from "@/lib/store";

export const Route = createFileRoute("/enveloppes/renouvellements")({
  head: () => ({
    meta: [
      { title: "Renouvellements — Détail des remplissages d'enveloppes" },
      {
        name: "description",
        content:
          "Vue détaillée des renouvellements d'enveloppes : période, montant réservé, compte source et pourcentage de revenu utilisé, en FCFA.",
      },
      { property: "og:title", content: "Renouvellements des enveloppes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Suivez chaque remplissage d'enveloppe : période, montant réservé, compte source et part de revenu prélevée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Renouvellements,
});

const LIBELLE_ORIGINE: Record<Remplissage["origine"], string> = {
  periode: "Renouvellement de période",
  revenu: "Part d'un revenu",
  manuel: "Versement manuel",
};

function jourLisible(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function Renouvellements() {
  const { enveloppes, remplissages, transactions } = useSuperApp();
  const [filtre, setFiltre] = useState<string>("");

  const configurees = useMemo(
    () => enveloppes.filter((e) => e.compteSource || e.periodeRenouvellement),
    [enveloppes],
  );

  const historique = useMemo(() => {
    const liste = filtre ? remplissages.filter((r) => r.enveloppeId === filtre) : remplissages;
    return [...liste].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 100);
  }, [remplissages, filtre]);

  const totalDebite = useMemo(() => historique.reduce((s, r) => s + r.montant, 0), [historique]);

  /** Revenus encaissés sur le compte source, pour situer la part prélevée. */
  const revenusParCompte = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === "revenu") m[t.compte] = (m[t.compte] ?? 0) + t.montant;
    }
    return m;
  }, [transactions]);

  const nomEnveloppe = (id: string) =>
    enveloppes.find((e) => e.id === id)?.nom ?? "ENVELOPPE SUPPRIMÉE";

  return (
    <div className="space-y-5">
      <BoutonRetour to="/enveloppes/action" label="Retour à Action" />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Détail des renouvellements</h1>
        <p className="text-sm text-muted-foreground">
          Période de chaque enveloppe, montant réservé, compte source et part de revenu utilisée.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Réglages par enveloppe
        </h2>

        {configurees.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucune enveloppe n'a encore de compte source ni de période de renouvellement.
          </p>
        ) : (
          configurees.map((e) => {
            const pourcentage = e.modeRemplissage === "pourcentage";
            const prochaine = prochainRenouvellement(e);
            const verse = totalVerse(e.id, remplissages);
            const revenusSource = e.compteSource ? (revenusParCompte[e.compteSource] ?? 0) : 0;
            return (
              <article key={e.id} className="carte space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    <span aria-hidden>{e.emoji}</span> {e.nom}
                  </p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {pourcentage ? "% de chaque revenu" : "Montant fixe"}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Période</dt>
                    <dd className="font-medium">Le 1er de chaque mois</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Compte source</dt>
                    <dd className="font-medium">{e.compteSource || "Non défini"}</dd>
                  </div>

                  <div>
                    <dt className="text-muted-foreground">
                      {pourcentage ? "Part de revenu" : "Montant par période"}
                    </dt>
                    <dd className="font-medium">
                      {pourcentage
                        ? `${e.pourcentageRevenu ?? 0} %`
                        : formatFCFA(e.montantPeriode ?? e.dotation ?? e.plafond)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {pourcentage ? "Estimé sur revenus encaissés" : "Prochain renouvellement"}
                    </dt>
                    <dd className="font-medium">
                      {pourcentage
                        ? formatFCFA(Math.round((revenusSource * (e.pourcentageRevenu ?? 0)) / 100))
                        : prochaine
                          ? jourLisible(prochaine)
                          : "Le 1er du mois prochain"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total réservé sur le compte</dt>
                    <dd className="font-medium">{formatFCFA(verse)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ajustement auto</dt>
                    <dd className="font-medium">
                      {pourcentage ? "—" : e.ajustementAuto ? "Activé" : "Désactivé"}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  onClick={() => setFiltre(filtre === e.id ? "" : e.id)}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  {filtre === e.id ? "Voir tout l'historique" : "Voir seulement cette enveloppe"}
                </button>
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
            Historique des remplissages
          </h2>
          <span className="text-xs text-muted-foreground">{formatFCFA(totalDebite)} réservés</span>
        </div>

        {historique.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucun remplissage enregistré pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {historique.map((r) => (
              <li key={r.id} className="carte flex items-start gap-3 p-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {r.origine === "revenu" ? (
                    <Percent aria-hidden className="h-4 w-4" />
                  ) : r.origine === "periode" ? (
                    <CalendarClock aria-hidden className="h-4 w-4" />
                  ) : (
                    <Wallet aria-hidden className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{nomEnveloppe(r.enveloppeId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {jourLisible(r.date)} · {LIBELLE_ORIGINE[r.origine]}
                  </p>
                  <p className="text-xs text-muted-foreground">Débité de : {r.compte}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-destructive">
                  −{formatFCFA(r.montant)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
