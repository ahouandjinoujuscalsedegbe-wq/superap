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
  Layers,
  Plus,
  Pencil,
  ListOrdered,
  History,
  
  ArrowLeftRight,
} from "lucide-react";

import { useSuperApp } from "@/lib/store";
import { CATEGORIE_LIBRE } from "@/lib/categories";

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

/** Options de la section « Action » de la page Enveloppes, ouvertes depuis la barre figée. */
const ACTIONS_ENVELOPPES = [
  {
    to: "/enveloppes/details",
    label: "Toutes les enveloppes et leur état",
    detail: "Voir le détail de chaque enveloppe et son solde restant.",
    icone: Layers,
  },
  {
    to: "/enveloppes/creer",
    label: "Créer une enveloppe",
    detail: "Ajouter une nouvelle enveloppe au budget.",
    icone: Plus,
  },
  {
    to: "/enveloppes/gerer",
    label: "Gérer les enveloppes",
    detail: "Modifier ou supprimer une enveloppe existante.",
    icone: Pencil,
  },
  {
    to: "/enveloppes/categories",
    label: "Gérer les catégories et sous-catégories",
    detail: "Créez, renommez ou supprimez vos classements.",
    icone: FolderTree,
  },
  {
    to: "/enveloppes/classer",
    label: "Classer les enveloppes",
    detail: "Ranger chaque enveloppe dans sa catégorie.",
    icone: ListOrdered,
  },
  {
    to: "/enveloppes/renouvellements",
    label: "Détail des renouvellements",
    detail: "Période, montant débité, compte source et part de revenu.",
    icone: RefreshCcw,
  },
  {
    to: "/enveloppes/budgetisation",
    label: "Budget : plan, suivi et proposition",
    detail: "Dépenses planifiées, comparaison au réel, budget auto.",
    icone: Scale,
  },
  {
    to: "/enveloppes/budget-mensuel",
    label: "Budget mensuel",
    detail: "Le budget retenu pour le mois en cours.",
    icone: CalendarRange,
  },
  {
    to: "/enveloppes/chronologie",
    label: "Chronologie des enveloppes",
    detail: "Historique des mouvements et renouvellements.",
    icone: History,
  },
  {
    to: "/enveloppes/secours",
    label: "Plan de secours (enveloppe épuisée)",
    detail: "Transferts sûrs depuis d'autres enveloppes.",
    icone: LifeBuoy,
  },
] as const;

/** Options de la section « Action » de la page Comptes, ouvertes depuis la barre figée. */
const ACTIONS_COMPTES = [
  {
    cle: "comptes-transfert-nouveau",
    to: "/comptes/transferts/nouveau",
    label: "Nouveau transfert entre comptes",
    detail: "Déplacer de l'argent d'un compte vers un autre.",
    icone: ArrowLeftRight,
  },
  {
    cle: "comptes-transferts",
    to: "/comptes/transferts",
    label: "Historique des comptes",
    detail: "Tous les mouvements d'un compte vers un autre.",
    icone: ArrowLeftRight,
  },
  {
    cle: "comptes-creer",
    to: "/comptes/creer",
    label: "Créer un compte",
    detail: "Ajouter un compte avec son solde de départ.",
    icone: Plus,
  },
  {
    cle: "comptes-modifier",
    to: "/comptes/action",
    label: "Renommer ou supprimer un compte",
    detail: "Corriger un nom, ajuster un solde ou retirer un compte.",
    icone: Pencil,
  },
] as const;

