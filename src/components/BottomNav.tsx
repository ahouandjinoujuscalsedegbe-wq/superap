import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, TrendingUp, TrendingDown } from "lucide-react";

const ONGLETS = [
  { to: "/", label: "Accueil", icone: Home },
  { to: "/enveloppes", label: "Enveloppes", icone: Wallet },
  { to: "/revenu", label: "Revenu", icone: TrendingUp },
  { to: "/depense", label: "Dépense", icone: TrendingDown },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navigation principale"
      className="surface fixed inset-x-0 bottom-0 z-50 border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
        {ONGLETS.map((onglet) => {
          const actif = pathname === onglet.to;
          const Icone = onglet.icone;
          return (
            <li key={onglet.to} className="flex-1">
              <Link
                to={onglet.to}
                aria-current={actif ? "page" : undefined}
                className="flex flex-col items-center gap-1 rounded-xl py-1 transition-colors"
              >
                <span
                  className={`flex h-8 w-[4.25rem] items-center justify-center rounded-full transition-all duration-200 ${
                    actif ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icone
                    className="h-[1.35rem] w-[1.35rem]"
                    strokeWidth={actif ? 2.4 : 1.9}
                    aria-hidden
                  />
                </span>
                <span
                  className={`text-[0.7rem] leading-none ${
                    actif ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {onglet.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
