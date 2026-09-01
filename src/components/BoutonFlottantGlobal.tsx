import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, CalendarRange, FileText, Plus, Target } from "lucide-react";

/**
 * Bouton circulaire flottant, déplaçable partout sur l'écran et présent dans
 * tous les onglets. Sa position est retenue localement d'une session à l'autre.
 * Un appui déploie les quatre accès rapides en éventail circulaire.
 */

const ACCES = [
  { to: "/mois", label: "Mois", Icone: CalendarRange },
  { to: "/notifications", label: "Conseiller", Icone: BellRing },
  { to: "/rapport", label: "Rapport", Icone: FileText },
  { to: "/objectifs", label: "Objectifs", Icone: Target },
] as const;


const CLE_POSITION = "SA_BOUTON_FLOTTANT_POS_V1";
const TAILLE = 56;
const RAYON = 96;
/** Périmètre de la boule : sert à convertir le déplacement en rotation. */
const PERIMETRE = Math.PI * TAILLE;
const MARGE = 8;
/** Déplacement (px) au-delà duquel l'appui est un glissement, pas un clic. */
const SEUIL_GLISSEMENT = 6;

type Position = { x: number; y: number };

function positionParDefaut(): Position {
  return {
    x: Math.max(MARGE, window.innerWidth - TAILLE - 16),
    y: Math.max(MARGE, window.innerHeight - TAILLE - 140),
  };
}

function borner(p: Position): Position {
  return {
    x: Math.min(Math.max(MARGE, p.x), Math.max(MARGE, window.innerWidth - TAILLE - MARGE)),
    y: Math.min(Math.max(MARGE, p.y), Math.max(MARGE, window.innerHeight - TAILLE - MARGE)),
  };
}

export function BoutonFlottantGlobal() {
  const [position, setPosition] = useState<Position | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [glisse, setGlisse] = useState(false);
  /** Angle de roulement de la boule (degrés cumulés). */
  const [rotation, setRotation] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const depart = useRef<{ x: number; y: number; px: number; py: number; bouge: boolean } | null>(
    null,
  );

  // Position mémorisée (lue uniquement côté navigateur).
  useEffect(() => {
    let initiale = positionParDefaut();
    try {
      const brut = window.localStorage.getItem(CLE_POSITION);
      if (brut) {
        const p = JSON.parse(brut) as Partial<Position>;
        if (typeof p.x === "number" && typeof p.y === "number") initiale = { x: p.x, y: p.y };
      }
    } catch {
      /* position par défaut */
    }
    setPosition(borner(initiale));
  }, []);

  // Le bouton reste visible si l'écran change de taille ou d'orientation.
  useEffect(() => {
    const auRedim = () => setPosition((p) => (p ? borner(p) : p));
    window.addEventListener("resize", auRedim);
    window.addEventListener("orientationchange", auRedim);
    return () => {
      window.removeEventListener("resize", auRedim);
      window.removeEventListener("orientationchange", auRedim);
    };
  }, []);

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

  const enregistrer = useCallback((p: Position) => {
    try {
      window.localStorage.setItem(CLE_POSITION, JSON.stringify(p));
    } catch {
      /* stockage indisponible */
    }
  }, []);

  function auPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!position) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Retour tactile court : le bouton « répond » sous le doigt.
    try {
      navigator.vibrate?.(12);
    } catch {
      /* vibration indisponible */
    }
    depart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y, bouge: false };
    dernier.current = { x: e.clientX, y: e.clientY };
  }

  function auPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = depart.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.bouge && Math.hypot(dx, dy) < SEUIL_GLISSEMENT) return;
    if (!d.bouge) {
      d.bouge = true;
      setGlisse(true);
      setOuvert(false);
    }
    // La boule roule : la distance parcourue est convertie en tours.
    const p = dernier.current;
    if (p) {
      const pas = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      const sens = e.clientX - p.x >= 0 ? 1 : -1;
      setRotation((r) => r + (sens * pas * 360) / PERIMETRE);
    }
    dernier.current = { x: e.clientX, y: e.clientY };
    setPosition(borner({ x: d.px + dx, y: d.py + dy }));
  }

  function auPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = depart.current;
    dernier.current = null;
    depart.current = null;
    if (!d) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture déjà relâchée */
    }
    if (d.bouge) {
      setGlisse(false);
      if (position) enregistrer(position);
      return;
    }
    setOuvert((o) => !o);
  }

  if (!position) return null;

  // L'éventail s'ouvre vers le centre de l'écran pour rester toujours visible.
  const centreX = position.x + TAILLE / 2;
  const centreY = position.y + TAILLE / 2;
  const versGauche = centreX > window.innerWidth / 2;
  const versHaut = centreY > window.innerHeight / 2;
  const angleBase = Math.atan2(versHaut ? -1 : 1, versGauche ? -1 : 1) * (180 / Math.PI);
  const ecart = ACCES.length > 1 ? 90 / (ACCES.length - 1) : 0;
  const angles = ACCES.map((_, i) => angleBase - 45 + i * ecart);

  return (
    <>
      {ouvert && (
        <span
          className="fixed inset-0 z-40 animate-fade-in bg-background/40 backdrop-blur-[1px]"
          aria-hidden
        />
      )}

      <div
        ref={conteneur}
        className="fixed z-50"
        style={{
          left: position.x,
          top: position.y,
          width: TAILLE,
          height: TAILLE,
          touchAction: "none",
        }}
      >
        {ACCES.map(({ to, label, Icone }, i) => {
          const angle = ((angles[i] ?? 0) * Math.PI) / 180;
          const x = Math.cos(angle) * RAYON;
          const y = Math.sin(angle) * RAYON;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              tabIndex={ouvert ? 0 : -1}
              onClick={() => setOuvert(false)}
              className="absolute inset-0 flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full border border-border/60 bg-card/80 backdrop-blur-xl transition-all duration-300 ease-out active:scale-90 active:bg-accent"
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
              <span className="text-[0.55rem] font-medium leading-none">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onPointerDown={auPointerDown}
          onPointerMove={auPointerMove}
          onPointerUp={auPointerUp}
          onPointerCancel={auPointerUp}
          aria-expanded={ouvert}
          aria-label={
            ouvert
              ? "Fermer les accès rapides"
              : "Ouvrir les accès rapides (maintenez pour déplacer la boule)"
          }
          className={`group relative flex h-14 w-14 items-center justify-center overflow-hidden sphere-3d sphere-vivante rounded-full bg-primary text-primary-foreground backdrop-blur-xl transition-[opacity] duration-150 ease-out will-change-transform active:opacity-80 active:[animation:none] active:scale-[0.88] ${
            glisse ? "opacity-95 [animation:none]" : ""
          }`}

        >
          {/* Reflet lumineux animé : la lumière glisse sur la sphère. */}
          <span
            className="sphere-reflet-anime pointer-events-none absolute left-[18%] top-[12%] h-[18px] w-[18px] rounded-full bg-white/70 blur-[3px]"
            aria-hidden
          />

          {/* Contenu qui roule avec la boule. */}
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: glisse ? "none" : "transform 400ms ease-out",
            }}
            aria-hidden
          >
            <Plus
              className={`h-7 w-7 transition-transform duration-300 ${ouvert ? "rotate-45" : ""}`}
            />
          </span>
        </button>


      </div>
    </>
  );
}
