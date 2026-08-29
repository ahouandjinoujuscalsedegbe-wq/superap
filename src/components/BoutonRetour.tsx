import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type Props = { to: string; label: string; compact?: boolean };

export function BoutonRetour({ to, label, compact = false }: Props) {
  return (
    <Link
      to={to}
      className={
        "inline-flex items-center rounded-xl border border-input bg-card font-medium transition-colors hover:bg-accent/40 " +
        (compact ? "gap-1 px-2 py-1.5 text-xs" : "gap-2 px-3 py-2 text-sm")
      }
    >
      <ArrowLeft aria-hidden className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </Link>
  );
}
