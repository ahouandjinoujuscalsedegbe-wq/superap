import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FileText, MessageCircleQuestion, Plus, Search, Target } from "lucide-react";

const ACCES = [
  { to: "/assistant", label: "Assistant", Icone: MessageCircleQuestion },
  { to: "/recherche", label: "Recherche", Icone: Search },
  { to: "/rapport", label: "Rapport", Icone: FileText },
  { to: "/objectifs", label: "Objectifs", Icone: Target },
] as const;

/** Rayon (px) de déploiement des boutons flottants autour du bouton central. */
const RAYON = 86;
/** Angles répartis en éventail au-dessus du bouton (0° = droite, sens horaire inversé). */
const ANGLES = [200, 245, 295, 340];

export function AccesRapidesRadial() {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  return (
    <div ref={conteneur} className="relative flex h-16 items-center justify-center">
      {ouvert && (
        <span
          className="fixed inset-0 z-30 animate-fade-in bg-background/40 backdrop-blur-[1px]"
          aria-hidden
        />
      )}

      <div className="relative z-40 flex items-center justify-center">
        {ACCES.map(({ to, label, Icone }, i) => {
          const angle = (ANGLES[i]! * Math.PI) / 180;
          const x = Math.cos(angle) * RAYON;
          const y = Math.sin(angle) * RAYON;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              tabIndex={ouvert ? 0 : -1}
              onClick={() => setOuvert(false)}
              className="carte absolute flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full shadow-lg transition-all duration-300 ease-out"
              style={{
                transform: ouvert
                  ? `translate(${x}px, ${y}px) scale(1)`
                  : "translate(0px, 0px) scale(0.4)",
                opacity: ouvert ? 1 : 0,
                pointerEvents: ouvert ? "auto" : "none",
                transitionDelay: `${ouvert ? i * 45 : (ACCES.length - i) * 25}ms`,
              }}
            >
              <Icone className="h-5 w-5 text-primary" aria-hidden />
              <span className="text-[0.5rem] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-label={ouvert ? "Fermer les accès rapides" : "Ouvrir les accès rapides"}
          className="bande-degrade relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_10px_28px_-10px_var(--primary)] transition-transform duration-300 active:scale-95"
        >
          <Plus
            className={`h-7 w-7 transition-transform duration-300 ${ouvert ? "rotate-45" : ""}`}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
