import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { useSuperApp, type Periode } from "@/lib/store";
import { formatFCFA, formatDateFr } from "@/lib/format";
import { libellePlage } from "@/lib/periodes";
import { Confirmation } from "@/components/Confirmation";

export type AxePlan = "mois" | "enveloppe" | "libelle";

export const AXES_PLAN: { id: AxePlan; titre: string; desc: string }[] = [
  { id: "mois", titre: "Mois par mois", desc: "Regroupées par mois d'échéance" },
  {
    id: "enveloppe",
    titre: "Enveloppe par enveloppe",
    desc: "Regroupées par enveloppe de prélèvement",
  },
  { id: "libelle", titre: "Dépense par dépense", desc: "Regroupées par libellé de la dépense" },
];

const MOIS_FR = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

const FREQUENCES: { label: string; periode: Periode; intervalle: number }[] = [
  { label: "Journalière (chaque jour)", periode: "jour", intervalle: 1 },
  { label: "Tous les 2 jours", periode: "jour", intervalle: 2 },
  { label: "Tous les 3 jours", periode: "jour", intervalle: 3 },
  { label: "Hebdomadaire (chaque semaine)", periode: "semaine", intervalle: 1 },
  { label: "Toutes les 2 semaines", periode: "semaine", intervalle: 2 },
  { label: "Mensuelle (chaque mois)", periode: "mois", intervalle: 1 },
  { label: "Tous les 2 mois", periode: "mois", intervalle: 2 },
  { label: "Trimestrielle (3 mois)", periode: "trimestre", intervalle: 1 },
  { label: "Semestrielle (6 mois)", periode: "semestre", intervalle: 1 },
  { label: "Annuelle (chaque année)", periode: "annee", intervalle: 1 },
  { label: "Tous les 2 ans", periode: "annee", intervalle: 2 },
];

function libelleRepetition(b: { periode: Periode; intervalle?: number; ponctuel?: boolean }) {
  if (b.ponctuel !== false) return "Une seule fois";
  const f = FREQUENCES.find((x) => x.periode === b.periode && x.intervalle === (b.intervalle ?? 1));
  return f ? f.label : b.periode;
}

/**
 * Page de consultation des dépenses planifiées selon un axe de regroupement
 * (mois, enveloppe ou libellé), avec le détail complet de chaque prévision et
 * les actions « Convertir maintenant » et « Supprimer ».
 */
