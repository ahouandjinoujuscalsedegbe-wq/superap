/**
 * Page indépendante de compte : à la première ouverture sur un téléphone,
 * l'utilisateur crée son compte (adresse e-mail + mot de passe) ou se connecte
 * à un compte existant. À la connexion, les données enregistrées dans l'espace
 * chiffré de l'adresse e-mail reviennent automatiquement.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useSuperApp, type Etat } from "@/lib/store";
import { instantaneEtat } from "@/lib/instantane";
import { fusionnerDonneesCompte, lireReglagesMulti } from "@/lib/multi-appareil";
import {
  changerMotDePasse,
  chercherDonneesCompte,
  compteConnecte,
  deposerPremiereCopie,
  emailDuCompte,
  estEmailValide,
  memoriserCompte,
  motDePasseValide,
} from "@/lib/compte-utilisateur";
import {
  demanderCodeConfirmation,
  verifierCodeConfirmation,
} from "@/lib/code-confirmation.functions";

export const Route = createFileRoute("/compte")({
  head: () => ({
    meta: [
      { title: "Mon compte — SUPER APP" },
      {
        name: "description",
        content:
          "Créez votre compte ou connectez-vous avec votre adresse e-mail et votre mot de passe : vos données budgétaires reviennent automatiquement sur n'importe quel téléphone.",
      },
      { property: "og:title", content: "Mon compte — SUPER APP" },
      {
        property: "og:description",
        content: "Connexion à votre compte budgétaire chiffré, sur n'importe quel téléphone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageCompte,
});

function PageCompte() {
  const navigate = useNavigate();
  const app = useSuperApp();
  const [mode, setMode] = useState<"connexion" | "creation" | "oubli">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [jeton, setJeton] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const champRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEmail(emailDuCompte());
    const t = window.setTimeout(() => champRef.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, []);

  function terminer() {
    navigate({ to: "/", replace: true });
  }

  async function seConnecter() {
    setErreur(null);
    if (!estEmailValide(email)) {
      setErreur("Entrez une adresse e-mail valide.");
      return;
    }
    if (!motDePasseValide(motDePasse)) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setEnCours(true);
    const resultat = await chercherDonneesCompte(email, motDePasse);
    if (resultat.etat === "erreur") {
      setEnCours(false);
      setErreur(resultat.message);
      return;
    }
    if (resultat.etat === "vide") {
      setEnCours(false);
      setErreur(
        "Aucune donnée trouvée pour ce compte. Vérifiez l'adresse et le mot de passe, ou créez un compte.",
      );
      return;
    }
    await memoriserCompte(email, resultat.motDePasse);
    const fusion = fusionnerDonneesCompte(app as unknown as Etat, resultat.donnees);
    if (fusion.total > 0) app.remplacerEtat(fusion.etat);
    setEnCours(false);
    toast.success("Connecté : vos données sont de retour.", {
      description:
        fusion.total > 0
          ? `${fusion.total} élément(s) restauré(s) sur ce téléphone.`
          : "Ce téléphone était déjà à jour.",
    });
    terminer();
  }

  async function creerCompte() {
    setErreur(null);
    if (!estEmailValide(email)) {
      setErreur("Entrez une adresse e-mail valide.");
      return;
    }
    if (!motDePasseValide(motDePasse)) {
      setErreur("Choisissez un mot de passe de 8 caractères minimum.");
      return;
    }
    setEnCours(true);
    const existant = await chercherDonneesCompte(email, motDePasse);
    if (existant.etat === "trouve") {
      await memoriserCompte(email, existant.motDePasse);
      const fusion = fusionnerDonneesCompte(app as unknown as Etat, existant.donnees);
      if (fusion.total > 0) app.remplacerEtat(fusion.etat);
      setEnCours(false);
      toast.success("Ce compte existait déjà : vos données sont revenues.");
      terminer();
      return;
    }
    await memoriserCompte(email, motDePasse);
    await deposerPremiereCopie(
      instantaneEtat(app as unknown as Etat),
      lireReglagesMulti().cetAppareil,
    );
    setEnCours(false);
    toast.success("Compte créé.", {
      description:
        "Vos saisies seront enregistrées chiffrées dans l'espace de cette adresse e-mail, automatiquement.",
    });
    terminer();
  }

  /** Étape 1 : vérifie la demande puis envoie le code de confirmation par e-mail. */
  async function envoyerCode() {
    setErreur(null);
    if (!estEmailValide(email)) {
      setErreur("Entrez l'adresse e-mail de votre compte.");
      return;
    }
    if (!motDePasseValide(motDePasse)) {
      setErreur("Choisissez un nouveau mot de passe de 8 caractères minimum.");
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    const aDesDonnees =
      compteConnecte() ||
      (app.transactions?.length ?? 0) > 0 ||
      (app.comptes?.length ?? 0) > 0;
    if (!aDesDonnees) {
      setErreur(
        "Impossible ici : ce téléphone ne contient aucune de vos données et tout est chiffré avec l'ancien mot de passe. Sans lui, personne ne peut les lire. Retrouvez le mot de passe, ou utilisez le téléphone qui contient encore vos données.",
      );
      return;
    }
    setEnCours(true);
    let reponse: Awaited<ReturnType<typeof demanderCodeConfirmation>> | null = null;
    try {
      reponse = await demanderCodeConfirmation({
        data: { email: email.trim(), appareil: lireReglagesMulti().cetAppareil },
      });
    } catch {
      reponse = null;
    }
    setEnCours(false);
    if (!reponse?.envoye || !reponse.jeton) {
      setErreur(
        reponse?.message
          ? `Le code n'a pas pu être envoyé : ${reponse.message}`
          : "Le code n'a pas pu être envoyé. Vérifiez votre réseau et réessayez.",
      );
      return;
    }
    setJeton(reponse.jeton);
    setCode("");
    toast.success("Code envoyé par e-mail.", {
      description: `Ouvrez la boîte de ${email.trim()} : le code à 6 chiffres est valable 15 minutes.`,
    });
  }

  /** Étape 2 : confirme le code reçu par e-mail, puis change le mot de passe. */
  async function confirmerCode() {
    setErreur(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setErreur("Entrez le code à 6 chiffres reçu par e-mail.");
      return;
    }
    setEnCours(true);
    let verif: { valide: boolean; message?: string } | null = null;
    try {
      verif = await verifierCodeConfirmation({
        data: { email: email.trim(), code: code.trim(), jeton },
      });
    } catch {
      verif = null;
    }
    if (!verif?.valide) {
      setEnCours(false);
      setErreur(verif?.message ?? "Vérification impossible. Réessayez.");
      return;
    }
    const resultat = await changerMotDePasse(
      instantaneEtat(app as unknown as Etat),
      motDePasse,
      lireReglagesMulti().cetAppareil,
    );
    setEnCours(false);
    if (!resultat.ok) {
      setErreur("Le changement n'a pas abouti. Réessayez.");
      return;
    }
    setJeton("");
    setCode("");
    toast.success("Mot de passe changé.", {
      description: resultat.copieDeposee
        ? "Une copie complète de vos données a été enregistrée, chiffrée avec le nouveau mot de passe."
        : "Le nouveau mot de passe est actif ; la copie sera renvoyée dès que le réseau le permet.",
    });
    terminer();
  }

  const creation = mode === "creation";
  const oubli = mode === "oubli";

  return (
    <section className="min-h-[70vh] pb-[calc(var(--app-keyboard-height,0px)+2rem)] pt-4">
      <div className="carte w-full space-y-4 p-5">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          {creation ? (
            <UserPlus className="h-5 w-5 text-primary" aria-hidden />
          ) : oubli ? (
            <KeyRound className="h-5 w-5 text-primary" aria-hidden />
          ) : (
            <LogIn className="h-5 w-5 text-primary" aria-hidden />
          )}
          {creation ? "Créer mon compte" : oubli ? "Mot de passe oublié" : "Me connecter"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {oubli
            ? "Choisissez un nouveau mot de passe. C'est possible uniquement parce que vos données sont encore sur ce téléphone : une copie complète sera aussitôt enregistrée, chiffrée avec le nouveau mot de passe."
            : "Votre adresse e-mail est votre compte. Toutes vos données y sont enregistrées chiffrées, automatiquement et sans aucun e-mail envoyé. Sur n'importe quel téléphone, la même adresse et le même mot de passe ramènent tout."}
        </p>

        {!oubli && (
        <div className="flex gap-2 rounded-xl border border-border p-1">
          {(["connexion", "creation"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErreur(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "connexion" ? "J'ai déjà un compte" : "Nouveau compte"}
            </button>
          ))}
        </div>
        )}

        <form
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void (creation ? creerCompte() : oubli ? reinitialiserMotDePasse() : seConnecter());
          }}
        >
          <div>
            <label htmlFor="email-compte" className="text-sm font-medium">
              Adresse e-mail
            </label>
            <input
              id="email-compte"
              ref={champRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              data-majuscules="non"
              value={email}
              onChange={(ev) => {
                setEmail(ev.target.value);
                setErreur(null);
              }}
              placeholder="exemple@mail.com"
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="mdp-compte" className="text-sm font-medium">
              {oubli ? "Nouveau mot de passe" : "Mot de passe"}
            </label>
            <input
              id="mdp-compte"
              type="password"
              autoComplete={creation ? "new-password" : "current-password"}
              value={motDePasse}
              onChange={(ev) => {
                setMotDePasse(ev.target.value);
                setErreur(null);
              }}
              placeholder="8 caractères minimum"
              className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
            {creation || oubli ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Ce mot de passe est la seule clé de vos données chiffrées : notez-le en lieu sûr, il
                ne peut pas être retrouvé.
              </p>
            ) : null}
          </div>

          {oubli && (
            <div>
              <label htmlFor="mdp-confirmation" className="text-sm font-medium">
                Confirmez le nouveau mot de passe
              </label>
              <input
                id="mdp-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(ev) => {
                  setConfirmation(ev.target.value);
                  setErreur(null);
                }}
                placeholder="Retapez le même mot de passe"
                className="mt-1.5 w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {erreur && <p className="text-sm font-semibold text-destructive">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {enCours
              ? creation
                ? "Création…"
                : oubli
                  ? "Changement…"
                  : "Connexion…"
              : creation
                ? "Créer mon compte"
                : oubli
                  ? "Changer mon mot de passe"
                  : "Se connecter"}
          </button>

          {oubli ? (
            <button
              type="button"
              onClick={() => {
                setMode("connexion");
                setErreur(null);
                setConfirmation("");
              }}
              className="w-full py-2 text-sm font-semibold text-muted-foreground"
            >
              Retour à la connexion
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("oubli");
                setErreur(null);
                setConfirmation("");
              }}
              className="w-full py-2 text-sm font-semibold text-primary"
            >
              Mot de passe oublié ?
            </button>
          )}
        </form>
      </div>
    </section>
  );
}
