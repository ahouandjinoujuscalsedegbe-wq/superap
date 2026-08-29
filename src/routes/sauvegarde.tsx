import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Download,
  FileText,
  History,
  Lock,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { BoutonRetour } from "@/components/BoutonRetour";
import { Confirmation } from "@/components/Confirmation";
import { ErreurPopup } from "@/components/ErreurPopup";
import { useSuperApp, type Etat } from "@/lib/store";
import {
  analyserFichier,
  chiffrer,
  dechiffrer,
  enregistrerPoint,
  horodatageFichier,
  lireSauvegardes,
  supprimerPoint,
  telecharger,
  versCsv,
  viderPoints,
  type SauvegardeAuto,
} from "@/lib/sauvegarde";

export const Route = createFileRoute("/sauvegarde")({
  head: () => ({
    meta: [
      { title: "Sauvegarde et chiffrement local — SUPER APP" },
      {
        name: "description",
        content:
          "Exportez vos données chiffrées avec une phrase secrète, restaurez une sauvegarde et gérez vos points de restauration locaux.",
      },
      { property: "og:title", content: "Sauvegarde et chiffrement local" },
      {
        property: "og:description",
        content:
          "Export chiffré AES-GCM, export lisible JSON/CSV et restauration confirmée, entièrement hors ligne.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageSauvegarde,
});

type ActionEnAttente =
  | { genre: "restaurer"; etat: Partial<Etat>; source: string }
  | { genre: "supprimerPoint"; id: string }
  | { genre: "viderPoints" };

function PageSauvegarde() {
  const app = useSuperApp();
  const [phrase, setPhrase] = useState("");
  const [phrase2, setPhrase2] = useState("");
  const [phraseImport, setPhraseImport] = useState("");
  const [texteFichier, setTexteFichier] = useState("");
  const [nomFichier, setNomFichier] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [points, setPoints] = useState<SauvegardeAuto[]>(() =>
    typeof window === "undefined" ? [] : lireSauvegardes(),
  );
  const [attente, setAttente] = useState<ActionEnAttente | null>(null);

  const resume = useMemo(
    () => [
      { label: "Opérations", valeur: app.transactions.length },
      { label: "Enveloppes", valeur: app.enveloppes.length },
      { label: "Dépenses planifiées", valeur: app.budgets.length },
      { label: "Dettes & créances", valeur: app.dettes.length },
      { label: "Transferts", valeur: app.transferts.length },
      { label: "Comptes", valeur: app.comptes.length },
    ],
    [app],
  );

  async function exporterChiffre() {
    if (phrase.length < 6) {
      setErreur("La phrase secrète doit contenir au moins 6 caractères.");
      return;
    }
    if (phrase !== phrase2) {
      setErreur("Les deux phrases secrètes saisies ne sont pas identiques.");
      return;
    }
    try {
      const enveloppe = await chiffrer(app.etatComplet(), phrase);
      telecharger(
        `superapp-sauvegarde-${horodatageFichier()}.sadc`,
        JSON.stringify(enveloppe, null, 2),
      );
      setInfo("Sauvegarde chiffrée téléchargée. Conservez bien votre phrase secrète.");
    } catch {
      setErreur("Le chiffrement a échoué sur cet appareil.");
    }
  }

  function exporterLisible(format: "json" | "csv") {
    const etat = app.etatComplet();
    if (format === "json") {
      telecharger(
        `superapp-export-${horodatageFichier()}.json`,
        JSON.stringify(etat, null, 2),
      );
    } else {
      telecharger(
        `superapp-operations-${horodatageFichier()}.csv`,
        versCsv(etat),
        "text/csv;charset=utf-8",
      );
    }
    setInfo("Export lisible téléchargé.");
  }

  async function choisirFichier(fichier: File | undefined) {
    if (!fichier) return;
    setNomFichier(fichier.name);
    setTexteFichier(await fichier.text());
    setInfo("");
  }

  async function preparerRestauration() {
    if (!texteFichier) {
      setErreur("Choisissez d'abord un fichier de sauvegarde.");
      return;
    }
    try {
      const analyse = analyserFichier(texteFichier);
      let donnees: Partial<Etat>;
      if (analyse.chiffre) {
        if (!phraseImport) {
          setErreur("Saisissez la phrase secrète de cette sauvegarde chiffrée.");
          return;
        }
        donnees = await dechiffrer<Partial<Etat>>(analyse.enveloppe!, phraseImport);
      } else {
        donnees = analyse.donnees as Partial<Etat>;
      }
      if (!donnees || typeof donnees !== "object" || !Array.isArray(donnees.transactions)) {
        setErreur("Ce fichier ne contient pas de données SUPER APP valides.");
        return;
      }
      setAttente({ genre: "restaurer", etat: donnees, source: nomFichier || "fichier importé" });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Fichier illisible.");
    }
  }

  function creerPoint() {
    enregistrerPoint(app.etatComplet());
    setPoints(lireSauvegardes());
    setInfo("Point de restauration enregistré sur cet appareil.");
  }

  function confirmer() {
    if (!attente) return;
    if (attente.genre === "restaurer") {
      // Sécurité : on garde une copie de l'état actuel avant d'écraser.
      enregistrerPoint(app.etatComplet());
      app.remplacerEtat(attente.etat);
      setPoints(lireSauvegardes());
      setInfo("Données restaurées. Un point de restauration de l'état précédent a été créé.");
    } else if (attente.genre === "supprimerPoint") {
      supprimerPoint(attente.id);
      setPoints(lireSauvegardes());
    } else {
      viderPoints();
      setPoints([]);
    }
    setAttente(null);
  }

  const detailsAttente =
    attente?.genre === "restaurer"
      ? [
          { label: "Source", apres: attente.source },
          {
            label: "Opérations",
            avant: String(app.transactions.length),
            apres: String(attente.etat.transactions?.length ?? 0),
          },
          {
            label: "Enveloppes",
            avant: String(app.enveloppes.length),
            apres: String(attente.etat.enveloppes?.length ?? 0),
          },
          {
            label: "Dépenses planifiées",
            avant: String(app.budgets.length),
            apres: String(attente.etat.budgets?.length ?? 0),
          },
          {
            label: "Dettes & créances",
            avant: String(app.dettes.length),
            apres: String(attente.etat.dettes?.length ?? 0),
          },
        ]
      : undefined;

  return (
    <div className="space-y-5 pb-8">
      <header className="space-y-2">
        <BoutonRetour to="/parametres" label="Retour aux paramètres" />
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          Sauvegarde et chiffrement
        </h1>
        <p className="text-sm text-muted-foreground">
          Tout le chiffrement se fait sur cet appareil (AES-GCM 256 bits, clé dérivée de votre
          phrase secrète). Aucune donnée n'est envoyée sur Internet.
        </p>
      </header>

      {info ? (
        <p className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">{info}</p>
      ) : null}

      <section className="carte p-4">
        <h2 className="font-semibold">Contenu à sauvegarder</h2>
        <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {resume.map((r) => (
            <li key={r.label} className="rounded-xl border border-border px-3 py-2">
              <span className="block text-xs text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.valeur}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4 text-primary" aria-hidden /> Export chiffré
        </h2>
        <p className="text-xs text-muted-foreground">
          Sans la phrase secrète, le fichier est illisible — y compris pour vous. Notez-la
          soigneusement.
        </p>
        <label className="block text-sm font-medium" htmlFor="phrase">
          Phrase secrète
        </label>
        <input
          id="phrase"
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
          placeholder="Au moins 6 caractères"
        />
        <label className="block text-sm font-medium" htmlFor="phrase2">
          Confirmer la phrase secrète
        </label>
        <input
          id="phrase2"
          type="password"
          value={phrase2}
          onChange={(e) => setPhrase2(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void exporterChiffre()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Download className="h-4 w-4" aria-hidden /> Télécharger la sauvegarde chiffrée
        </button>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-primary" aria-hidden /> Export lisible
        </h2>
        <p className="text-xs text-muted-foreground">
          Pour vos archives personnelles : ces fichiers ne sont pas chiffrés.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => exporterLisible("json")}
            className="rounded-xl border border-input px-3 py-2 text-sm font-semibold"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => exporterLisible("csv")}
            className="rounded-xl border border-input px-3 py-2 text-sm font-semibold"
          >
            Export CSV
          </button>
        </div>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Upload className="h-4 w-4 text-primary" aria-hidden /> Restaurer une sauvegarde
        </h2>
        <input
          type="file"
          accept=".sadc,.json,application/json"
          onChange={(e) => void choisirFichier(e.target.files?.[0])}
          className="w-full text-xs"
          aria-label="Choisir un fichier de sauvegarde"
        />
        {nomFichier ? (
          <p className="text-xs text-muted-foreground">Fichier sélectionné : {nomFichier}</p>
        ) : null}
        <label className="block text-sm font-medium" htmlFor="phraseImport">
          Phrase secrète (si le fichier est chiffré)
        </label>
        <input
          id="phraseImport"
          type="password"
          value={phraseImport}
          onChange={(e) => setPhraseImport(e.target.value)}
          className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void preparerRestauration()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Vérifier et restaurer
        </button>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="h-4 w-4 text-primary" aria-hidden /> Points de restauration locaux
        </h2>
        <p className="text-xs text-muted-foreground">
          10 points maximum, conservés sur cet appareil. Un point est créé automatiquement avant
          chaque restauration.
        </p>
        <button
          type="button"
          onClick={creerPoint}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <Archive className="h-4 w-4" aria-hidden /> Créer un point maintenant
        </button>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun point enregistré pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {points.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <span>
                  {new Date(p.creeLe).toLocaleString("fr-FR")}
                  <span className="block text-xs text-muted-foreground">
                    {Math.max(1, Math.round(p.taille / 1024))} Ko
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Restaurer ce point"
                    title="Restaurer ce point"
                    onClick={() =>
                      setAttente({
                        genre: "restaurer",
                        etat: JSON.parse(p.contenu) as Partial<Etat>,
                        source: `Point du ${new Date(p.creeLe).toLocaleString("fr-FR")}`,
                      })
                    }
                    className="rounded-lg border border-input p-2"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer ce point"
                    title="Supprimer ce point"
                    onClick={() => setAttente({ genre: "supprimerPoint", id: p.id })}
                    className="rounded-lg border border-destructive/40 p-2 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {points.length > 0 ? (
          <button
            type="button"
            onClick={() => setAttente({ genre: "viderPoints" })}
            className="w-full rounded-xl border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive"
          >
            Supprimer tous les points
          </button>
        ) : null}
      </section>

      <Confirmation
        ouvert={attente !== null}
        titre={
          attente?.genre === "restaurer"
            ? "Confirmer la restauration"
            : attente?.genre === "supprimerPoint"
              ? "Supprimer ce point"
              : "Supprimer tous les points"
        }
        message={
          attente?.genre === "restaurer"
            ? "Les données actuelles seront remplacées par celles de la sauvegarde. Un point de restauration sera créé avant."
            : "Cette suppression est définitive sur cet appareil."
        }
        details={detailsAttente}
        confirmerLabel={attente?.genre === "restaurer" ? "Restaurer" : "Supprimer"}
        danger
        onConfirmer={confirmer}
        onAnnuler={() => setAttente(null)}
      />

      <ErreurPopup ouvert={erreur !== ""} message={erreur} onFermer={() => setErreur("")} />
    </div>
  );
}
