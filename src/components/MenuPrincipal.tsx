import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  MoreVertical,
  X,
  Landmark,
  LineChart,
  Calculator,
  Settings,
  HelpCircle,
} from "lucide-react";

const ENTREES = [
  { to: "/comptes", label: "Comptes", icone: Landmark },
  { to: "/analyses", label: "Analyses et Conseils", icone: LineChart },
  { to: "/outils", label: "Outils et Simulation", icone: Calculator },
  { to: "/parametres", label: "Paramètres", icone: Settings },
  { to: "/aide", label: "Aide", icone: HelpCircle },
] as const;

export function MenuPrincipal() {
  const [ouvert, setOuvert] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panneau = useRef<HTMLElement>(null);

  // Fermer après une navigation.
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  // Échap ferme le panneau ; le défilement de fond est bloqué quand il est ouvert.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panneau.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => {
      document.body.style.overflow = precedent;
    };
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls="menu-principal"
        className="surface fixed right-3 top-3 z-60 rounded-full border border-border p-2 text-foreground shadow-sm transition-transform duration-200 active:scale-95"
      >
        {ouvert ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <MoreVertical className="h-5 w-5" aria-hidden />
        )}
      </button>

      <div
        onClick={() => setOuvert(false)}
        aria-hidden
        className={`fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          ouvert ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="menu-principal"
        ref={panneau}
        role="menu"
        aria-label="Menu principal"
        aria-hidden={!ouvert}
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-[17rem] max-w-[85vw] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          ouvert ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 pr-14">
          <span className="font-semibold">Menu</span>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-2">
          <ul>
            {ENTREES.map((e) => {
              const Icone = e.icone;
              const actif = pathname === e.to;
              return (
                <li key={e.to}>
                  <Link
                    to={e.to}
                    role="menuitem"
                    tabIndex={ouvert ? 0 : -1}
                    activeOptions={{ exact: true }}
                    className={`relative flex items-center gap-3 py-3 pl-4 pr-3 text-sm transition-colors hover:bg-accent/60 ${
                      actif
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-y-1 left-0 w-1 origin-center rounded-r-full bg-primary transition-transform duration-300 ${
                        actif ? "scale-y-100" : "scale-y-0"
                      }`}
                    />
                    <Icone className="h-[1.15rem] w-[1.15rem] shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{e.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
