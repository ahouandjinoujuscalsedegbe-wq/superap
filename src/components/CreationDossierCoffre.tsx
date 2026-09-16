/**
 * Première connexion sur un téléphone : l'utilisateur crée lui-même le dossier
 * de son coffre local. Tant qu'il n'existe pas, l'écran le demande.
 */

import { useEffect, useState } from "react";
import { FolderLock } from "lucide-react";
import { toast } from "sonner";
import { creerDossier, dossierAcreer, nomDossierValide } from "@/lib/coffre-dossier";

export function CreationDossierCoffre() {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    setOuvert(dossierAcreer());
  }, []);

  if (!ouvert) return null;

  async function valider(ev: React.FormEvent) {
    ev.preventDefault();
    if (!nomDossierValide(nom)) {
      setErreur("Donnez un nom de 3 à 40 caractères (lettres, chiffres, espace, tiret).");
      return;
    }
    setEnCours(true);
    const dossier = await creerDossier(nom);
    setEnCours(false);
    if (!dossier) {
      setErreur("Le dossier n'a pas pu être créé sur cet appareil. Réessayez.");
      return;
    }
    setOuvert(false);
    toast.success(`Coffre « ${dossier.nom} » créé.`, {
      description: "Chaque saisie y sera enregistrée chiffrée, sur votre téléphone.",
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 p-4">
      <form onSubmit={valider} className="carte w-full max-w-sm space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FolderLock className="h-5 w-5 text-primary" aria-hidden />
          Créez votre coffre
        </h2>
        <p className="text-sm text-muted-foreground">
          Choisissez le nom du dossier où vos données seront enregistrées sur ce téléphone. Tout y
          est chiffré avant d'être écrit : personne ne peut le lire, même en explorant le téléphone.
        </p>
        <div>
          <label htmlFor="nom-coffre" className="text-sm font-medium">
            Nom du dossier
          </label>
          <input
            id="nom-coffre"
            value={nom}
            onChange={(ev) => {
              setNom(ev.target.value);
              setErreur(null);
            }}
            placeholder="Mon coffre"
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {enCours ? "Création…" : "Créer mon coffre"}
        </button>
      </form>
    </div>
  );
}
