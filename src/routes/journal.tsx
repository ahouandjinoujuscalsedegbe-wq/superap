import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ClipboardCopy,
  Download,
  FileJson,
  Info,
  Stethoscope,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  exporterJournalCsv,
  exporterJournalJson,
  journalEnTexte,
  lireJournal,
  statistiquesJournal,
  supprimerEntreeJournal,
  surJournal,
  viderJournal,
  type EntreeJournal,
  type NiveauJournal,
} from "@/lib/journal";
import { Confirmation } from "@/components/Confirmation";
import { BoutonRetour } from "@/components/BoutonRetour";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal de diagnostic — Erreurs OCR, dictée et prétraitement" },
      {
        name: "description",
        content:
          "Consultez et exportez le journal d'erreurs et de diagnostics : fiabilité OCR, erreurs de reconnaissance vocale et échecs de prétraitement d'image.",
      },
      { property: "og:title", content: "Journal de diagnostic — SUPER APP" },
      {
        property: "og:description",
        content:
          "Historique technique exportable en JSON ou CSV pour corriger rapidement les problèmes de saisie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageJournal,
});

const NIVEAUX: { id: NiveauJournal | "tous"; label: string }[] = [
  { id: "tous", label: "Tout" },
  { id: "erreur", label: "Erreurs" },
  { id: "avertissement", label: "Alertes" },
  { id: "info", label: "Infos" },
];

const SOURCES: Record<string, string> = {
  ocr: "Lecture de ticket (OCR)",
  dictee: "Dictée vocale",
  pretraitement: "Prétraitement d'image",
  saisie: "Saisie",
  stockage: "Stockage local",
  application: "Application",
};

function icone(niveau: NiveauJournal) {
  if (niveau === "erreur") return <XCircle className="h-4 w-4 text-destructive" aria-hidden />;
  if (niveau === "avertissement")
    return <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />;
  return <Info className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function PageJournal() {
  const [entrees, setEntrees] = useState<EntreeJournal[]>([]);
  const [filtre, setFiltre] = useState<NiveauJournal | "tous">("tous");
  const [aSupprimer, setASupprimer] = useState<EntreeJournal | null>(null);
  const [viderDemande, setViderDemande] = useState(false);

  useEffect(() => {
    setEntrees(lireJournal());
    return surJournal(setEntrees);
  }, []);

  const stats = useMemo(() => statistiquesJournal(entrees), [entrees]);
  const visibles = useMemo(
    () => (filtre === "tous" ? entrees : entrees.filter((e) => e.niveau === filtre)),
    [entrees, filtre],
  );

  async function copier() {
    try {
      await navigator.clipboard.writeText(journalEnTexte(entrees));
      toast.success("Journal copié dans le presse-papiers.");
    } catch {
      toast.error("Copie impossible sur ce navigateur. Utilisez l'export JSON ou CSV.");
    }
  }

  return (
    <div className="space-y-5">
      <BoutonRetour to="/parametres" label="Retour aux paramètres" />

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Stethoscope className="h-5 w-5" aria-hidden />
          Journal de diagnostic
        </h1>
        <p className="text-sm text-muted-foreground">
          Erreurs et mesures techniques enregistrées sur cet appareil : fiabilité de la lecture des
          tickets, erreurs de dictée vocale et échecs de prétraitement d'image.
        </p>
      </header>

      <section className="carte grid grid-cols-2 gap-3 p-4">
        <div>
          <p className="text-xs text-muted-foreground">Événements</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Erreurs</p>
          <p className="text-xl font-bold text-destructive">{stats.erreurs}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Avertissements</p>
          <p className="text-xl font-bold">{stats.avertissements}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Confiance OCR moyenne</p>
          <p className="text-xl font-bold">
            {stats.confianceOcrMoyenne !== null ? `${stats.confianceOcrMoyenne} %` : "—"}
          </p>
        </div>
        {stats.derniereErreur && (
          <p className="col-span-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Dernière erreur : {stats.derniereErreur.message} (
            {new Date(stats.derniereErreur.date).toLocaleString("fr-FR")})
          </p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold">Exporter le diagnostic</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              exporterJournalJson(entrees);
              toast.success("Export JSON téléchargé.");
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-input px-2 py-2 text-xs font-semibold"
          >
            <FileJson className="h-3.5 w-3.5" aria-hidden />
            JSON
          </button>
          <button
            type="button"
            onClick={() => {
              exporterJournalCsv(entrees);
              toast.success("Export CSV téléchargé.");
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-input px-2 py-2 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void copier()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-input px-2 py-2 text-xs font-semibold"
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            Copier
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          {NIVEAUX.map((n) => (
            <button
              key={n.id}
              type="button"
              aria-pressed={filtre === n.id}
              onClick={() => setFiltre(n.id)}
              className={`rounded-xl border px-2 py-1.5 text-xs font-medium ${
                filtre === n.id
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-input bg-background/60 text-muted-foreground"
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>

        {visibles.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucun événement enregistré. Le journal se remplit automatiquement lors des lectures de
            tickets, des dictées et en cas d'erreur.
          </p>
        ) : (
          <ul className="space-y-2">
            {visibles.map((e) => (
              <li key={e.id} className="carte flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {icone(e.niveau)}
                    <span className="truncate">{e.message}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {SOURCES[e.source] ?? e.source} · {new Date(e.date).toLocaleString("fr-FR")}
                  </p>
                  {e.details && (
                    <p className="break-words text-[11px] text-muted-foreground">
                      {Object.entries(e.details)
                        .map(([k, v]) => `${k} : ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setASupprimer(e)}
                  aria-label="Supprimer cet événement"
                  title="Supprimer cet événement"
                  className="shrink-0 rounded-lg border border-input p-1.5 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {entrees.length > 0 && (
          <button
            type="button"
            onClick={() => setViderDemande(true)}
            className="w-full rounded-xl border border-input px-3 py-2 text-xs font-semibold text-destructive"
          >
            Vider le journal
          </button>
        )}
      </section>

      <Confirmation
        ouvert={aSupprimer !== null}
        titre="Supprimer cet événement"
        message={`Retirer « ${aSupprimer?.message ?? ""} » du journal de diagnostic ?`}
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={() => {
          if (aSupprimer) setEntrees(supprimerEntreeJournal(aSupprimer.id));
          setASupprimer(null);
          toast.success("Événement supprimé.");
        }}
      />

      <Confirmation
        ouvert={viderDemande}
        titre="Vider le journal"
        message="Effacer tous les événements de diagnostic enregistrés sur cet appareil ?"
        onAnnuler={() => setViderDemande(false)}
        onConfirmer={() => {
          setEntrees(viderJournal());
          setViderDemande(false);
          toast.success("Journal vidé.");
        }}
      />
    </div>
  );
}
