import { useEffect, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  MoreVertical,
  X,
  Settings,
  HelpCircle,
  Stethoscope,
  CalendarRange,
  ShieldCheck,
  RefreshCw,
  Scale,
  TrendingUp,
  Search,
  MessageSquareText,
  FolderTree,
  RefreshCcw,
  LifeBuoy,
} from "lucide-react";
import { useSuperApp } from "@/lib/store";

import logoSuperAppAsset from "@/assets/logo-super-app.png.asset.json";
const logoSuperApp = logoSuperAppAsset.url;

const ENTREES = [
  { to: "/planning", label: "Planning 14 semaines", icone: CalendarRange },
  { to: "/previsions", label: "Prévisions mois par mois", icone: TrendingUp },
  { to: "/suivi", label: "Suivi réel / prévu", icone: Scale },
  { to: "/messages", label: "Messages de transaction", icone: MessageSquareText },
  { to: "/parametres", label: "Paramètres", icone: Settings },
  { to: "/sauvegarde", label: "Sauvegarde et chiffrement", icone: ShieldCheck },
  { to: "/synchronisation", label: "Synchronisation e-mail", icone: RefreshCw },
  { to: "/journal", label: "Journal de diagnostic", icone: Stethoscope },
  { to: "/aide", label: "Aide", icone: HelpCircle },
] as const;

/** Titre affiché dans la barre haute selon la page en cours. */
const TITRES: ReadonlyArray<readonly [prefix: string, titre: string]> = [
  ["/revenu", "Ajouter un revenu"],
  ["/depense", "Ajouter une dépense"],
  ["/saisie", "Saisie intelligente"],
  ["/comptes/transferts/nouveau", "Nouveau transfert"],
  ["/comptes/transferts", "Transferts"],
  ["/comptes/action", "Action sur le compte"],
  ["/comptes", "Comptes"],
  ["/enveloppes/budgetisation", "Budgétisation"],
  ["/enveloppes/budget-mensuel", "Budget mensuel"],
  ["/enveloppes/categorie", "Catégorie"],
  ["/enveloppes/categories", "Catégories"],
  ["/enveloppes/chronologie", "Chronologie"],
  ["/enveloppes/classer", "Classer les enveloppes"],
  ["/enveloppes/creer", "Créer une enveloppe"],
  ["/enveloppes/details", "Détails de l'enveloppe"],
  ["/enveloppes/gerer", "Gérer les enveloppes"],
  ["/enveloppes/modifier", "Modifier l'enveloppe"],
  ["/enveloppes/renouvellements", "Renouvellements"],
  ["/enveloppes/secours", "Enveloppe de secours"],
  ["/enveloppes/action", "Action sur l'enveloppe"],
  ["/enveloppes", "Enveloppes"],
  ["/dettes", "Dettes & Créances"],
  ["/objectifs", "Objectifs d'épargne"],
  ["/planning", "Planning 14 semaines"],
  ["/previsions", "Prévisions mois par mois"],
  ["/suivi", "Suivi réel / prévu"],
  ["/analyses", "Analyses et conseils"],
  ["/assistant", "Mon conseiller"],
  ["/notifications", "Mon conseiller"],
  ["/messages", "Messages de transaction"],
  ["/rapport", "Rapport mensuel"],
  ["/mois", "Vue globale du mois"],
  ["/recherche", "Rechercher"],
  ["/outils", "Outils"],
  ["/parametres/alarmes", "Paramètres · Alarmes"],
  ["/parametres/clavier", "Paramètres · Clavier"],
  ["/parametres/donnees", "Paramètres · Données"],
  ["/parametres/mises-a-jour", "Paramètres · Mises à jour"],
  ["/parametres/profil", "Paramètres · Profil"],
  ["/parametres/securite", "Paramètres · Sécurité"],
  ["/parametres", "Paramètres"],
  ["/sauvegarde", "Sauvegarde et chiffrement"],
  ["/synchronisation", "Synchronisation e-mail"],
  ["/journal", "Journal de diagnostic"],
  ["/aide", "Aide"],
];

function titreDe(pathname: string): string {
  if (pathname === "/") return "";
  for (const [prefix, titre] of TITRES) {
    if (pathname.startsWith(prefix)) return titre;
  }
  return "";
}

