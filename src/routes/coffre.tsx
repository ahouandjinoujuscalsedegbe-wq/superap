/**
 * Page indépendante de première ouverture : l'utilisateur crée lui-même le
 * dossier de son coffre local. Elle occupe tout l'écran, sans se superposer à
 * une autre page, et laisse la place au clavier interne.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FolderLock } from "lucide-react";
import { toast } from "sonner";
import { creerDossier, dossierAcreer, nomDossierValide } from "@/lib/coffre-dossier";

export const Route = createFileRoute("/coffre")({
  head: () => ({
    meta: [
      { title: "Créer mon coffre — SUPER APP" },
      {
        name: "description",
        content:
          "Première ouverture : choisissez le nom du dossier chiffré où vos données budgétaires seront enregistrées sur votre téléphone.",
      },
      { property: "og:title", content: "Créer mon coffre — SUPER APP" },
      {
        property: "og:description",
        content: "Nommez le dossier chiffré de votre coffre local, sur votre téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageCoffre,
});

function PageCoffre() {
  const navigate = useNavigate();
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const champRef = useRef<HTMLInputElement>(null);

  // Le coffre existe déjà : cette page n'a plus de raison d'être.
  useEffect(() => {
    if (!dossierAcreer()) navigate({ to: "/", replace: true });
  }, [navigate]);

  // Le clavier (interne ou du téléphone) s'ouvre dès l'affichage du champ.
  useEffect(() => {
    const t = window.setTimeout(() => champRef.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, []);

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
    toast.success(`Coffre « ${dossier.nom} » créé.`, {
      description: "Chaque saisie y sera enregistrée chiffrée, sur votre téléphone.",
    });
    navigate({ to: "/", replace: true });
  }

  return (
    <section className="min-h-[70vh] pb-[calc(var(--app-keyboard-height,0px)+2rem)] pt-4">
      <form onSubmit={valider} className="carte w-full space-y-3 p-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <FolderLock className="h-5 w-5 text-primary" aria-hidden />
          Créez votre coffre
        </h1>
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
            ref={champRef}
            value={nom}
            onChange={(ev) => {
              setNom(ev.target.value);
              setErreur(null);
            }}
            placeholder="Mon coffre"
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
    </section>
  );
}
