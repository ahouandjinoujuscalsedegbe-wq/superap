import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SuperAppProvider } from "@/lib/store";
import { EcheancesAuto } from "@/components/EcheancesAuto";
import { RemplissageAuto } from "@/components/RemplissageAuto";
import { RappelBudgetMensuel } from "@/components/RappelBudgetMensuel";
import { BottomNav } from "../components/BottomNav";
import { MenuPrincipal } from "../components/MenuPrincipal";
import { ClavierInterne } from "../components/ClavierInterne";
import { MajusculesPartout } from "../components/MajusculesPartout";
import { installerCaptureGlobale } from "@/lib/journal";

import { SecuriteProvider } from "@/lib/securite";
import { EcranVerrou } from "../components/EcranVerrou";
import { MiseAJourAuto } from "../components/MiseAJourAuto";
import { SyncAuto } from "../components/SyncAuto";
import { AlerteStockage } from "../components/AlerteStockage";
import { Toaster } from "sonner";
import { AlarmeIntelligente } from "../components/AlarmeIntelligente";
import { BouleAnalyse } from "@/components/BouleAnalyse";
import { useCapacitorBackButton } from "../hooks/use-capacitor-back-button";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SUPER APP — Budget du foyer en FCFA" },
      {
        name: "description",
        content:
          "Application de gestion budgétaire du foyer en francs CFA : enveloppes, revenus et dépenses, 100% en local.",
      },
      { property: "og:title", content: "SUPER APP — Budget du foyer en FCFA" },
      {
        property: "og:description",
        content: "Enveloppes, revenus et dépenses du foyer en francs CFA, hors ligne.",
      },
      { name: "theme-color", content: "#f8dbe6" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Build mobile (Capacitor) : le document HTML existe déjà (index.html) et
  // React s'insère dans <div id="root">. Recréer <html>/<body> ici casserait
  // l'arbre du DOM et figerait l'application dès le premier champ de saisie.
  if (import.meta.env["VITE_COQUE_MOBILE"]) {
    return <>{children}</>;
  }

  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useCapacitorBackButton();

  // Capture des erreurs non gérées dans le journal de diagnostic.
  useEffect(() => installerCaptureGlobale(), []);

  // Une navigation doit toujours repartir avec une surface propre : aucun
  // clavier ou panneau de la page précédente ne doit rester au-dessus.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }, [pathname]);

  // Plein écran pour les conversations immersives (coach, discussion vocale).
  const pleinEcran = pathname === "/notifications";

  return (
    <QueryClientProvider client={queryClient}>
      <SecuriteProvider>
        <SuperAppProvider>
          <main className="app-page-shell safe-area-top mx-auto min-h-screen w-full max-w-md px-3 sm:px-4">
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <div key={pathname}>
              <Outlet />
            </div>
          </main>

          <EcheancesAuto />
          <RemplissageAuto />
          <MenuPrincipal />
          {!pleinEcran && <BottomNav />}
          <ClavierInterne />
          <MajusculesPartout />
          <Toaster position="top-center" richColors />
          <EcranVerrou />
          <MiseAJourAuto />
          <SyncAuto />
          <AlerteStockage />
          <AlarmeIntelligente />
          <RappelBudgetMensuel />
          <BouleAnalyse />
        </SuperAppProvider>
      </SecuriteProvider>
    </QueryClientProvider>
  );
}
