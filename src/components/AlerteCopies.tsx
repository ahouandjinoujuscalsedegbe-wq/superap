import { CloudOff } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  domainesEnAlerte,
  EVENEMENT_INCIDENT,
  libelleDomaine,
  lireIncidents,
  oublierIncidents,
  type DomaineIncident,
} from "@/lib/incidents";

/**
 * Bandeau affiché lorsque les copies chiffrées n'arrivent plus à destination
 * plusieurs fois de suite. Sans lui, l'échec resterait totalement silencieux.
 */
export function AlerteCopies() {
  const [domaines, setDomaines] = useState<DomaineIncident[]>([]);
  const [dernier, setDernier] = useState<string | null>(null);

  useEffect(() => {
    const relire = () => {
      const etat = lireIncidents();
      setDomaines(domainesEnAlerte(etat));
      setDernier(etat.derniers[0]?.date ?? null);
    };
    relire();
    window.addEventListener(EVENEMENT_INCIDENT, relire);
    const minuterie = window.setInterval(relire, 60_000);
    return () => {
      window.removeEventListener(EVENEMENT_INCIDENT, relire);
      window.clearInterval(minuterie);
    };
  }, []);

  if (domaines.length === 0) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-xs text-foreground"
    >
      <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span className="space-y-2">
        <strong className="font-semibold">Vos copies de sauvegarde n'arrivent plus.</strong>{" "}
        {domaines.length === 1
          ? `Plusieurs tentatives d'affilée ont échoué vers le ${libelleDomaine(domaines[0]!)}.`
          : `Plusieurs tentatives d'affilée ont échoué vers : ${domaines.map(libelleDomaine).join(", ")}.`}
        {dernier
          ? ` Dernier échec le ${new Date(dernier).toLocaleString("fr-FR")}.`
          : ""}{" "}
        Vérifiez votre connexion Internet et l'espace libre du téléphone, puis lancez une copie
        depuis la page Sauvegarde.
        <Link to="/sauvegarde" className="block font-semibold text-primary underline underline-offset-2">
          Ouvrir la page Sauvegarde
        </Link>
        <button
          type="button"
          onClick={() => {
            oublierIncidents();
            setDomaines([]);
          }}
          className="block text-muted-foreground underline underline-offset-2"
        >
          J'ai compris, masquer ce message
        </button>
      </span>
    </div>
  );
}
