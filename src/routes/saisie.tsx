import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Mic,
  MicOff,
  Loader2,
  ScanText,
  Check,
  Volume2,
  History,
  Images,
  Trash2,
  Brain,
  CopyCheck,
  Repeat,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { COMPTES, useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant } from "@/lib/format";
import { analyserTexte, type OperationExtraite } from "@/lib/extraction";
import {
  appliquerApprentissage,
  apprendreTicket,
  fiabiliteOcr,
  type FiabiliteOcr,
  type OperationAmelioree,
  type SourceMontant,
} from "@/lib/ocr-apprentissage";

import {
  empreinteTicket,
  verifierAuthenticite,
  type VerdictAuthenticite,
} from "@/lib/authenticite";
import { creerDictee, demarrerDictee, dicteeDisponible } from "@/lib/dictee";
import {
  ajouterHistoriqueSaisie,
  analyserPlusieurs,
  apprendreEnveloppe,
  arreterLecture,
  detecterDoublon,
  detecterRecurrence,
  lireAVoixHaute,
  lireHistoriqueSaisies,
  preparerImage,
  reconnaitreCommande,
  suggererEnveloppe,
  supprimerHistoriqueSaisie,
  syntheseDisponible,
  viderHistoriqueSaisies,
  type SaisieHistorique,
} from "@/lib/saisie-plus";
import { Confirmation } from "@/components/Confirmation";
import { journalAvertissement, journalErreur, journalInfo } from "@/lib/journal";

