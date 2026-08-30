import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useSuperApp } from "@/lib/store";
import { SectionSecurite } from "@/components/SectionSecurite";
import { SectionClavier } from "@/components/SectionClavier";
import { SectionMiseAJour } from "@/components/SectionMiseAJour";
import { SectionPurge } from "@/components/SectionPurge";
import { SectionRestauration } from "@/components/SectionRestauration";
import { JournalDonnees } from "@/components/JournalDonnees";

export const Route = createFileRoute("/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — Transparence du thème rose" },
      {
        name: "description",
        content:
          "Réglez manuellement la transparence des surfaces roses de l'application et gérez vos données locales.",
      },
      { property: "og:title", content: "Paramètres — SUPER APP" },
      {
        property: "og:description",
        content: "Transparence ajustable du thème rose et gestion des données locales.",
      },
    ],
  }),
  component: Parametres,
});

function Parametres() {
  const { transparence, definirTransparence, reinitialiser } = useSuperApp();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Retour à l'accueil"
          className="surface rounded-full border border-border p-2 text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
      </header>

      <Link
        to="/sauvegarde"
        className="carte flex items-center justify-between gap-3 p-4 text-sm font-semibold"
      >
        <span>
          Sauvegarde et chiffrement local
          <span className="block text-xs font-normal text-muted-foreground">
            Export chiffré par phrase secrète, export lisible et points de restauration.
          </span>
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden />
      </Link>

      <Link
        to="/synchronisation"
        className="carte flex items-center justify-between gap-3 p-4 text-sm font-semibold"
      >
        <span>
          Synchronisation chiffrée par e-mail
          <span className="block text-xs font-normal text-muted-foreground">
            Envoyez un colis chiffré et fusionnez vos données entre deux appareils.
          </span>
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden />
      </Link>

      <Link
        to="/journal"
        className="carte flex items-center justify-between gap-3 p-4 text-sm font-semibold"
      >
        <span>
          Journal de diagnostic
          <span className="block text-xs font-normal text-muted-foreground">
            Erreurs OCR, dictée vocale et prétraitement, avec export JSON ou CSV.
          </span>
        </span>
        <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" aria-hidden />
      </Link>

      <section className="carte p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="transparence" className="font-semibold">
            Opacité des surfaces roses
          </label>
          <span className="text-sm font-semibold text-primary">{transparence} %</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Faites glisser pour rendre les cartes plus ou moins transparentes.
        </p>
        <input
          id="transparence"
          type="range"
          min={20}
          max={100}
          step={1}
          value={transparence}
          onChange={(e) => definirTransparence(Number(e.target.value))}
          className="mt-4 w-full accent-[var(--primary)]"
        />
      </section>

      <SectionSecurite />

      <SectionClavier />

      <SectionMiseAJour />

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Devise et langue</h2>
        <p className="text-sm text-muted-foreground">
          Franc CFA (XOF / XAF) · Interface entièrement en français.
        </p>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="font-semibold">Données locales</h2>
        <p className="text-sm text-muted-foreground">
          Toutes vos opérations sont stockées sur cet appareil uniquement.
        </p>
        <button
          type="button"
          onClick={() => reinitialiser()}
          className="w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive"
        >
          Réinitialiser les données
        </button>
      </section>

      <SectionRestauration />

      <JournalDonnees />

      <SectionPurge />
    </div>
  );
}
