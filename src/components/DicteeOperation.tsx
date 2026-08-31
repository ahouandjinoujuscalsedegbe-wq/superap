import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { creerDictee, dicteeDisponible } from "@/lib/dictee";
import { analyserTexte } from "@/lib/extraction";
import { entrainerBayes, predireEnveloppe } from "@/lib/ia-locale";
import { useSuperApp } from "@/lib/store";

export type ResultatDictee = {
  montant: number;
  libelle: string;
  date: string;
  /** Enveloppe (dépense) devinée localement, si trouvée. */
  enveloppe?: string;
};

/**
 * Bouton de dictée locale : l'utilisateur dit sa dépense ou son revenu à voix
 * haute (« J'ai dépensé 2500 francs de taxi »), le texte est analysé sur
 * l'appareil puis auto-catégorisé grâce au classifieur bayésien local.
 * Aucun envoi de données : tout est traité dans le téléphone.
 */
export function DicteeOperation({
  type,
  onResultat,
}: {
  type: "depense" | "revenu";
  onResultat: (r: ResultatDictee) => void;
}) {
  const { enveloppes, transactions } = useSuperApp();
  const [ecoute, setEcoute] = useState(false);
  const [apercu, setApercu] = useState("");
  const reco = useRef<ReturnType<typeof creerDictee>>(null);

  useEffect(() => () => reco.current?.stop(), []);

  function traiter(texte: string) {
    const propre = texte.trim();
    if (!propre) {
      toast.error("Aucune parole comprise. Réessayez plus près du micro.");
      return;
    }
    const analyse = analyserTexte(propre, enveloppes);
    if (analyse.montant <= 0) {
      toast.warning(`« ${propre} » : montant non compris, complétez à la main.`);
    }

    let enveloppe = analyse.indiceEnveloppe;
    if (!enveloppe && type === "depense") {
      // Auto-catégorisation apprise des saisies précédentes.
      const prediction = predireEnveloppe(propre, entrainerBayes(transactions));
      if (prediction && prediction.confiance >= 0.55) {
        if (enveloppes.some((e) => e.id === prediction.enveloppe)) enveloppe = prediction.enveloppe;
      }
    }
    if (!enveloppe) {
      // Dernier recours : le nom de l'enveloppe « sonne » comme un mot dicté.
      const clesDites = new Set(caracteristiques(propre).map(clePhonetique));
      const trouvee = enveloppes.find((e) =>
        caracteristiques(e.nom).some((m) => clesDites.has(clePhonetique(m))),
      );
      if (trouvee) enveloppe = trouvee.id;
    }


    onResultat({
      montant: analyse.montant,
      libelle: analyse.libelle,
      date: analyse.date,
      ...(enveloppe ? { enveloppe } : {}),
    });

    const nomEnveloppe = enveloppes.find((e) => e.id === enveloppe)?.nom;
    toast.success(
      nomEnveloppe
        ? `Compris : ${analyse.libelle} → ${nomEnveloppe}`
        : `Compris : ${analyse.libelle}`,
    );
  }

  function demarrer() {
    if (!dicteeDisponible()) {
      toast.error("La dictée vocale n'est pas disponible sur cet appareil.");
      return;
    }
    const instance = creerDictee(
      (texte, definitif) => {
        setApercu(texte);
        if (definitif) traiter(texte);
      },
      (message) => {
        toast.error(message);
        setEcoute(false);
      },
      () => {
        setEcoute(false);
        setApercu("");
      },
    );
    if (!instance) return;
    reco.current = instance;
    setApercu("");
    setEcoute(true);
    instance.start();
  }

  function arreter() {
    reco.current?.stop();
    setEcoute(false);
  }

  return (
    <section className="carte space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Dicter {type === "depense" ? "la dépense" : "le revenu"}</p>
          <p className="text-xs text-muted-foreground">
            Ex. : « {type === "depense" ? "dépensé 2500 francs de taxi" : "reçu 50000 francs de salaire"} »
          </p>
        </div>
        <button
          type="button"
          onClick={ecoute ? arreter : demarrer}
          aria-label={ecoute ? "Arrêter la dictée" : "Démarrer la dictée"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
            ecoute
              ? "animate-pulse border-destructive bg-destructive/15 text-destructive"
              : "border-input bg-card text-primary"
          }`}
        >
          {ecoute ? <Square className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {ecoute && (
        <p className="text-xs italic text-muted-foreground">{apercu || "Je vous écoute…"}</p>
      )}
    </section>
  );
}
