import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  User,
  ShieldCheck,
  Keyboard,
  RefreshCw,
  Database,
  CloudUpload,
  Mail,
  FileText,
  AlarmClock,
} from "lucide-react";

export const Route = createFileRoute("/parametres/")({
  head: () => ({
    meta: [
      { title: "Paramètres — SUPER APP" },
      {
        name: "description",
        content:
          "Tous les réglages de SUPER APP classés par catégorie : profil, apparence, sécurité, clavier, mises à jour et données locales.",
      },
      { property: "og:title", content: "Paramètres — SUPER APP" },
      {
        property: "og:description",
        content: "Réglages classés par catégorie : profil, sécurité, clavier, données locales.",
      },
    ],
  }),
  component: ParametresAccueil,
});

const GROUPES = [
  {
    titre: "Personnalisation",
    entrees: [
      {
        to: "/parametres/profil",
        icone: User,
        titre: "Profil et apparence",
        detail: "Nom affiché, opacité des surfaces roses, devise et langue.",
      },
      {
        to: "/parametres/clavier",
        icone: Keyboard,
        titre: "Clavier de l'application",
        detail: "Disposition, taille des touches, vibration et son.",
      },
    ],
  },
  {
    titre: "Sécurité et données",
    entrees: [
      {
        to: "/parametres/securite",
        icone: ShieldCheck,
        titre: "Sécurité et verrouillage",
        detail: "Code PIN, empreinte digitale et verrouillage automatique.",
      },
      {
        to: "/parametres/donnees",
        icone: Database,
        titre: "Données locales",
        detail: "Réinitialisation, points de restauration, journal et purge.",
      },
    ],
  },
  {
    titre: "Sauvegarde et partage",
    entrees: [
      {
        to: "/sauvegarde",
        icone: CloudUpload,
        titre: "Sauvegarde et chiffrement local",
        detail: "Export chiffré par phrase secrète et points de restauration.",
      },
      {
        to: "/synchronisation",
        icone: Mail,
        titre: "Synchronisation chiffrée",
        detail: "Fusionnez vos données entre deux appareils, sans fuite.",
      },
    ],
  },
  {
    titre: "Application",
    entrees: [
      {
        to: "/parametres/mises-a-jour",
        icone: RefreshCw,
        titre: "Mises à jour",
        detail: "Version installée et recherche d'une nouvelle version.",
      },
      {
        to: "/parametres/alarmes",
        icone: AlarmClock,
        titre: "Alarmes intelligentes",
        detail: "Rappels sonores des dépenses planifiées et alertes de prévision.",
      },
      {
        to: "/journal",
        icone: FileText,
        titre: "Journal de diagnostic",
        detail: "Erreurs OCR, dictée et prétraitement, export JSON ou CSV.",
      },
    ],
  },
] as const;

function ParametresAccueil() {
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      </header>

      {GROUPES.map((groupe) => (
        <section key={groupe.titre} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {groupe.titre}
          </h2>
          <div className="space-y-2">
            {groupe.entrees.map((entree) => {
              const Icone = entree.icone;
              return (
                <Link
                  key={entree.to}
                  to={entree.to}
                  className="carte flex items-center gap-3 p-4 transition-colors active:bg-accent/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Icone className="h-[1.1rem] w-[1.1rem]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{entree.titre}</span>
                    <span className="block text-xs text-muted-foreground">{entree.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
