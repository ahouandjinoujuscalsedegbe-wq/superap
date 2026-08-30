import { useState } from "react";
import { KeyRound, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSuperApp, type Etat } from "@/lib/store";
import { analyserFichier, dechiffrer } from "@/lib/sauvegarde";
import { consigner } from "@/lib/journal-donnees";

/**
 * Restauration guidée depuis un export chiffré (.sadc) ou lisible (.json),
 * avec accompagnement pas à pas sur la phrase secrète.
 */
export function SectionRestauration() {
  const app = useSuperApp();
  const [nomFichier, setNomFichier] = useState("");
  const [texte, setTexte] = useState("");
  const [chiffre, setChiffre] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function choisir(fichier: File | undefined) {
    setErreur("");
    if (!fichier) return;
    const contenu = await fichier.text();
    setNomFichier(fichier.name);
    setTexte(contenu);
    try {
      setChiffre(analyserFichier(contenu).chiffre);
    } catch {
      setChiffre(false);
      setErreur("Ce fichier n'est pas lisible : choisissez un export SUPER APP.");
    }
  }

  async function restaurer() {
    setErreur("");
    if (!texte) {
      setErreur("Choisissez d'abord un fichier de sauvegarde.");
      return;
    }
    setOccupe(true);
    try {
      const analyse = analyserFichier(texte);
      let donnees: Partial<Etat>;
      if (analyse.chiffre) {
        if (phrase.trim().length < 1) {
          setErreur("Saisissez la phrase secrète utilisée lors de l'export.");
          setOccupe(false);
          return;
        }
        donnees = await dechiffrer<Partial<Etat>>(analyse.enveloppe!, phrase.trim());
      } else {
        donnees = analyse.donnees as Partial<Etat>;
      }
      if (!donnees || typeof donnees !== "object" || !Array.isArray(donnees.transactions)) {
        setErreur("Ce fichier ne contient pas de données SUPER APP valides.");
        setOccupe(false);
        return;
      }
      app.remplacerEtat(donnees);
      consigner("restauration", `Depuis ${nomFichier || "fichier importé"}.`);
      toast.success("Données restaurées avec succès.");
      setTexte("");
      setNomFichier("");
      setPhrase("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Restauration impossible.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <section className="carte space-y-3 p-4" data-test="section-restauration">
      <h2 className="flex items-center gap-2 font-semibold">
        <Upload className="h-4 w-4" aria-hidden /> Restaurer mes données
      </h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Choisissez votre fichier de sauvegarde (.sadc chiffré ou .json lisible).</li>
        <li>Saisissez la phrase secrète notée lors de l'export si le fichier est chiffré.</li>
        <li>Lancez la restauration : vos données remplacent celles de l'appareil.</li>
      </ol>

      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold">
        <Upload className="h-4 w-4" aria-hidden />
        {nomFichier || "Choisir un fichier de sauvegarde"}
        <input
          type="file"
          accept=".sadc,.json,application/json,text/plain"
          className="hidden"
          onChange={(e) => choisir(e.target.files?.[0])}
        />
      </label>

      {chiffre && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="phrase-restau">
            <KeyRound className="h-4 w-4" aria-hidden /> Phrase secrète
          </label>
          <input
            id="phrase-restau"
            type="password"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="Celle utilisée lors de l'export"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            La phrase n'est stockée nulle part : sans elle, le fichier reste illisible, même pour
            l'application.
          </p>
        </div>
      )}

      {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}

      <button
        type="button"
        onClick={restaurer}
        disabled={occupe || !texte}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {occupe ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Restaurer maintenant
      </button>
    </section>
  );
}
