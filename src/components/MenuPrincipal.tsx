import { useEffect, useState } from "react";
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

  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Ouvrir le menu"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="surface fixed right-3 top-3 z-50 rounded-full border border-border p-2 text-foreground shadow-sm"
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>

      <div
        onClick={() => setOuvert(false)}
        aria-hidden
        className={`fixed inset-0 z-50 bg-foreground/25 transition-opacity duration-200 ${
          ouvert ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="menu"
        aria-label="Menu principal"
        className={`fixed right-0 top-0 bg-card z-50 flex h-full w-[16.5rem] max-w-[80%] flex-col border-l border-border shadow-2xl transition-transform duration-250 ${
          ouvert ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-semibold">Menu</span>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            aria-label="Fermer le menu"
            className="rounded-full p-1.5 text-muted-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
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
                    className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      actif ? "bg-accent font-semibold text-accent-foreground" : "text-foreground"
                    }`}
                  >
                    <Icone className="h-[1.15rem] w-[1.15rem] text-primary" aria-hidden />
                    {e.label}
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