export function ListePlansGroupes({ axe }: { axe: AxePlan }) {
  const { budgets, enveloppes, convertirBudget, supprimerBudget } = useSuperApp();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [demande, setDemande] = useState<
    null | { type: "conversion"; id: string; libelle: string; montant: number } | {
      type: "suppression";
      id: string;
      libelle: string;
    }
  >(null);

  const infos = AXES_PLAN.find((a) => a.id === axe) ?? AXES_PLAN[0];

  function nomEnveloppe(id: string): string {
    const env = enveloppes.find((e) => e.id === id);
    return env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée";
  }

  const groupes = useMemo(() => {
    const map = new Map<string, { nom: string; liste: typeof budgets }>();
    for (const b of budgets) {
      let cle = "";
      let nom = "";
      if (axe === "enveloppe") {
        cle = b.enveloppeId || "__sans";
        const env = enveloppes.find((e) => e.id === b.enveloppeId);
        nom = env ? `${env.emoji} ${env.nom}` : "Enveloppe supprimée";
      } else if (axe === "libelle") {
        cle = b.libelle.trim().toLowerCase() || "__sans";
        nom = b.libelle.trim() || "Sans libellé";
      } else {
        const iso = b.debut ?? b.prochaine;
        const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
        cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        nom = MOIS_FR.format(d);
      }
      const g = map.get(cle) ?? { nom, liste: [] as typeof budgets };
      g.liste.push(b);
      map.set(cle, g);
    }
    return Array.from(map.entries())
      .sort((a, z) =>
        axe === "mois" ? a[0].localeCompare(z[0]) : a[1].nom.localeCompare(z[1].nom, "fr"),
      )
      .map(([id, g]) => ({
        id,
        nom: g.nom,
        liste: g.liste
          .slice()
          .sort((a, z) => (a.debut ?? a.prochaine).localeCompare(z.debut ?? z.prochaine)),
        total: g.liste.reduce((s, b) => s + b.montant, 0),
      }));
  }, [axe, budgets, enveloppes]);

  const total = budgets.reduce((s, b) => s + b.montant, 0);

  function confirmer() {
    if (!demande) return;
    if (demande.type === "conversion") {
      convertirBudget(demande.id);
      toast.success("Dépense réelle créée.");
    } else {
      supprimerBudget(demande.id);
      toast.success("Dépense planifiée supprimée.");
    }
    setDemande(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{infos.titre}</h1>
      <p className="text-sm text-muted-foreground">{infos.desc}</p>

      <section className="carte space-y-4 p-4">
        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          <p className="font-semibold">Total planifié : {formatFCFA(total)}</p>
          <p className="text-xs text-muted-foreground">
            {budgets.length} dépense{budgets.length > 1 ? "s" : ""} planifiée
            {budgets.length > 1 ? "s" : ""} · {groupes.length} groupe
            {groupes.length > 1 ? "s" : ""}
          </p>
        </div>

        {budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune dépense planifiée. Utilisez « Planifier une dépense ».
          </p>
        ) : (
          <div className="space-y-4">
            {groupes.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="truncate">{g.nom}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {g.liste.length} · {formatFCFA(g.total)}
                  </span>
                </p>
                <ul className="space-y-2">
                  {g.liste.map((b) => {
                    const ouvert = ouverte === b.id;
                    return (
                      <li key={b.id} className="overflow-hidden rounded-xl border border-border/70">
                        <button
                          type="button"
                          onClick={() => setOuverte(ouvert ? null : b.id)}
                          aria-expanded={ouvert}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/30"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{b.libelle}</span>
                            <span className="block text-xs text-muted-foreground">
                              {b.debut && b.fin
                                ? libellePlage({ debut: b.debut, fin: b.fin })
                                : formatDateFr(b.prochaine)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-semibold">{formatFCFA(b.montant)}</span>
                            <ChevronDown
                              aria-hidden
                              className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`}
                            />
                          </span>
                        </button>

                        {ouvert && (
                          <div className="space-y-2 border-t border-border/70 bg-background/40 p-3 text-xs">
                            <p>
                              <span className="text-muted-foreground">Enveloppe : </span>
                              {nomEnveloppe(b.enveloppeId)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Périodicité : </span>
                              {libelleRepetition(b)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Compte débité : </span>
                              {b.compte}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Prochaine échéance : </span>
                              {formatDateFr(b.prochaine)}
                            </p>
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setDemande({
                                    type: "conversion",
                                    id: b.id,
                                    libelle: b.libelle,
                                    montant: b.montant,
                                  })
                                }
                                className="rounded-lg border border-input px-2.5 py-1 font-medium"
                              >
                                Convertir maintenant
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDemande({
                                    type: "suppression",
                                    id: b.id,
                                    libelle: b.libelle,
                                  })
                                }
                                className="rounded-lg border border-input px-2.5 py-1 font-medium text-destructive"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Confirmation
        ouvert={demande !== null}
        titre={
          demande?.type === "suppression"
            ? "Supprimer cette dépense prévue ?"
            : "Confirmer la conversion"
        }
        message={
          demande?.type === "suppression"
            ? `La dépense prévue « ${demande.libelle} » sera supprimée définitivement.`
            : demande
              ? `Créer une dépense réelle de ${formatFCFA(demande.montant)} pour « ${demande.libelle} » ?`
              : ""
        }
        confirmerLabel={demande?.type === "suppression" ? "Supprimer" : "Confirmer"}
        danger={demande?.type === "suppression"}
        onConfirmer={confirmer}
        onAnnuler={() => setDemande(null)}
      />
    </div>
  );
}
