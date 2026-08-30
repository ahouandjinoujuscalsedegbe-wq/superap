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
          const actif = onglet.to === "/" ? pathname === "/" : pathname.startsWith(onglet.to);
          const Icone = onglet.icone;
          return (
            <li key={onglet.to} className="flex-1">
              <Link
                to={onglet.to}
                aria-current={actif ? "page" : undefined}
                className="group flex flex-col items-center gap-1 rounded-xl py-1"
              >
                <span
                  className={`relative flex h-8 w-[4.25rem] items-center justify-center overflow-hidden rounded-full transition-all duration-300 ${
                    actif
                      ? "bande-degrade shadow-[0_8px_18px_-10px_var(--primary)]"
                      : "text-muted-foreground group-active:bg-accent/60"
                  }`}
                >
                  {actif && (
                    <span
                      key={onglet.to + "-pastille"}
                      className="pastille-anim bande-degrade absolute inset-0 rounded-full"
                      aria-hidden
                    />
                  )}
                  <Icone
                    className={`relative h-[1.35rem] w-[1.35rem] transition-transform duration-300 ${
                      actif ? "scale-110" : "group-active:scale-95"
                    }`}
                    strokeWidth={actif ? 2.4 : 1.9}
                    aria-hidden
                  />
                </span>
                <span
                  className={`text-[0.7rem] leading-none transition-all duration-300 ${
                    actif ? "texte-degrade font-semibold" : "text-muted-foreground"
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
