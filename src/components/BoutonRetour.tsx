import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type Props = { to: string; label: string; compact?: boolean };

/** Bouton de retour : taille unique (identique à « Retour à Action »). */
export function BoutonRetour({ to, label }: Props) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-xl border border-input bg-card px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent/40"
    >
      <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
