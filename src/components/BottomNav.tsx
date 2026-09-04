import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Sparkles, Target, MessageCircle } from "lucide-react";

const RAYON_SAISIE = 26;
const FACES_SAISIE = [
  `rotateY(0deg) translateZ(${RAYON_SAISIE}px)`,
  `rotateY(90deg) translateZ(${RAYON_SAISIE}px)`,
  `rotateY(180deg) translateZ(${RAYON_SAISIE}px)`,
  `rotateY(270deg) translateZ(${RAYON_SAISIE}px)`,
  `rotateX(90deg) translateZ(${RAYON_SAISIE}px)`,
  `rotateX(-90deg) translateZ(${RAYON_SAISIE}px)`,
];

const ONGLETS = [
  { to: "/", label: "Accueil", icone: Home },
  { to: "/saisie", label: "Saisie intelligente", icone: Sparkles, milieu: true },
  { to: "/notifications", label: "Mon conseiller", icone: MessageCircle, tailleIcone: "h-6 w-6" },
  { to: "/objectifs", label: "Objectifs d'épargne", icone: Target },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      id="navigation-principale"
      aria-label="Navigation principale"
      className="surface app-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-2 pt-1">
        {ONGLETS.map((onglet) => {
          const actif = onglet.to === "/" ? pathname === "/" : pathname.startsWith(onglet.to);
          const Icone = onglet.icone;
          const tailleIcone =
            "tailleIcone" in onglet ? onglet.tailleIcone : "h-[1.3rem] w-[1.3rem]";
          const estMilieu = "milieu" in onglet && onglet.milieu;

          if (estMilieu) {
            return (
              <li key={onglet.to} className="flex flex-1 flex-col items-center justify-end">
                <Link
                  to={onglet.to}
                  aria-current={actif ? "page" : undefined}
                  aria-label={onglet.label}
                  className="group -mt-6 flex flex-col items-center"
                >
                  <span className="relative flex h-16 w-16 items-end justify-center">
                    {/* ombre au sol : respire avec la lévitation */}
                    <span
                      className="boule-ombre boule-ombre-rose absolute bottom-0 h-2 w-10 rounded-[50%]"
                      aria-hidden
                    />
                    <span className="boule-levite absolute inset-x-0 top-0 flex justify-center">
                      <span
                        className={`boule-rose-3d relative flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 ${
                          actif
                            ? "scale-105 ring-2 ring-[rgba(255,158,203,0.7)]"
                            : "group-active:scale-95"
                        }`}
                      >
                        <span className="boule-scene absolute inset-0" aria-hidden>
                          <span className="boule-axe-x absolute inset-0">
                            <span className="boule-axe-y absolute inset-0">
                              {FACES_SAISIE.map((f, i) => (
                                <span
                                  key={i}
                                  className="absolute left-1/2 top-1/2 -ml-[9px] -mt-[9px] flex h-[18px] w-[18px] items-center justify-center"
                                  style={{ transform: f }}
                                >
                                  <Icone
                                    className="h-[18px] w-[18px] text-white drop-shadow-[0_1px_2px_rgba(214,90,150,0.6)]"
                                    strokeWidth={2.2}
                                  />
                                </span>
                              ))}
                            </span>
                          </span>
                        </span>
                      </span>
                    </span>
                  </span>

                  <span
                    className={`mt-1.5 h-6 max-w-[4.5rem] overflow-hidden text-center text-[0.6rem] leading-3 transition-all duration-300 ${
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
            <li key={onglet.to} className="flex flex-1 flex-col items-center justify-end">
              <Link
                to={onglet.to}
                aria-current={actif ? "page" : undefined}
                className="group flex flex-col items-center gap-1 rounded-xl py-1"
              >
                <span
                  key={onglet.to + (actif ? "-actif" : "-inactif")}
                  className={`relative flex h-8 w-[3.6rem] items-center justify-center overflow-hidden rounded-full transition-all duration-300 ${
                    actif ? "pivot-y " : ""
                  }${
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
                    className={`relative ${tailleIcone} transition-transform duration-300 ${
                      actif ? "scale-110" : "group-active:scale-95"
                    }`}
                    strokeWidth={actif ? 2.4 : 1.9}
                    aria-hidden
                  />
                </span>
                <span
                  className={`h-6 max-w-[4rem] overflow-hidden text-center text-[0.65rem] leading-3 transition-all duration-300 ${
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
