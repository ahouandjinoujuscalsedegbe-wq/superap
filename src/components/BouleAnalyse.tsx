import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as PointerEventReact,
} from "react";
import { ArrowRight, LifeBuoy, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { toast } from "sonner";
import { useCerveau } from "@/lib/cerveau/hook";
import { useSuperApp } from "@/lib/store";
import { formatFCFA, grouperMontant, deGrouperMontant } from "@/lib/format";
import {
  bilanSecours,
  enregistrerDecision,
  noterSolution,
  solutionsSecours,
} from "@/lib/analyse-secours";

/**
 * Boule flottante d'« Analyse intelligente », disponible sur toutes les pages :
 * une véritable sphère en lévitation perpétuelle, un appui déroule les constats
 * calculés localement sur le téléphone.
 */
/** Positions des six logos sur la sphère (ceinture + pôles). */
const RAYON = 26;
const FACES = [
  `rotateY(0deg) translateZ(${RAYON}px)`,
  `rotateY(90deg) translateZ(${RAYON}px)`,
  `rotateY(180deg) translateZ(${RAYON}px)`,
  `rotateY(270deg) translateZ(${RAYON}px)`,
  `rotateX(90deg) translateZ(${RAYON}px)`,
  `rotateX(-90deg) translateZ(${RAYON}px)`,
];

export function BouleAnalyse() {
  const { alertes: toutesAlertes } = useCerveau();
  const { enveloppes, transactions, depensesParEnveloppe, transfererEntreEnveloppes } =
    useSuperApp();
  const [ouvert, setOuvert] = useState(false);
  const [onglet, setOnglet] = useState<"constats" | "solutions">("constats");
  const [montants, setMontants] = useState<Record<string, string>>({});
  const [faits, setFaits] = useState<string[]>([]);
  const [bilan, setBilan] = useState(() => bilanSecours());
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [glisse, setGlisse] = useState(false);
  const refBoule = useRef<HTMLButtonElement | null>(null);
  const aGlisse = useRef(false);
  const decalage = useRef({ x: 0, y: 0 });

  // Position mémorisée : la boule reste où l'utilisateur l'a posée, sur toutes les pages.
  useEffect(() => {
    try {
      const brut = localStorage.getItem("boule-analyse-position");
      if (brut) setPos(JSON.parse(brut));
    } catch {
      /* position par défaut */
    }
  }, []);

  const debutGlisse = useCallback((e: PointerEventReact<HTMLButtonElement>) => {
    const r = refBoule.current?.getBoundingClientRect();
    if (!r) return;
    decalage.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    aGlisse.current = false;
    setGlisse(true);

    const bouger = (ev: PointerEvent) => {
      const taille = r.width;
      const x = Math.min(
        Math.max(4, ev.clientX - decalage.current.x),
        window.innerWidth - taille - 4,
      );
      const y = Math.min(
        Math.max(4, ev.clientY - decalage.current.y),
        window.innerHeight - taille - 4,
      );
      if (
        Math.abs(ev.clientX - (r.left + decalage.current.x)) > 4 ||
        Math.abs(ev.clientY - (r.top + decalage.current.y)) > 4
      ) {
        aGlisse.current = true;
      }
      setPos({ x, y });
    };
    const fin = () => {
      setGlisse(false);
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", fin);
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem("boule-analyse-position", JSON.stringify(p));
          } catch {
            /* stockage indisponible */
          }
        }
        return p;
      });
      setTimeout(() => {
        aGlisse.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", fin);
  }, []);

  const alertes = useMemo(
    () => toutesAlertes.filter((a) => a.niveau !== "bravo").slice(0, 6),
    [toutesAlertes],
  );

  const solutions = useMemo(
    () => solutionsSecours(enveloppes, depensesParEnveloppe, transactions),
    [enveloppes, depensesParEnveloppe, transactions],
  );

  if (alertes.length === 0 && solutions.length === 0) return null;

  const urgentes = alertes.filter((a) => a.niveau === "alerte").length + solutions.length;
  const total = alertes.length + solutions.length;

  const appliquer = (
    cle: string,
    cibleId: string,
    cibleNom: string,
    donneurId: string,
    donneurNom: string,
    propose: number,
  ) => {
    const saisi = montants[cle];
    const montant = saisi ? Number(deGrouperMontant(saisi)) : propose;
    if (!montant || montant <= 0) {
      toast.error("Montant invalide");
      return;
    }
    transfererEntreEnveloppes(donneurId, cibleId, montant);
    setBilan(
      bilanSecours(
        enregistrerDecision({
          cible: cibleNom,
          donneur: donneurNom,
          propose,
          applique: montant,
          action: montant === propose ? "applique" : "ajuste",
        }),
      ),
    );
    setFaits((l) => [...l, cle]);
    toast.success(`${formatFCFA(montant)} transférés vers ${cibleNom}`);
  };

  const ignorer = (cle: string, cibleNom: string, donneurNom: string, propose: number) => {
    setBilan(
      bilanSecours(
        enregistrerDecision({
          cible: cibleNom,
          donneur: donneurNom,
          propose,
          applique: 0,
          action: "ignore",
        }),
      ),
    );
    setFaits((l) => [...l, cle]);
  };

  return (
    <>
      {ouvert && (
        <div
          onClick={() => setOuvert(false)}
          className="animate-fade-in fixed inset-0 z-[65] bg-black/40"
          aria-hidden
        />
      )}

      {ouvert && (
        <section
          role="dialog"
          aria-label="Analyse intelligente"
          className="carte animate-scale-in fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] left-3 right-3 z-[66] max-h-[55vh] space-y-2 overflow-y-auto p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Analyse intelligente
              </h2>
              <p className="text-xs text-muted-foreground">
                Calculée sur votre téléphone, sans aucune connexion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer l'analyse"
              className="rounded-full p-1.5 transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <ul className="space-y-1.5 text-sm">
            {alertes.map((a) => (
              <li key={a.id} className="rounded-lg bg-muted/50 px-3 py-2">
                <span
                  className={
                    a.niveau === "alerte"
                      ? "font-semibold text-destructive"
                      : a.niveau === "attention"
                        ? "font-semibold text-warning"
                        : "font-semibold"
                  }
                >
                  {a.titre}
                </span>
                <span className="block text-xs text-muted-foreground">{a.texte}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Sphère 3D rose, déplaçable à la main, en lévitation permanente. */}
      <div
        className="fixed z-[67] flex flex-col items-center"
        style={
          pos
            ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
            : { right: 16, bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }
        }
      >
        <button
          ref={refBoule}
          type="button"
          onPointerDown={debutGlisse}
          onClick={() => {
            if (aGlisse.current) return;
            setOuvert((v) => !v);
          }}
          aria-label={`Analyse intelligente : ${alertes.length} constat${alertes.length > 1 ? "s" : ""}`}
          aria-expanded={ouvert}
          className={`boule-levite relative h-16 w-16 touch-none rounded-full ${urgentes > 0 ? "boule-clignote" : ""} ${glisse ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <span
            className={`boule-halo-rose absolute -inset-2 rounded-full ${urgentes > 0 ? "boule-halo-alerte" : ""}`}
            aria-hidden
          />
          <span className="boule-orbite-rose absolute -inset-1 rounded-full" aria-hidden />
          <span className="boule-rose-3d absolute inset-0 flex items-center justify-center rounded-full">
            <span className="boule-eclat absolute inset-0 rounded-full" aria-hidden />
            {/* Six logos posés sur la sphère : 4 en ceinture + 1 en haut + 1 en bas. */}
            <span className="boule-scene absolute inset-0" aria-hidden>
              <span className="boule-axe-x absolute inset-0">
                <span className="boule-axe-y absolute inset-0">
                  {FACES.map((f, i) => (
                    <span
                      key={i}
                      className="absolute left-1/2 top-1/2 -ml-[10px] -mt-[10px] flex h-5 w-5 items-center justify-center"
                      style={{ transform: f }}
                    >
                      <Sparkles className="h-5 w-5 text-white/95 drop-shadow" />
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </span>
          <span
            className={`absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
              urgentes > 0
                ? "bg-destructive text-destructive-foreground"
                : "bg-card text-foreground"
            }`}
          >
            {alertes.length}
          </span>
        </button>
        <span className="boule-ombre-rose mt-1 h-2 w-10 rounded-[50%]" aria-hidden />
      </div>
    </>
  );
}
