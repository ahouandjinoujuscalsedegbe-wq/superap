import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSuperApp } from "@/lib/store";
import { lireTraceEffacement, oublierTraceEffacement } from "@/lib/securite-avancee";
import { useEffect, useState } from "react";

/**
 * Message affiché après un effacement de sécurité (codes incorrects répétés).
 * Sans lui, le propriétaire légitime croirait à une panne de l'application.
 */
export function AlerteEffacement() {
  const [trace, setTrace] = useState<ReturnType<typeof lireTraceEffacement>>(null);
  useEffect(() => setTrace(lireTraceEffacement()), []);
  if (!trace) return null;
  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span className="space-y-2">
        <strong className="font-semibold">Données effacées par sécurité</strong> le{" "}
        {new Date(trace.date).toLocaleString("fr-FR")}, après plusieurs codes incorrects.
        {trace.derniereCopie
          ? ` Votre dernière copie chiffrée date du ${new Date(trace.derniereCopie).toLocaleString("fr-FR")} : vous pouvez tout récupérer avec votre adresse e-mail et votre phrase.`
          : " Récupérez vos données avec votre adresse e-mail et votre phrase de récupération."}
        <Link
          to="/sauvegarde"
          hash="recuperation"
          className="block font-semibold text-primary underline underline-offset-2"
        >
          Récupérer mes données
        </Link>
        <button
          type="button"
          onClick={() => {
            oublierTraceEffacement();
            setTrace(null);
          }}
          className="block text-muted-foreground underline underline-offset-2"
        >
          J'ai compris, masquer ce message
        </button>
      </span>
    </div>
  );
}

/**
 * Avertissement affiché lorsque des données existent sur le téléphone mais ne
 * peuvent pas être déchiffrées (secret d'appareil perdu, stockage abîmé).
 *
 * Dans ce cas l'application suspend TOUTE écriture : cela évite d'écraser
 * définitivement une sauvegarde qui pourrait encore être récupérée. L'utilisateur
 * doit être prévenu, sans quoi il croirait avoir perdu ses données.
 */
export function AlerteStockage() {
  const { stockageIllisible, enregistrementEnEchec } = useSuperApp();

  // Enregistrement impossible : le bandeau reste visible tant que la dernière
  // écriture protégée n'a pas abouti, pour ne jamais laisser croire au succès.
  if (!stockageIllisible && enregistrementEnEchec) {
    return (
      <div
        role="alert"
        className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-foreground"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <span className="space-y-2">
          <strong className="font-semibold">Vos dernières saisies ne sont pas enregistrées.</strong>{" "}
          Le téléphone refuse d'écrire : espace insuffisant ou stockage indisponible. Libérez de la
          place, puis ressaisissez la dernière opération. Sans cela, elle disparaîtra à la
          réouverture.
          <Link
            to="/sauvegarde"
            className="block font-semibold text-primary underline underline-offset-2"
          >
            Vérifier ma sauvegarde
          </Link>
        </span>
      </div>
    );
  }

  if (!stockageIllisible) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span className="space-y-2">
        <strong className="font-semibold">Données locales illisibles.</strong> Vos anciennes données
        sont toujours sur le téléphone mais ne peuvent pas être ouvertes. Par sécurité,
        l'application n'enregistre rien pour ne pas les effacer. Restaurez une sauvegarde depuis la
        page Sauvegarde, ou contactez l'assistance avant de saisir quoi que ce soit.
        <Link
          to="/sauvegarde"
          hash="recuperation"
          className="block font-semibold text-primary underline underline-offset-2"
        >
          Récupérer mes données maintenant
        </Link>
      </span>
    </div>
  );
}
