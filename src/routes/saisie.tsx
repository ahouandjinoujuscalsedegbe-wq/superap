import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Mic, MicOff, Loader2, ScanText, Check } from "lucide-react";
import { COMPTES, useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";
import { analyserTexte, type OperationExtraite } from "@/lib/extraction";
import { creerDictee, dicteeDisponible } from "@/lib/dictee";
import { Confirmation } from "@/components/Confirmation";

export const Route = createFileRoute("/saisie")({
  head: () => ({
    meta: [
      { title: "Saisie intelligente — Photo de ticket et dictée vocale" },
      {
        name: "description",
        content:
          "Photographiez un ticket ou dictez votre opération : l'application extrait le montant, la date et le libellé en FCFA.",
      },
      { property: "og:title", content: "Saisie intelligente — SUPER APP" },
      {
        property: "og:description",
        content: "OCR de tickets et dictée vocale pour enregistrer vos opérations en francs CFA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaisieIntelligente,
});

function SaisieIntelligente() {
  const { ajouterTransaction, enveloppes, comptes, sourcesRevenu } = useSuperApp();
  const navigate = useNavigate();

  const [texte, setTexte] = useState("");
  const [progression, setProgression] = useState<number | null>(null);
  const [ecoute, setEcoute] = useState(false);
  const [extrait, setExtrait] = useState<OperationExtraite | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);
  const reco = useRef<ReturnType<typeof creerDictee>>(null);

  // Champs corrigeables avant enregistrement.
  const [type, setType] = useState<"revenu" | "depense">("depense");
  const [montant, setMontant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [enveloppe, setEnveloppe] = useState(enveloppes[0]?.id ?? "");
  const [source, setSource] = useState(sourcesRevenu[0] ?? "Salaire");
  const [compte, setCompte] = useState(comptes[0] ?? COMPTES[0]);

  useEffect(() => {
    return () => {
      reco.current?.stop();
    };
  }, []);

  function appliquer(resultat: OperationExtraite) {
    setExtrait(resultat);
    setType(resultat.type);
    setMontant(resultat.montant ? String(resultat.montant) : "");
    setLibelle(resultat.libelle);
    setDate(resultat.date);
    if (resultat.indiceEnveloppe) setEnveloppe(resultat.indiceEnveloppe);
  }

  function analyser(source_: string) {
    if (!source_.trim()) {
      toast.error("Aucun texte à analyser.");
      return;
    }
    appliquer(analyserTexte(source_, enveloppes));
  }

  async function lireImage(f: File) {
    setProgression(0);
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const resultat = await Tesseract.recognize(f, "fra", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgression(Math.round(m.progress * 100));
        },
      });
      const lu = resultat.data.text ?? "";
      setTexte(lu);
      if (!lu.trim()) {
        toast.error("Aucun texte lisible sur l'image. Reprenez la photo bien à plat et éclairée.");
      } else {
        appliquer(analyserTexte(lu, enveloppes));
        toast.success("Ticket analysé. Vérifiez les informations avant d'enregistrer.");
      }
    } catch {
      toast.error("La lecture du ticket a échoué. Réessayez avec une photo plus nette.");
    } finally {
      setProgression(null);
    }
  }

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
        if (definitif) appliquer(analyserTexte(t, enveloppes));
      },
      (message) => {
        toast.error(message);
        setEcoute(false);
      },
      () => setEcoute(false),
    );
    reco.current = instance;
    instance?.start();
    setEcoute(true);
  }

  const valeur = Number(montant.replace(/\s/g, "")) || 0;

  function demanderEnregistrement() {
    if (valeur <= 0) {
      toast.error("Le montant doit être supérieur à zéro.");
      return;
    }
    if (type === "depense" && !enveloppe) {
      toast.error("Choisissez une enveloppe pour cette dépense.");
      return;
    }
    setConfirmation(true);
  }

  function enregistrer() {
    ajouterTransaction({
      type,
      montant: valeur,
      libelle: libelle.trim() || (type === "revenu" ? source : "Opération"),
      categorie: type === "revenu" ? source : enveloppe,
      compte,
      date: new Date(date).toISOString(),
    });
    setConfirmation(false);
    toast.success(
      `${type === "revenu" ? "Revenu" : "Dépense"} de ${formatFCFA(valeur)} enregistré${type === "revenu" ? "" : "e"}.`,
    );
    navigate({ to: "/" });
  }

  const nomEnveloppe = enveloppes.find((e) => e.id === enveloppe)?.nom ?? "—";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Saisie intelligente</h1>
        <p className="text-sm text-muted-foreground">
          Photographiez un ticket ou dictez votre opération : le montant, la date et le libellé sont
          extraits automatiquement.
        </p>
      </header>

      <section className="carte space-y-3 p-4">
        <p className="text-sm font-semibold">1. Capturer l'information</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fichier.current?.click()}
            disabled={progression !== null}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {progression !== null ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-4 w-4" aria-hidden />
            )}
            {progression !== null ? `Lecture ${progression}%` : "Photo du ticket"}
          </button>
          <button
            type="button"
            onClick={basculerDictee}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${
              ecoute
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {ecoute ? (
              <MicOff className="h-4 w-4" aria-hidden />
            ) : (
              <Mic className="h-4 w-4" aria-hidden />
            )}
            {ecoute ? "Arrêter" : "Dicter"}
          </button>
        </div>
        <input
          ref={fichier}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void lireImage(f);
            e.target.value = "";
          }}
        />

        <div>
          <label htmlFor="texte-source" className="text-xs font-medium text-muted-foreground">
            Texte reconnu (modifiable)
          </label>
          <textarea
            id="texte-source"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={4}
            placeholder="Exemple : dépense essence cinq mille francs hier"
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

      {extrait && (
        <section className="carte space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">2. Vérifier et corriger</p>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              Fiabilité {Math.round(extrait.confiance * 100)} %
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["depense", "revenu"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  type === t
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-input bg-background/60 text-muted-foreground"
                }`}
              >
                {t === "depense" ? "Dépense" : "Revenu"}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="montant-extrait" className="text-sm font-medium">
              Montant (FCFA)
            </label>
            <input
              id="montant-extrait"
              inputMode="numeric"
              value={montant}
              onChange={(e) => setMontant(e.target.value.replace(/[^\d]/g, ""))}
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 text-xl font-bold outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="libelle-extrait" className="text-sm font-medium">
              Libellé
            </label>
            <input
              id="libelle-extrait"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {type === "depense" ? (
            <div>
              <label htmlFor="enveloppe-extrait" className="text-sm font-medium">
                Enveloppe
              </label>
              <select
                id="enveloppe-extrait"
                value={enveloppe}
                onChange={(e) => setEnveloppe(e.target.value)}
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
              <label htmlFor="source-extrait" className="text-sm font-medium">
                Source du revenu
              </label>
              <select
                id="source-extrait"
                value={source}
                onChange={(e) => setSource(e.target.value)}
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
              <label htmlFor="compte-extrait" className="text-sm font-medium">
                Compte
              </label>
              <select
                id="compte-extrait"
                value={compte}
                onChange={(e) => setCompte(e.target.value)}
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
              <label htmlFor="date-extrait" className="text-sm font-medium">
                Date
              </label>
              <input
                id="date-extrait"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={demanderEnregistrement}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-semibold text-primary-foreground shadow-lg active:scale-[0.98]"
          >
            <Check className="h-4 w-4" aria-hidden />
            Enregistrer l'opération
          </button>
        </section>
      )}

      <Confirmation
        ouvert={confirmation}
        titre="Confirmer l'opération"
        message={`Enregistrer ${type === "revenu" ? "un revenu" : "une dépense"} de ${formatFCFA(valeur)} ?`}
        details={[
          { libelle: "Type", valeur: type === "revenu" ? "Revenu" : "Dépense" },
          { libelle: "Montant", valeur: formatFCFA(valeur) },
          { libelle: "Libellé", valeur: libelle || "—" },
          {
            libelle: type === "revenu" ? "Source" : "Enveloppe",
            valeur: type === "revenu" ? source : nomEnveloppe,
          },
          { libelle: "Compte", valeur: compte },
          { libelle: "Date", valeur: date },
        ]}
        onAnnuler={() => setConfirmation(false)}
        onConfirmer={enregistrer}
      />
    </div>
  );
}
