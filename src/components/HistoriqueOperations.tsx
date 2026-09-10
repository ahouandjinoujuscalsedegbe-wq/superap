import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

/** Formate date et heure complètes en français (ex. 09 sept. 2026 · 06:46:12). */
function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const heure = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} à ${heure}`;
}

/** Historique complet (dates et heures détaillées) des revenus ou des dépenses. */
export function HistoriqueOperations({ type }: { type: "revenu" | "depense" }) {
  const { transactions, enveloppes, reclasserTransaction } = useSuperApp();
  /** Dépense en cours de reclassement manuel. */
  const [reclassement, setReclassement] = useState<string | null>(null);

  const lignes = useMemo(
    () => transactions.filter((t) => t.type === type).sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, type],
  );

  const total = lignes.reduce((s, t) => s + t.montant, 0);
  const totalFrais = lignes.reduce((s, t) => s + Math.max(0, t.frais ?? 0), 0);
  const totalReel = type === "revenu" ? total - totalFrais : total + totalFrais;
  const estRevenu = type === "revenu";

  function nomEnveloppe(id: string): string {
    const e = enveloppes.find((x) => x.id === id);
    return e ? `${e.emoji} ${e.nom}` : id;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Historique des {estRevenu ? "revenus" : "dépenses"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lignes.length} opération{lignes.length > 1 ? "s" : ""} · Total : {formatFCFA(total)}
        </p>
        {totalFrais > 0 && (
          <p className="text-sm text-muted-foreground">
            Frais de transaction : {formatFCFA(totalFrais)} ·{" "}
            {estRevenu ? "Réellement reçu" : "Coût réel"} : {formatFCFA(totalReel)}
          </p>
        )}
      </header>

      <section className="carte p-4">
        {lignes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune opération enregistrée pour le moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {lignes.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-border/70 bg-secondary/40 p-3 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      estRevenu
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {estRevenu ? (
                      <ArrowDownLeft className="h-4 w-4" aria-hidden />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium break-words">{t.libelle}</span>
                    <span className="block text-xs break-words text-muted-foreground">
                      {formaterDateHeure(t.date)}
                    </span>
                    <span className="block text-xs break-words text-muted-foreground">
                      {estRevenu ? t.categorie : nomEnveloppe(t.categorie)} · {t.compte}
                      {t.membre ? ` · ${t.membre}` : ""}
                    </span>
                    {(t.frais ?? 0) > 0 && (
                      <span className="mt-1 block text-xs break-words text-amber-600">
                        Frais : {formatFCFA(t.frais ?? 0)} ·{" "}
                        {estRevenu
                          ? `Reçu réel : ${formatFCFA(t.montant - (t.frais ?? 0))}`
                          : `Coût réel : ${formatFCFA(t.montant + (t.frais ?? 0))}`}
                      </span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      estRevenu ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {estRevenu ? "+" : "−"}
                    {formatFCFA(t.montant)}
                  </span>
                </div>

                {/* Classement manuel : corriger l'enveloppe choisie automatiquement. */}
                {!estRevenu && (
                  <div className="pl-12">
                    {reclassement === t.id ? (
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`enveloppe-${t.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Choisir l'enveloppe correcte
                        </label>
                        <select
                          id={`enveloppe-${t.id}`}
                          defaultValue={t.categorie}
                          onChange={(ev) => {
                            const id = ev.target.value;
                            if (id && id !== t.categorie) {
                              reclasserTransaction(t.id, id);
                              toast.success("Dépense reclassée.");
                            }
                            setReclassement(null);
                          }}
                          className="w-full rounded-lg border border-input bg-background/60 px-2 py-2 text-xs"
                        >
                          {enveloppes.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.emoji} {e.nom}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setReclassement(null)}
                          className="text-xs text-muted-foreground underline-offset-2"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReclassement(t.id)}
                        className="rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium"
                      >
                        Classement manuel
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