/** Titre affiché dans la barre haute selon la page en cours. */
const TITRES: ReadonlyArray<readonly [prefix: string, titre: string]> = [
  ["/revenu", "Ajouter un revenu"],
  ["/depense", "Ajouter une dépense"],
  ["/saisie", "Saisie intelligente"],
  ["/comptes/transferts/nouveau", "Nouveau transfert"],
  ["/comptes/transferts", "Transferts"],
  ["/comptes/creer", "Créer un compte"],
  ["/comptes/action", "Comptes existants"],
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

/** Renvoie le nom de la catégorie d'enveloppe lorsqu'on est sur une route /enveloppes/categorie/:nom. */
function infosCategorie(pathname: string): { titre: string; sousTitre: string } | null {
  const match = pathname.match(/^\/enveloppes\/categorie\/(.+)$/);
  if (!match || !match[1]) return null;
  const nom = decodeURIComponent(match[1]);
  return {
    titre: nom === CATEGORIE_LIBRE ? "Sans catégorie" : nom,
    sousTitre: "Catégorie d'enveloppe",
  };
}

/** Renvoie le nom de la catégorie de compte lorsqu'on est sur une route /comptes/categorie/:nom. */
function infosCategorieComptes(pathname: string): { titre: string; sousTitre: string } | null {
  const match = pathname.match(/^\/comptes\/categorie\/(.+)$/);
  if (!match || !match[1]) return null;
  const nom = decodeURIComponent(match[1]).toLowerCase();
  if (nom === "actifs") return { titre: "Comptes actifs", sousTitre: "Catégorie de compte" };
  if (nom === "passifs") return { titre: "Comptes passifs", sousTitre: "Catégorie de compte" };
  return null;
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
  const [actionOuvert, setActionOuvert] = useState(false);
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const panneau = useRef<HTMLElement>(null);
  const actionBtnRef = useRef<HTMLButtonElement>(null);
  const { nomUtilisateur } = useSuperApp();
  const [entete, setEntete] = useState<{ titre: string; sousTitre: string }>({
    titre: "",
    sousTitre: "",
  });

  const accueil = pathname === "/";
  const pageEnveloppesAccueil =
    pathname === "/enveloppes" || pathname === "/enveloppes/" || pathname === "/enveloppes/details";
  const pageComptesAccueil = pathname === "/comptes" || pathname === "/comptes/";
  const actions = pageComptesAccueil ? ACTIONS_COMPTES : pageEnveloppesAccueil ? ACTIONS_ENVELOPPES : null;
  const categorieInfos = !accueil ? infosCategorie(pathname) || infosCategorieComptes(pathname) : null;
  const titre = accueil
    ? `Bienvenue${nomUtilisateur ? ` ${nomUtilisateur}` : ""}`
    : categorieInfos?.titre || entete.titre || titreDe(pathname);
  const sousTitre = accueil
    ? "Bonjour 👋"
    : categorieInfos?.sousTitre || entete.sousTitre;

  // Fermer après une navigation.
  useEffect(() => {
    setOuvert(false);
    setActionOuvert(false);
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
    const masques = new Set<Element>();
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
      setEntete((p) => (p.titre === t && p.sousTitre === s ? p : { titre: t, sousTitre: s }));

      // Masquer visuellement le titre et son sous-titre dans la page pour éviter le doublon.
      [h1, suivant].forEach((el) => {
        if (!el) return;
        el.classList.add("barre-haute-masque");
        masques.add(el);
      });
    };
    const planifier = () => {
      cancelAnimationFrame(brut);
      brut = requestAnimationFrame(lire);
    };
    planifier();
    const cible = document.querySelector("main");
    const observateur = cible
      ? new MutationObserver((mutations) => {
          // Réappliquer le masque si React recrée ou nettoie les classes.
          mutations.forEach((m) => {
            if (m.type === "attributes" && m.target instanceof Element) {
              const el = m.target;
              if (masques.has(el) && !el.classList.contains("barre-haute-masque")) {
                el.classList.add("barre-haute-masque");
              }
            }
          });
          planifier();
        })
      : null;
    if (cible) {
      observateur?.observe(cible, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }
    return () => {
      cancelAnimationFrame(brut);
      observateur?.disconnect();
      masques.forEach((el) => el.classList.remove("barre-haute-masque"));
      masques.clear();
    };
  }, [pathname, accueil]);

  // Échap ferme le panneau ; le défilement de fond est bloqué quand il est ouvert.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOuvert(false);
        setActionOuvert(false);
      }
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

  useEffect(() => {
    if (!actionOuvert) return;
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = precedent;
    };
  }, [actionOuvert]);

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

          {actions ? (
            <button
              ref={actionBtnRef}
              type="button"
              onClick={() => setActionOuvert((v) => !v)}
              aria-label={actionOuvert ? "Fermer les actions" : "Ouvrir les actions"}
              aria-haspopup="menu"
              aria-expanded={actionOuvert}
              aria-controls="menu-actions-page"
              className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform duration-200 active:scale-95"
            >
              Action
            </button>
          ) : (
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
          )}
        </div>
      </header>

      <div
        onClick={() => setOuvert(false)}
        aria-hidden
        className={`fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          ouvert ? "block opacity-100" : "hidden opacity-0"
        }`}
      />

      <aside
        id="menu-principal"
        ref={panneau}
        role="menu"
        aria-label="Menu principal"
        aria-hidden={!ouvert}
        className={`fixed right-0 top-0 z-[71] flex h-[100dvh] w-[17rem] max-w-[85vw] flex-col border-l border-border bg-card pt-[env(safe-area-inset-top)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
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

      {/* Panneau latéral « Action » réservé à la page Enveloppes. */}
      <div
        onClick={() => setActionOuvert(false)}
        aria-hidden
        className={`fixed inset-0 z-[70] bg-foreground/30 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${
          actionOuvert ? "block opacity-100" : "hidden opacity-0"
        }`}
      />

      <aside
        id="menu-actions-page"
        role="menu"
        aria-label={pageComptesAccueil ? "Actions sur les comptes" : "Actions sur les enveloppes"}
        aria-hidden={!actionOuvert}
        className={`fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-[71] flex max-h-[80dvh] flex-col overflow-y-auto overscroll-contain rounded-b-2xl border-b border-border bg-card px-3 pb-4 pt-3 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          actionOuvert ? "visible translate-y-0" : "invisible -translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="font-semibold">Action</span>
          <button
            type="button"
            onClick={() => setActionOuvert(false)}
            aria-label="Fermer les actions"
            className="rounded-full p-1.5 text-foreground transition-transform duration-200 active:scale-95"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav>
          <ul className="space-y-2">
            {(actions ?? []).map((a) => {
              const Icone = a.icone;
              return (
                <li key={"cle" in a ? a.cle : a.to}>
                  <Link
                    to={a.to}
                    role="menuitem"
                    tabIndex={actionOuvert ? 0 : -1}
                    onClick={() => setActionOuvert(false)}
                    className="carte flex items-start gap-3 p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icone className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{a.label}</span>
                      <span className="block whitespace-normal text-xs leading-snug text-muted-foreground">
                        {a.detail}
                      </span>
                    </span>
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
