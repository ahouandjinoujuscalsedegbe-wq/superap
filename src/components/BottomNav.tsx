import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Wallet, Sparkles, Landmark, Calculator } from "lucide-react";

const ONGLETS = [
  { to: "/", label: "Accueil", icone: Home },
  { to: "/enveloppes", label: "Enveloppes", icone: Wallet },
  { to: "/saisie", label: "Saisie intelligente", icone: Sparkles, milieu: true },
  { to: "/comptes", label: "Comptes", icone: Landmark },
  { to: "/outils", label: "Outils et simulation", icone: Calculator },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navigation principale"
      className="surface fixed inset-x-0 bottom-0 z-50 border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-end justify-between px-1 pb-2 pt-1">
        {ONGLETS.map((onglet) => {
          const actif = onglet.to === "/" ? pathname === "/" : pathname.startsWith(onglet.to);
          const Icone = onglet.icone;
          const estMilieu = "milieu" in onglet && onglet.milieu;

          if (estMilieu) {
            return (
              <li key={onglet.to} className="flex flex-1 justify-center">
                <Link
                  to={onglet.to}
                  aria-current={actif ? "page" : undefined}
                  aria-label={onglet.label}
                  className="group -mt-6 flex flex-col items-center"
                >
                  <span
                    className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg transition-all duration-300 ${
                      actif
                        ? "bande-degrade shadow-[0_10px_28px_-10px_var(--primary)]"
                        : "bg-background text-muted-foreground ring-1 ring-border active:bg-accent/60"
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
                      className={`relative h-7 w-7 transition-transform duration-300 ${
                        actif ? "scale-110" : "group-active:scale-95"
                      }`}
                      strokeWidth={actif ? 2.4 : 1.9}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={`mt-1.5 max-w-[4.5rem] text-center text-[0.6rem] leading-none transition-all duration-300 ${
                      actif ? "texte-degrade font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {onglet.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={onglet.to} className="flex-1">
              <Link
                to={onglet.to}
                aria-current={actif ? "page" : undefined}
                className="group flex flex-col items-center gap-1 rounded-xl py-1"
              >
                <span
                  className={`relative flex h-8 w-[3.6rem] items-center justify-center overflow-hidden rounded-full transition-all duration-300 ${
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
                    className={`relative h-[1.3rem] w-[1.3rem] transition-transform duration-300 ${
                      actif ? "scale-110" : "group-active:scale-95"
                    }`}
                    strokeWidth={actif ? 2.4 : 1.9}
                    aria-hidden
                  />
                </span>
                <span
                  className={`max-w-[4rem] text-center text-[0.65rem] leading-none transition-all duration-300 ${
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
