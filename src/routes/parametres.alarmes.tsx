import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlarmClock, Volume2 } from "lucide-react";
import { toast } from "sonner";
import {
  debloquerAlarme,
  declencherAlarmeAppareil,
  ecrireReglagesAlarme,
  lireReglagesAlarme,
  REGLAGES_ALARME_DEFAUT,
  type ReglagesAlarme,
} from "@/lib/alarme";
import { demanderPermissionNotification } from "@/lib/alarme-appareil";
import { useSuperApp } from "@/lib/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/parametres/alarmes")({
  head: () => ({
    meta: [
      { title: "Alarmes intelligentes — SUPER APP" },
      {
        name: "description",
        content:
          "Réglez les rappels sonores des dépenses planifiées et les alarmes prédictives calculées localement sur votre téléphone.",
      },
      { property: "og:title", content: "Alarmes intelligentes — SUPER APP" },
      {
        property: "og:description",
        content:
          "Rappels sonores des dépenses planifiées et alarmes de prévision, 100% hors ligne.",
      },
    ],
  }),
  component: PageAlarmes,
});

function PageAlarmes() {
  const { comptes, soldesParCompte } = useSuperApp();
  const [reglages, setReglages] = useState<ReglagesAlarme>(() =>
    typeof window === "undefined" ? REGLAGES_ALARME_DEFAUT : lireReglagesAlarme(),
  );

  function maj(partiel: Partial<ReglagesAlarme>) {
    const suivant = { ...reglages, ...partiel };
    setReglages(suivant);
    ecrireReglagesAlarme(suivant);
  }

  /** Enregistre le seuil d'alerte d'un compte (0 ou vide = pas d'alarme). */
  function majSeuil(compte: string, valeur: string) {
    const n = Number(valeur.replace(/[^0-9]/g, ""));
    const seuils = { ...reglages.seuilsComptes };
    if (Number.isFinite(n) && n > 0) seuils[compte] = n;
    else delete seuils[compte];
    maj({ seuilsComptes: seuils });
  }

  return (
    <div className="space-y-5">
      <section className="carte space-y-1 p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <AlarmClock className="h-5 w-5 text-primary" aria-hidden /> Alarmes intelligentes
        </h1>
        <p className="text-sm text-muted-foreground">
          Rappels sonores des dépenses planifiées et alertes de prévision. Tous les calculs se font
          sur votre téléphone, aucune donnée ne sort de l'application.
        </p>
      </section>

      <section className="carte space-y-4 p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Activer les alarmes
          <input
            type="checkbox"
            checked={reglages.active}
            onChange={(e) => maj({ active: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Son de l'alarme
          <input
            type="checkbox"
            checked={reglages.son}
            onChange={(e) => maj({ son: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <div>
          <label htmlFor="volume" className="text-sm font-medium">
            Volume : {reglages.volume}%
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={100}
            step={5}
            value={reglages.volume}
            onChange={(e) => maj({ volume: Number(e.target.value) })}
            className="mt-2 w-full"
          />
        </div>

        <div>
          <label htmlFor="avance" className="text-sm font-medium">
            Prévenir {reglages.avanceJours} jour(s) avant l'échéance
          </label>
          <input
            id="avance"
            type="range"
            min={0}
            max={15}
            step={1}
            value={reglages.avanceJours}
            onChange={(e) => maj({ avanceJours: Number(e.target.value) })}
            className="mt-2 w-full"
          />
        </div>

        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Vibration du téléphone
          <input
            type="checkbox"
            checked={reglages.vibration}
            onChange={(e) => maj({ vibration: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Notification système (même hors application)
          <input
            type="checkbox"
            checked={reglages.notification}
            onChange={(e) => {
              maj({ notification: e.target.checked });
              if (e.target.checked) void demanderPermissionNotification();
            }}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Alarmes prédictives (épuisement, découvert)
          <input
            type="checkbox"
            checked={reglages.predictions}
            onChange={(e) => maj({ predictions: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Alarme de dépassement du plafond d'une enveloppe
          <input
            type="checkbox"
            checked={reglages.plafonds}
            onChange={(e) => maj({ plafonds: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            void (async () => {
              await debloquerAlarme();
              await declencherAlarmeAppareil({
                volume: reglages.volume,
                urgent: true,
                son: reglages.son,
                vibration: reglages.vibration,
                notification: reglages.notification,
                titre: "Test d'alarme",
                texte: "Voici comment SUPER APP vous préviendra.",
              });
            })();
            toast.success("Alarme de test déclenchée (son, vibration, notification).");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-input px-3 py-2 text-sm font-medium"
        >
          <Volume2 className="h-4 w-4" aria-hidden /> Tester l'alarme
        </button>
      </section>

      <section className="carte space-y-3 p-4">
        <h2 className="text-base font-semibold">Alarmes par compte</h2>
        <p className="text-xs text-muted-foreground">
          Fixez un solde minimal par compte : l'alarme sonne dès que le solde passe en dessous.
          Laissez vide pour désactiver.
        </p>
        {comptes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte enregistré.</p>
        ) : (
          <ul className="space-y-2">
            {comptes.map((compte) => (
              <li key={compte} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{compte}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Solde : {formatFCFA(soldesParCompte[compte] ?? 0)}
                  </span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Seuil d'alerte pour ${compte}`}
                  placeholder="Seuil FCFA"
                  value={reglages.seuilsComptes[compte] ?? ""}
                  onChange={(e) => majSeuil(compte, e.target.value)}
                  className="w-32 rounded-xl border border-input bg-background px-3 py-2 text-right text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
