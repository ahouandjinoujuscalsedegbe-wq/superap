/**
 * Mon compte : centre de commande du compte e-mail qui pilote toute
 * l'application. L'adresse e-mail est le compte ; le mot de passe est la clé
 * des copies chiffrées. Tout se règle ici : état de l'enregistrement
 * automatique, nom de l'appareil, récupération des données, changement de mot
 * de passe (par lien e-mail) et déconnexion.
 */

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CloudUpload, KeyRound, LogOut, RefreshCw, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

import { useSuperApp, type Etat } from "@/lib/store";
import { instantaneEtat } from "@/lib/instantane";
import {
  ecrireReglagesMulti,
  fusionnerDonneesCompte,
  lireReglagesMulti,
} from "@/lib/multi-appareil";
import { ecrireReglagesMail, lireReglagesMail, type ReglagesMail } from "@/lib/sauvegarde-email";
import {
  chercherDonneesCompte,
  compteConnecte,
  deconnecterCompte,
  deposerPremiereCopie,
  emailDuCompte,
} from "@/lib/compte-utilisateur";
import { demanderLienChangement } from "@/lib/code-confirmation.functions";

export const Route = createFileRoute("/parametres/compte")({
  head: () => ({
    meta: [
      { title: "Mon compte — SUPER APP" },
      {
        name: "description",
        content:
          "Gérez le compte e-mail qui pilote l'application : enregistrement automatique chiffré, nom de l'appareil, récupération des données, mot de passe et déconnexion.",
      },
      { property: "og:title", content: "Mon compte — SUPER APP" },
      {
        property: "og:description",
        content: "Compte e-mail, enregistrement automatique chiffré, mot de passe et appareils.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageCompteParametres,
});

function PageCompteParametres() {
  const app = useSuperApp();
  const navigate = useNavigate();
  const [reglages, setReglages] = useState<ReglagesMail>({
    email: "",
    appareil: "",
    configure: false,
    actif: false,
  });
  const [appareil, setAppareil] = useState("");
  const [connecte, setConnecte] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [enCours, setEnCours] = useState<null | "depot" | "recuperation" | "lien">(null);

  useEffect(() => {
    setReglages(lireReglagesMail());
    setAppareil(lireReglagesMulti().cetAppareil || "MON TÉLÉPHONE");
    setConnecte(compteConnecte());
  }, []);

  const email = reglages.email || emailDuCompte();

  const enregistrerAppareil = () => {
    const nom = appareil.trim() || "MON TÉLÉPHONE";
    ecrireReglagesMulti({ ...lireReglagesMulti(), cetAppareil: nom });
    const suivant = { ...lireReglagesMail(), appareil: nom };
    ecrireReglagesMail(suivant);
    setReglages(suivant);
    toast.success("Nom de cet appareil enregistré.");
  };

  const basculerAuto = () => {
    const suivant = { ...lireReglagesMail(), actif: !reglages.actif };
    ecrireReglagesMail(suivant);
    setReglages(suivant);
    toast.success(
      suivant.actif
        ? "Enregistrement automatique dans votre compte activé."
        : "Enregistrement automatique mis en pause.",
    );
  };

  const deposerMaintenant = async () => {
    setEnCours("depot");
    const ok = await deposerPremiereCopie(instantaneEtat(app as unknown as Etat), appareil);
    setEnCours(null);
    if (ok) {
      const suivant = { ...lireReglagesMail(), dernierEnvoi: new Date().toISOString() };
      ecrireReglagesMail(suivant);
      setReglages(suivant);
      toast.success("Copie chiffrée enregistrée dans votre compte.");
    } else {
      toast.error("Enregistrement impossible pour le moment : vérifiez votre réseau.");
    }
  };

  const recupererMaintenant = async () => {
    if (motDePasse.trim().length < 8) {
      toast.error("Entrez le mot de passe de votre compte (8 caractères minimum).");
      return;
    }
    setEnCours("recuperation");
    const resultat = await chercherDonneesCompte(email, motDePasse);
    setEnCours(null);
    setMotDePasse("");
    if (resultat.etat === "erreur") {
      toast.error(resultat.message);
      return;
    }
    if (resultat.etat === "vide") {
      toast.info("Aucune copie enregistrée pour l'instant dans ce compte.");
      return;
    }
    const fusion = fusionnerDonneesCompte(app as unknown as Etat, resultat.donnees);
    if (fusion.total > 0) app.remplacerEtat(fusion.etat);
    toast.success(
      fusion.total > 0
        ? `${fusion.total} élément(s) récupéré(s) depuis votre compte.`
        : "Ce téléphone était déjà à jour.",
    );
  };

  const demanderLien = async () => {
    setEnCours("lien");
    let reponse: Awaited<ReturnType<typeof demanderLienChangement>> | null = null;
    try {
      reponse = await demanderLienChangement({ data: { email, appareil } });
    } catch {
      reponse = null;
    }
    setEnCours(null);
    if (!reponse?.envoye) {
      toast.error("L'e-mail n'a pas pu être envoyé. Vérifiez votre réseau et réessayez.");
      return;
    }
    toast.success("E-mail envoyé.", {
      description: `Ouvrez la boîte de ${email} et cliquez le lien reçu : il est valable 15 minutes.`,
    });
  };

  const seDeconnecter = async () => {
    await deconnecterCompte();
    toast.success("Déconnecté de ce téléphone.", {
      description: "Vos données restent chiffrées dans votre compte e-mail.",
    });
    void navigate({ to: "/compte" });
  };

  if (!connecte) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Mon compte</h1>
        <section className="carte space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Aucun compte n'est connecté sur ce téléphone. Connectez-vous avec votre adresse e-mail
            et votre mot de passe : toutes vos données reviennent automatiquement.
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/compte" })}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            Me connecter
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Mon compte</h1>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <UserCircle2 className="h-4 w-4 text-primary" aria-hidden /> Compte connecté
        </h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Adresse e-mail</span>
            <span className="truncate font-medium">{email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Enregistrement automatique</span>
            <span className="font-medium">{reglages.actif ? "Actif" : "En pause"}</span>
          </div>
          {reglages.dernierEnvoi ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dernière copie</span>
              <span className="font-medium">
                {new Date(reglages.dernierEnvoi).toLocaleString("fr-FR")}
              </span>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Toutes vos saisies sont enregistrées chiffrées dans l'espace de cette adresse e-mail, sans
          qu'aucun e-mail ne soit envoyé. Votre mot de passe est la seule clé : notez-le en lieu sûr.
        </p>
        <button
          type="button"
          onClick={basculerAuto}
          className="w-full rounded-xl border border-input px-3 py-2.5 text-sm font-semibold"
        >
          {reglages.actif ? "Mettre l'enregistrement en pause" : "Réactiver l'enregistrement"}
        </button>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <CloudUpload className="h-4 w-4 text-primary" aria-hidden /> Cet appareil
        </h2>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">Nom de cet appareil</span>
          <input
            type="text"
            value={appareil}
            onChange={(e) => setAppareil(e.target.value)}
            placeholder="MON TÉLÉPHONE"
            className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={enregistrerAppareil}
            className="rounded-xl border border-input px-3 py-2.5 text-sm font-semibold"
          >
            Enregistrer le nom
          </button>
          <button
            type="button"
            disabled={enCours === "depot"}
            onClick={() => void deposerMaintenant()}
            className="rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enCours === "depot" ? "Enregistrement…" : "Enregistrer maintenant"}
          </button>
        </div>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <RefreshCw className="h-4 w-4 text-primary" aria-hidden /> Récupérer mes données
        </h2>
        <p className="text-xs text-muted-foreground">
          Ramène sur ce téléphone tout ce qui est enregistré dans votre compte, sans rien effacer de
          ce qui est déjà là. Votre mot de passe est nécessaire pour ouvrir les copies chiffrées.
        </p>
        <input
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          placeholder="Mot de passe du compte"
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={enCours === "recuperation"}
          onClick={() => void recupererMaintenant()}
          className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {enCours === "recuperation" ? "Récupération…" : "Récupérer mes données"}
        </button>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden /> Mot de passe du compte
        </h2>
        <p className="text-xs text-muted-foreground">
          Un e-mail contenant un lien part vers {email}. C'est en cliquant ce lien que le nouveau
          mot de passe est réellement enregistré. Le changement n'est possible que depuis un
          téléphone qui contient encore vos données.
        </p>
        <button
          type="button"
          disabled={enCours === "lien"}
          onClick={() => void demanderLien()}
          className="w-full rounded-xl border border-input px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {enCours === "lien" ? "Envoi…" : "Changer mon mot de passe"}
        </button>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <LogOut className="h-4 w-4 text-destructive" aria-hidden /> Me déconnecter
        </h2>
        <p className="text-xs text-muted-foreground">
          Ce téléphone oublie votre adresse e-mail et votre mot de passe. Les données déjà présentes
          ici ne sont pas supprimées, et vos copies chiffrées restent dans votre compte.
        </p>
        <button
          type="button"
          onClick={() => void seDeconnecter()}
          className="w-full rounded-xl border border-destructive px-3 py-2.5 text-sm font-semibold text-destructive"
        >
          Me déconnecter de ce téléphone
        </button>
      </section>
    </div>
  );
}
