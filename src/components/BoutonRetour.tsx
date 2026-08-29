import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type Props = { to: string; label: string };

export function BoutonRetour({ to, label }: Props) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/40"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      {label}
    </Link>
  );
}