export const Route = createFileRoute("/saisie")({
  head: () => ({
    meta: [
      { title: "Saisie intelligente — Photo de ticket et dictée vocale" },
      {
        name: "description",
        content:
          "Photographiez un ou plusieurs tickets ou dictez vos opérations : montant, date, libellé et enveloppe sont extraits automatiquement en FCFA.",
      },
      { property: "og:title", content: "Saisie intelligente — SUPER APP" },
      {
        property: "og:description",
        content:
          "OCR par lot, dictée vocale, apprentissage des commerçants et détection des doublons pour vos opérations en francs CFA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaisieIntelligente,
});

type Brouillon = {
  id: string;
  origine: "ocr" | "dictee" | "manuel";
  texte: string;
  vignette?: string;
  confiance: number;
  type: "revenu" | "depense";
  montant: string;
  libelle: string;
  date: string;
  enveloppe: string;
  source: string;
  compte: string;
  /** Contrôle d'authenticité du ticket photographié. */
  verdict?: VerdictAuthenticite;
  /** L'utilisateur certifie avoir vérifié un ticket jugé douteux. */
  certifie?: boolean;
  /** Explication du montant retenu par la lecture automatique. */
  explication?: string;
  /** Corrections appliquées grâce à l'expérience passée. */
  ajustements?: string[];
  /** Proposition initiale, comparée à la validation pour apprendre. */
  propose?: {
    montant: number;
    libelle: string;
    type: "revenu" | "depense";
    enveloppe?: string;
    sourceMontant?: SourceMontant;
  };
};


function SaisieIntelligente() {
  const { ajouterTransaction, enveloppes, comptes, sourcesRevenu, transactions } = useSuperApp();
  const navigate = useNavigate();

  const [brouillons, setBrouillons] = useState<Brouillon[]>([]);
  const [texte, setTexte] = useState("");
  const [progression, setProgression] = useState<string | null>(null);
  const [ecoute, setEcoute] = useState(false);
  const [confirmation, setConfirmation] = useState<{ mode: "un" | "tous"; id?: string } | null>(
    null,
  );
  const [historique, setHistorique] = useState<SaisieHistorique[]>([]);
  const [ongletBas, setOngletBas] = useState<"historique" | "galerie" | null>(null);
  const [aSupprimer, setASupprimer] = useState<SaisieHistorique | null>(null);
  const [viderDemande, setViderDemande] = useState(false);
  const [fiabilite, setFiabilite] = useState<FiabiliteOcr | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const reco = useRef<ReturnType<typeof creerDictee>>(null);
  /** Empreintes des tickets déjà lus ou déjà enregistrés. */
  const empreintesConnues = useRef<string[]>([]);

  useEffect(() => {
    const liste = lireHistoriqueSaisies();
    setHistorique(liste);
    setFiabilite(fiabiliteOcr());
    empreintesConnues.current = liste
      .filter((s) => s.source === "ocr" && s.texte)
      .map((s) => empreinteTicket(s.texte));
  }, []);

  useEffect(() => {
    return () => {
      reco.current?.stop();
      arreterLecture();
    };
  }, []);

  const operationsSimples = useMemo(
    () =>
      transactions.map((t) => ({
        id: t.id,
        type: t.type,
        montant: t.montant,
        libelle: t.libelle,
        date: t.date,
      })),
    [transactions],
  );

  const creerBrouillon = useCallback(
    (
      resultat: OperationExtraite | OperationAmelioree,
      origine: Brouillon["origine"],
      texteSource: string,
      vignette?: string,
      verdict?: VerdictAuthenticite,
    ): Brouillon => {
      const ajustements = "ajustements" in resultat ? resultat.ajustements : [];
      const experience = "experience" in resultat ? resultat.experience : 0;
      const enveloppeApprise =
        experience > 0 && resultat.indiceEnveloppe ? resultat.indiceEnveloppe : undefined;
      const apprise = suggererEnveloppe(resultat.libelle);
      const enveloppeChoisie =
        (enveloppeApprise && enveloppes.some((e) => e.id === enveloppeApprise)
          ? enveloppeApprise
          : undefined) ??
        (apprise && enveloppes.some((e) => e.id === apprise) ? apprise : undefined) ??
        resultat.indiceEnveloppe ??
        enveloppes[0]?.id ??
        "";
      // Un montant déjà corrigé par l'expérience prime sur le recoupement brut.
      const montantAjuste = ajustements.some((a) => a.startsWith("Montant"));
      const montantRetenu = montantAjuste
        ? resultat.montant
        : (verdict?.montantRecoupe ?? resultat.montant);
      return {
        id: crypto.randomUUID(),
        origine,
        texte: texteSource,
        ...(vignette ? { vignette } : {}),
        confiance: verdict ? Math.max(verdict.score / 100, resultat.confiance * 0.9) : resultat.confiance,
        type: resultat.type,
        montant: montantRetenu ? String(montantRetenu) : "",
        libelle: resultat.libelle,
        date: resultat.date,
        enveloppe: enveloppeChoisie,
        source: sourcesRevenu[0] ?? "Salaire",
        compte: comptes[0] ?? COMPTES[0] ?? "",
        ...(verdict ? { verdict } : {}),
        ...(resultat.explicationMontant ? { explication: resultat.explicationMontant } : {}),
        ...(ajustements.length > 0 ? { ajustements } : {}),
        propose: {
          montant: montantRetenu || 0,
          libelle: resultat.libelle,
          type: resultat.type,
          ...(enveloppeChoisie ? { enveloppe: enveloppeChoisie } : {}),
          ...(resultat.sourceMontant ? { sourceMontant: resultat.sourceMontant } : {}),
        },
      };
    },

    [comptes, enveloppes, sourcesRevenu],
  );

  const majBrouillon = useCallback((id: string, champs: Partial<Brouillon>) => {
    setBrouillons((liste) => liste.map((b) => (b.id === id ? { ...b, ...champs } : b)));
  }, []);

  /* ------------------------- Analyse de texte ------------------------- */

  function analyser(source_: string) {
    if (!source_.trim()) {
      toast.error("Aucun texte à analyser.");
      return;
    }
    const commande = reconnaitreCommande(source_);
    if (commande) {
      toast.success(`Ouverture : ${commande.libelle}`);
      void navigate({ to: commande.chemin });
      return;
    }
    const resultats = analyserPlusieurs(source_, enveloppes);
    setBrouillons((liste) => [
      ...liste,
      ...resultats.map((r) => creerBrouillon(r, "dictee", source_)),
    ]);
    toast.success(
      resultats.length > 1
        ? `${resultats.length} opérations détectées. Vérifiez-les avant d'enregistrer.`
        : "Opération détectée. Vérifiez avant d'enregistrer.",
    );
  }

  /* ---------------------- OCR par lot de tickets ---------------------- */

  async function lireImages(fichiers: File[]) {
    for (let i = 0; i < fichiers.length; i += 1) {
      const f = fichiers[i];
      if (!f) continue;
      setProgression(`Ticket ${i + 1}/${fichiers.length} — préparation`);
      try {
        const { blob, apercu } = await preparerImage(f);
        const { default: Tesseract } = await import("tesseract.js");
        const resultat = await Tesseract.recognize(blob, "fra", {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setProgression(
                `Ticket ${i + 1}/${fichiers.length} — lecture ${Math.round(m.progress * 100)} %`,
              );
            }
          },
        });
        const lu = resultat.data.text ?? "";
        const confiance = Math.round(Number(resultat.data.confidence ?? 0));
        if (!lu.trim()) {
          journalAvertissement("ocr", "Aucun texte lisible sur le ticket", {
            fichier: f.name,
            confiance,
          });
          toast.error(`Ticket ${i + 1} : aucun texte lisible. Reprenez la photo bien éclairée.`);
          continue;
        }
        if (confiance > 0 && confiance < 60) {
          journalAvertissement("ocr", "Lecture peu fiable : vérifiez les montants", {
            fichier: f.name,
            confiance,
            caracteres: lu.length,
          });
          toast.warning(
            `Ticket ${i + 1} : lecture peu fiable (${confiance} %). Vérifiez bien le montant.`,
          );
        } else {
          journalInfo("ocr", "Ticket lu", {
            fichier: f.name,
            confiance,
            caracteres: lu.length,
          });
        }
        setTexte(lu);
        // Lecture brute, puis application de ce que l'application a déjà appris.
        const extrait = appliquerApprentissage(analyserTexte(lu, enveloppes), lu);
        if (extrait.ajustements.length > 0) {
          toast.info(`Ticket ${i + 1} : ${extrait.ajustements.join(", ")} (déjà appris).`);
        }

        const verdict = verifierAuthenticite(lu, {
          confianceOcr: confiance,
          dateOperation: extrait.date,
          montant: extrait.montant,
          empreintesConnues: empreintesConnues.current,
          nomFichier: f.name,
        });
        empreintesConnues.current = [...empreintesConnues.current, verdict.empreinte];
        journalInfo("ocr", "Contrôle d'authenticité du ticket", {
          fichier: f.name,
          score: verdict.score,
          verdict: verdict.verdict,
          alertes: verdict.indices.filter((x) => x.niveau === "alerte").length,
        });
        if (verdict.verdict === "suspect") {
          toast.error(`Ticket ${i + 1} : document douteux (${verdict.score}/100). Vérifiez-le.`);
        } else if (verdict.verdict === "a_verifier") {
          toast.warning(`Ticket ${i + 1} : à contrôler (${verdict.score}/100).`);
        }
        setBrouillons((liste) => [...liste, creerBrouillon(extrait, "ocr", lu, apercu, verdict)]);
      } catch (erreur) {
        journalErreur("ocr", "Échec de la lecture du ticket", {
          fichier: f.name,
          detail: String((erreur as Error)?.message ?? erreur),
        });
        toast.error(`Ticket ${i + 1} : la lecture a échoué. Réessayez avec une photo plus nette.`);
      }
    }
    setProgression(null);
    toast.success("Lecture terminée. Vérifiez les opérations détectées.");
  }

  /* ---------------------------- Dictée -------------------------------- */

  function basculerDictee() {
    if (ecoute) {
      reco.current?.stop();
      setEcoute(false);
      return;
    }
    if (!dicteeDisponible()) {
      toast.error("La dictée vocale n'est pas prise en charge par ce navigateur.");
      return;
    }
    const instance = creerDictee(
      (t, definitif) => {
        setTexte(t);
        if (definitif) analyser(t);
      },
      (message) => {
        toast.error(message);
        setEcoute(false);
      },
      () => setEcoute(false),
    );
    reco.current = instance;
    void demarrerDictee(instance);
    setEcoute(true);
  }

  /* --------------------------- Enregistrement ------------------------- */

  const valeurDe = (b: Brouillon) => Number(b.montant.replace(/\s/g, "")) || 0;

  const nomEnveloppe = (id: string) => enveloppes.find((e) => e.id === id)?.nom ?? "—";

  function verifier(b: Brouillon): string | null {
    if (valeurDe(b) <= 0) return "Le montant doit être supérieur à zéro.";
    if (b.type === "depense" && !b.enveloppe) return "Choisissez une enveloppe pour cette dépense.";
    if (!b.compte) return "Choisissez un compte.";
    if (b.verdict?.blocageRecommande && !b.certifie)
      return "Ticket jugé douteux : contrôlez-le puis cochez « J'ai vérifié ce ticket ».";
    return null;
  }

  function demanderEnregistrement(mode: "un" | "tous", id?: string) {
    const cibles = mode === "tous" ? brouillons : brouillons.filter((b) => b.id === id);
    if (cibles.length === 0) return;
    for (const b of cibles) {
      const erreur = verifier(b);
      if (erreur) {
        toast.error(`${b.libelle || "Opération"} : ${erreur}`);
        return;
      }
    }
    setConfirmation(mode === "tous" ? { mode } : { mode, id: id! });
  }

  function enregistrerBrouillon(b: Brouillon) {
    const valeur = valeurDe(b);
    ajouterTransaction({
      type: b.type,
      montant: valeur,
      libelle: b.libelle.trim() || (b.type === "revenu" ? b.source : "Opération"),
      categorie: b.type === "revenu" ? b.source : b.enveloppe,
      compte: b.compte,
      date: new Date(b.date).toISOString(),
    });
    if (b.type === "depense") apprendreEnveloppe(b.libelle, b.enveloppe);
    // Leçon de lecture : ce qui était proposé face à ce qui a été validé.
    if (b.origine === "ocr" && b.propose) {
      apprendreTicket({
        texte: b.texte,
        propose: b.propose,
        valide: {
          montant: valeur,
          libelle: b.libelle.trim() || "Opération",
          type: b.type,
          ...(b.type === "depense" && b.enveloppe ? { enveloppe: b.enveloppe } : {}),
          compte: b.compte,
        },
      });
      setFiabilite(fiabiliteOcr());
    }

    const liste = ajouterHistoriqueSaisie({
      source: b.origine,
      type: b.type,
      montant: valeur,
      libelle: b.libelle.trim() || "Opération",
      dateOperation: b.date,
      ...(b.type === "depense" ? { enveloppe: nomEnveloppe(b.enveloppe) } : {}),
      compte: b.compte,
      texte: b.texte.slice(0, 400),
      ...(b.vignette ? { vignette: b.vignette } : {}),
    });
    setHistorique(liste);
  }

  function confirmerEnregistrement() {
    if (!confirmation) return;
    const cibles =
      confirmation.mode === "tous"
        ? brouillons
        : brouillons.filter((b) => b.id === confirmation.id);
    cibles.forEach(enregistrerBrouillon);
    const total = cibles.reduce((s, b) => s + valeurDe(b), 0);
    setBrouillons((liste) =>
      confirmation.mode === "tous" ? [] : liste.filter((b) => b.id !== confirmation.id),
    );
    setConfirmation(null);
    toast.success(
      cibles.length > 1
        ? `${cibles.length} opérations enregistrées (${formatFCFA(total)}).`
        : `Opération de ${formatFCFA(total)} enregistrée.`,
    );
    if (confirmation.mode === "tous" || brouillons.length <= 1) {
      void navigate({ to: "/" });
    }
  }

  /* ----------------------- Lecture vocale du résumé -------------------- */

  function resumeTexte(): string {
    if (brouillons.length === 0) return "Aucune opération en attente.";
    const parties = brouillons.map((b) => {
      const valeur = valeurDe(b);
      return `${b.type === "revenu" ? "Revenu" : "Dépense"} de ${valeur} francs CFA, ${
        b.libelle || "sans libellé"
      }, le ${b.date}${b.type === "depense" ? `, enveloppe ${nomEnveloppe(b.enveloppe)}` : ""}.`;
    });
    const total = brouillons.reduce((s, b) => s + valeurDe(b), 0);
    return `${brouillons.length} opération${brouillons.length > 1 ? "s" : ""} en attente. ${parties.join(
      " ",
    )} Total ${total} francs CFA.`;
  }

  const confirmationCibles =
    confirmation?.mode === "tous"
      ? brouillons
      : brouillons.filter((b) => b.id === confirmation?.id);
  const totalConfirmation = confirmationCibles.reduce((s, b) => s + valeurDe(b), 0);
  const galerie = historique.filter((h) => h.vignette);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Saisie intelligente</h1>
        <p className="text-sm text-muted-foreground">
          Photographiez plusieurs tickets ou dictez vos opérations : montant, date, libellé et
          enveloppe sont extraits, les doublons signalés et vos habitudes mémorisées.
        </p>
      </header>

      <section className="carte space-y-3 p-4">
        <p className="text-sm font-semibold">1. Capturer l'information</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fichier.current?.click()}
            disabled={progression !== null}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {progression !== null ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-3.5 w-3.5" aria-hidden />
            )}
            {progression !== null ? "Lecture…" : "Photos de tickets"}
          </button>
          <button
            type="button"
            onClick={basculerDictee}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold ${
              ecoute
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {ecoute ? (
              <MicOff className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Mic className="h-3.5 w-3.5" aria-hidden />
            )}
            {ecoute ? "Arrêter" : "Dicter"}
          </button>
        </div>
        {progression && (
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground">
            {progression}
          </p>
        )}
        <input
          ref={fichier}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const liste = Array.from(e.target.files ?? []);
            if (liste.length > 0) void lireImages(liste);
            e.target.value = "";
          }}
        />

        <p className="text-[11px] text-muted-foreground">
          Astuce : dictez plusieurs opérations d'affilée en disant « puis » entre chacune, ou une
          commande de navigation comme « ouvre les enveloppes ».
        </p>

        <div>
          <label htmlFor="texte-source" className="text-xs font-medium text-muted-foreground">
            Texte reconnu (modifiable)
          </label>
          <textarea
            id="texte-source"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={4}
            placeholder="Exemple : dépense essence cinq mille francs hier puis dépense marché deux mille francs"
            className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => analyser(texte)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-input px-3 py-2 text-xs font-semibold"
          >
            <ScanText className="h-4 w-4" aria-hidden />
            Analyser ce texte
          </button>
        </div>
      </section>

      {fiabilite && fiabilite.lectures > 0 && (
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-primary" aria-hidden />
            Fiabilité de la lecture des tickets
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <p className="rounded-xl bg-muted/50 px-3 py-2">
              Tickets appris : <span className="font-semibold">{fiabilite.lectures}</span>
            </p>
            <p className="rounded-xl bg-muted/50 px-3 py-2">
              Lus sans correction :{" "}
              <span className="font-semibold">{fiabilite.tauxSansCorrection} %</span>
            </p>
            <p className="rounded-xl bg-muted/50 px-3 py-2">
              Commerçants mémorisés : <span className="font-semibold">{fiabilite.regles}</span>
            </p>
            <p className="rounded-xl bg-muted/50 px-3 py-2">
              Montants corrigés :{" "}
              <span className="font-semibold">{fiabilite.montantsCorriges}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{fiabilite.conseil}</p>
        </section>
      )}



      {brouillons.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              2. Vérifier et corriger ({brouillons.length} en attente)
            </p>
            {syntheseDisponible() && (
              <button
                type="button"
                onClick={() => lireAVoixHaute(resumeTexte())}
                className="flex items-center gap-1.5 rounded-lg border border-input px-2 py-1.5 text-xs font-semibold"
              >
                <Volume2 className="h-3.5 w-3.5" aria-hidden />
                Écouter le résumé
              </button>
            )}
          </div>

          {brouillons.map((b) => {
            const valeur = valeurDe(b);
            const doublon = detecterDoublon(operationsSimples, {
              type: b.type,
              montant: valeur,
              libelle: b.libelle,
              date: b.date,
            });
            const recurrence = detecterRecurrence(operationsSimples, {
              libelle: b.libelle,
              type: b.type,
              date: b.date,
            });
            const apprise = suggererEnveloppe(b.libelle);
            return (
              <article key={b.id} className="carte space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {b.origine === "ocr" ? "Ticket photographié" : "Dictée / texte"}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    Fiabilité {Math.round(b.confiance * 100)} %
                  </span>
                </div>

                {b.vignette && (
                  <img
                    src={b.vignette}
                    alt={`Ticket ${b.libelle || "sans libellé"}`}
                    loading="lazy"
                    className="h-24 w-auto rounded-lg border border-border object-cover"
                  />
                )}

                {(b.explication || (b.ajustements?.length ?? 0) > 0) && (
                  <div className="space-y-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                    {b.explication && (
                      <p className="flex items-start gap-1.5">
                        <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{b.explication}</span>
                      </p>
                    )}
                    {(b.ajustements?.length ?? 0) > 0 && (
                      <p className="font-medium text-foreground">
                        Appris de vos corrections : {b.ajustements?.join(", ")}.
                      </p>
                    )}
                  </div>
                )}



                {b.verdict && (
                  <div
                    className={`space-y-2 rounded-xl border px-3 py-2.5 text-xs ${
                      b.verdict.verdict === "authentique"
                        ? "border-primary/40 bg-accent/50 text-accent-foreground"
                        : b.verdict.verdict === "a_verifier"
                          ? "border-amber-500/50 bg-amber-500/10 text-foreground"
                          : "border-destructive/50 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                      {b.verdict.verdict === "authentique"
                        ? "Ticket vérifié"
                        : b.verdict.verdict === "a_verifier"
                          ? "Ticket à contrôler"
                          : "Ticket douteux"}{" "}
                      — {b.verdict.score}/100
                    </p>
                    <p>{b.verdict.resume}</p>
                    <ul className="space-y-1">
                      {b.verdict.indices.slice(0, 5).map((ind) => (
                        <li key={ind.code} className="flex items-start gap-1.5">
                          <span aria-hidden>
                            {ind.niveau === "alerte"
                              ? "⛔"
                              : ind.niveau === "attention"
                                ? "⚠️"
                                : "✅"}
                          </span>
                          <span>{ind.message}</span>
                        </li>
                      ))}
                    </ul>
                    {b.verdict.montantRecoupe !== null && (
                      <p className="font-medium">
                        Montant recoupé sur le total imprimé :{" "}
                        {formatFCFA(b.verdict.montantRecoupe)}.
                      </p>
                    )}
                    {b.verdict.blocageRecommande && (
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={Boolean(b.certifie)}
                          onChange={(e) => majBrouillon(b.id, { certifie: e.target.checked })}
                          className="h-4 w-4"
                        />
                        J'ai vérifié ce ticket, je l'enregistre quand même.
                      </label>
                    )}
                  </div>
                )}

                {doublon && (
                  <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <CopyCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Doublon probable : « {doublon.libelle} » de {formatFCFA(doublon.montant)} le{" "}
                    {doublon.date.slice(0, 10)} existe déjà.
                  </p>
                )}

                {recurrence && (
                  <p className="flex items-start gap-2 rounded-xl bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
                    <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Opération récurrente : {recurrence.occurrences} fois, environ tous les{" "}
                    {recurrence.intervalleMoyen} jours ({formatFCFA(recurrence.montantMoyen)} en
                    moyenne). Prochaine attendue le {recurrence.prochaineDate}.
                  </p>
                )}

                {apprise && b.type === "depense" && apprise === b.enveloppe && (
                  <p className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                    <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Enveloppe proposée d'après vos saisies précédentes pour ce commerçant.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {(["depense", "revenu"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={b.type === t}
                      onClick={() => majBrouillon(b.id, { type: t })}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                        b.type === t
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-input bg-background/60 text-muted-foreground"
                      }`}
                    >
                      {t === "depense" ? "Dépense" : "Revenu"}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor={`montant-${b.id}`} className="text-sm font-medium">
                    Montant (FCFA)
                  </label>
                  <input
                    id={`montant-${b.id}`}
                    inputMode="numeric"
                    value={grouperMontant(b.montant)}
                    onChange={(e) =>
                      majBrouillon(b.id, { montant: e.target.value.replace(/[^\d]/g, "") })
                    }
                    className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 text-xl font-bold outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label htmlFor={`libelle-${b.id}`} className="text-sm font-medium">
                    Libellé
                  </label>
                  <input
                    id={`libelle-${b.id}`}
                    value={b.libelle}
                    onChange={(e) => majBrouillon(b.id, { libelle: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {b.type === "depense" ? (
                  <div>
                    <label htmlFor={`enveloppe-${b.id}`} className="text-sm font-medium">
                      Enveloppe
                    </label>
                    <select
                      id={`enveloppe-${b.id}`}
                      value={b.enveloppe}
                      onChange={(e) => majBrouillon(b.id, { enveloppe: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                    >
                      {enveloppes.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.emoji} {e.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor={`source-${b.id}`} className="text-sm font-medium">
                      Source du revenu
                    </label>
                    <select
                      id={`source-${b.id}`}
                      value={b.source}
                      onChange={(e) => majBrouillon(b.id, { source: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                    >
                      {sourcesRevenu.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`compte-${b.id}`} className="text-sm font-medium">
                      Compte
                    </label>
                    <select
                      id={`compte-${b.id}`}
                      value={b.compte}
                      onChange={(e) => majBrouillon(b.id, { compte: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                    >
                      {comptes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`date-${b.id}`} className="text-sm font-medium">
                      Date
                    </label>
                    <input
                      id={`date-${b.id}`}
                      type="date"
                      value={b.date}
                      onChange={(e) => majBrouillon(b.id, { date: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBrouillons((l) => l.filter((x) => x.id !== b.id))}
                    className="rounded-xl border border-input px-3 py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    Ignorer
                  </button>
                  <button
                    type="button"
                    onClick={() => demanderEnregistrement("un", b.id)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Enregistrer
                  </button>
                </div>
              </article>
            );
          })}

          {brouillons.length > 1 && (
            <button
              type="button"
              onClick={() => demanderEnregistrement("tous")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-lg active:scale-[0.98]"
            >
              <Check className="h-4 w-4" aria-hidden />
              Tout enregistrer ({brouillons.length})
            </button>
          )}
        </section>
      )}

      {/* Historique et galerie */}
      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setOngletBas((o) => (o === "historique" ? null : "historique"))}
          className="flex w-full items-center justify-between rounded-2xl border border-input bg-background/60 px-4 py-3 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4" aria-hidden />
            Historique des saisies ({historique.length})
          </span>
          <ChevronRight
            className={`h-4 w-4 transition-transform ${ongletBas === "historique" ? "rotate-90" : ""}`}
            aria-hidden
          />
        </button>

        {ongletBas === "historique" && (
          <div className="carte space-y-2 p-4">
            {historique.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune saisie enregistrée.</p>
            ) : (
              <>
                {historique.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {h.libelle} · {formatFCFA(h.montant)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {h.type === "revenu" ? "Revenu" : "Dépense"} ·{" "}
                        {h.source === "ocr"
                          ? "Ticket"
                          : h.source === "dictee"
                            ? "Dictée"
                            : "Manuel"}{" "}
                        · {h.dateOperation} · {h.compte}
                        {h.enveloppe ? ` · ${h.enveloppe}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setASupprimer(h)}
                      aria-label={`Supprimer la saisie ${h.libelle}`}
                      title="Supprimer de l'historique"
                      className="shrink-0 rounded-lg border border-input p-1.5 text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setViderDemande(true)}
                  className="w-full rounded-xl border border-input px-3 py-2 text-xs font-semibold text-destructive"
                >
                  Vider l'historique
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setOngletBas((o) => (o === "galerie" ? null : "galerie"))}
          className="flex w-full items-center justify-between rounded-2xl border border-input bg-background/60 px-4 py-3 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <Images className="h-4 w-4" aria-hidden />
            Galerie des tickets ({galerie.length})
          </span>
          <ChevronRight
            className={`h-4 w-4 transition-transform ${ongletBas === "galerie" ? "rotate-90" : ""}`}
            aria-hidden
          />
        </button>

        {ongletBas === "galerie" && (
          <div className="carte p-4">
            {galerie.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun ticket photographié pour le moment.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {galerie.map((h) => (
                  <figure key={h.id} className="space-y-1">
                    <img
                      src={h.vignette}
                      alt={`Ticket ${h.libelle}`}
                      loading="lazy"
                      className="h-24 w-full rounded-lg border border-border object-cover"
                    />
                    <figcaption className="truncate text-[10px] text-muted-foreground">
                      {h.libelle} · {formatFCFA(h.montant)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <Confirmation
        ouvert={confirmation !== null}
        titre={
          confirmation?.mode === "tous"
            ? "Confirmer toutes les opérations"
            : "Confirmer l'opération"
        }
        message={
          confirmation?.mode === "tous"
            ? `Enregistrer ${confirmationCibles.length} opérations pour un total de ${formatFCFA(totalConfirmation)} ?`
            : `Enregistrer cette opération de ${formatFCFA(totalConfirmation)} ?`
        }
        details={confirmationCibles.map((b) => ({
          label: `${b.type === "revenu" ? "Revenu" : "Dépense"} · ${b.date}`,
          apres: `${b.libelle || "Opération"} — ${formatFCFA(valeurDe(b))} · ${
            b.type === "revenu" ? b.source : nomEnveloppe(b.enveloppe)
          } · ${b.compte}`,
        }))}
        onAnnuler={() => setConfirmation(null)}
        onConfirmer={confirmerEnregistrement}
      />

      <Confirmation
        ouvert={aSupprimer !== null}
        titre="Supprimer de l'historique"
        message={`Retirer « ${aSupprimer?.libelle ?? ""} » de l'historique des saisies ? L'opération enregistrée dans vos comptes reste inchangée.`}
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={() => {
          if (aSupprimer) setHistorique(supprimerHistoriqueSaisie(aSupprimer.id));
          setASupprimer(null);
          toast.success("Saisie retirée de l'historique.");
        }}
      />

      <Confirmation
        ouvert={viderDemande}
        titre="Vider l'historique"
        message="Effacer tout l'historique des saisies et la galerie de tickets ? Vos opérations enregistrées ne sont pas supprimées."
        onAnnuler={() => setViderDemande(false)}
        onConfirmer={() => {
          setHistorique(viderHistoriqueSaisies());
          setViderDemande(false);
          toast.success("Historique vidé.");
        }}
      />
    </div>
  );
}