/** Texte propre d'un nœud (espaces normalisés). */
function texteDe(n: Element | null | undefined): string {
  return (n?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Barre d'affichage supérieure figée (style WhatsApp) : bouton Retour à
 * gauche, titre de la page en cours, et menu latéral (trois points) à droite.
 * La loupe Rechercher reste réservée à la page d'accueil.
 */
export function BarreHaute() {
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panneau = useRef<HTMLElement>(null);
  const { nomUtilisateur } = useSuperApp();
  const [entete, setEntete] = useState<{ titre: string; sousTitre: string }>({
    titre: "",
    sousTitre: "",
  });

  const accueil = pathname === "/";
  const titre = accueil
    ? `Bienvenue${nomUtilisateur ? ` ${nomUtilisateur}` : ""}`
    : entete.titre || titreDe(pathname);
  const sousTitre = accueil ? "Bonjour 👋" : entete.sousTitre;

  // Fermer après une navigation.
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  /**
   * Reprise automatique de l'en-tête de la page dans la barre figée :
   * le premier titre de la page (et son sous-titre) alimente la barre puis
   * est masqué dans la page, afin de ne jamais afficher deux fois la même
   * information. Fonctionne pour toutes les pages, sans réécrire chacune.
   */
  useEffect(() => {
    if (accueil) {
      setEntete({ titre: "", sousTitre: "" });
      return;
    }
    let brut = 0;
    const lire = () => {
      const zone = document.querySelector("main");
      const h1 = zone?.querySelector("h1");
      if (!h1) return;
      const t = texteDe(h1);
      if (!t) return;
      const suivant = h1.nextElementSibling;
      const s =
        suivant instanceof HTMLParagraphElement && texteDe(suivant).length <= 90
          ? texteDe(suivant)
          : "";
      (h1 as HTMLElement).style.display = "none";
      if (s) (suivant as HTMLElement).style.display = "none";
      setEntete((p) => (p.titre === t && p.sousTitre === s ? p : { titre: t, sousTitre: s }));
    };
    const planifier = () => {
      cancelAnimationFrame(brut);
      brut = requestAnimationFrame(lire);
    };
    planifier();
    const cible = document.querySelector("main");
    const observateur = cible ? new MutationObserver(planifier) : null;
    if (cible) observateur?.observe(cible, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(brut);
      observateur?.disconnect();
    };
  }, [pathname, accueil]);

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
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-2">
          {accueil ? (
            <img
              src={logoSuperApp}
              alt="Logo SUPER APP"
              width={36}
              height={36}
              className="ml-1 h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) router.history.back();
                else router.navigate({ to: "/" });
              }}
              aria-label="Retour"
              className="shrink-0 rounded-full p-2 text-foreground transition-transform duration-200 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          )}

          <div className="min-w-0 flex-1">
            {accueil && sousTitre && (
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {sousTitre}
              </p>
            )}
            <p className="truncate text-base font-semibold leading-tight text-foreground">
              {titre}
            </p>
            {!accueil && sousTitre && (
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {sousTitre}
              </p>
            )}
          </div>

          {accueil && (
            <Link
              to="/recherche"
              aria-label="Rechercher"
              className="shrink-0 rounded-full p-2 text-foreground transition-transform duration-200 active:scale-95"
            >
              <Search className="h-5 w-5" aria-hidden />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
            aria-haspopup="menu"
            aria-expanded={ouvert}
            aria-controls="menu-principal"
            className="shrink-0 rounded-full p-2 text-foreground transition-transform duration-200 active:scale-95"
          >
            {ouvert ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <MoreVertical className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </header>

      <div
        onClick={() => setOuvert(false)}
        aria-hidden
        className={`fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          ouvert ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="menu-principal"
        ref={panneau}
        role="menu"
        aria-label="Menu principal"
        aria-hidden={!ouvert}
        className={`fixed right-0 top-0 z-[70] flex h-[100dvh] w-[17rem] max-w-[85vw] flex-col border-l border-border bg-card pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          ouvert ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-semibold">Menu</span>
          <button
            type="button"
            onClick={() => setOuvert(false)}
            aria-label="Fermer le menu"
            className="rounded-full p-1.5 text-foreground transition-transform duration-200 active:scale-95"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
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
                      actif ? "bg-accent font-semibold text-accent-foreground" : "text-foreground"
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
