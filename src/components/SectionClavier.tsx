import { useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  jouerClic,
  majReglagesClavier,
  reinitialiserClavier,
  useReglagesClavier,
  vibrerTouche,
  type Disposition,
  type Intensite,
  type Taille,
} from "@/lib/clavier-reglages";

/** Interrupteur simple réutilisé par tous les réglages du clavier. */
function Bascule({
  titre,
  description,
  valeur,
  onChange,
}: {
  titre: string;
  description: string;
  valeur: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-secondary/40 p-3">
      <input
        type="checkbox"
        checked={valeur}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium">{titre}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/** Groupe de boutons pour choisir une valeur parmi plusieurs. */
function Choix<T extends string>({
  titre,
  options,
  valeur,
  onChange,
}: {
  titre: string;
  options: { valeur: T; label: string }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-sm font-medium">{titre}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            onClick={() => onChange(o.valeur)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              valeur === o.valeur
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Réglages complets du clavier interne, dans les Paramètres. */
export function SectionClavier() {
  const r = useReglagesClavier();
  const [essai, setEssai] = useState("");

  return (
    <section className="carte space-y-3 p-4">
      <header className="flex items-center gap-2">
        <Keyboard className="h-5 w-5 text-primary" aria-hidden />
        <div className="flex-1">
          <h2 className="font-semibold">Clavier de l’application</h2>
          <p className="text-xs text-muted-foreground">
            Vibrations, son, disposition et confort de frappe.
          </p>
        </div>
      </header>

      <Bascule
        titre="Utiliser le clavier de l’application"
        description="Désactivez pour revenir au clavier du téléphone."
        valeur={r.actif}
        onChange={(actif) => majReglagesClavier({ actif })}
      />

      <Bascule
        titre="Vibration sous le doigt"
        description="Chaque touche déclenche une courte vibration."
        valeur={r.vibration}
        onChange={(vibration) => {
          majReglagesClavier({ vibration });
          if (vibration) vibrerTouche();
        }}
      />

      {r.vibration && (
        <Choix<Intensite>
          titre="Intensité de la vibration"
          valeur={r.intensiteVibration}
          options={[
            { valeur: "legere", label: "Légère" },
            { valeur: "moyenne", label: "Moyenne" },
            { valeur: "forte", label: "Forte" },
          ]}
          onChange={(intensiteVibration) => {
            majReglagesClavier({ intensiteVibration });
            vibrerTouche(intensiteVibration);
          }}
        />
      )}

      <Bascule
        titre="Clic sonore"
        description="Un petit son accompagne chaque appui."
        valeur={r.son}
        onChange={(son) => {
          majReglagesClavier({ son });
          if (son) jouerClic(r.volumeSon);
        }}
      />

      {r.son && (
        <div className="rounded-xl bg-secondary/40 p-3">
          <label className="text-sm font-medium" htmlFor="volume-clavier">
            Volume du clic : {Math.round(r.volumeSon * 100)} %
          </label>
          <input
            id="volume-clavier"
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={r.volumeSon}
            onChange={(e) => majReglagesClavier({ volumeSon: Number(e.target.value) })}
            onMouseUp={() => jouerClic()}
            onTouchEnd={() => jouerClic()}
            className="mt-2 w-full"
          />
        </div>
      )}

      <Choix<Disposition>
        titre="Disposition des lettres"
        valeur={r.disposition}
        options={[
          { valeur: "azerty", label: "AZERTY" },
          { valeur: "qwerty", label: "QWERTY" },
          { valeur: "alphabetique", label: "A B C" },
        ]}
        onChange={(disposition) => majReglagesClavier({ disposition })}
      />

      <Choix<Taille>
        titre="Taille des touches"
        valeur={r.taille}
        options={[
          { valeur: "compacte", label: "Compacte" },
          { valeur: "normale", label: "Normale" },
          { valeur: "grande", label: "Grande" },
        ]}
        onChange={(taille) => majReglagesClavier({ taille })}
      />

      <Bascule
        titre="Retour visuel des touches"
        description="La touche s’illumine et s’enfonce à l’appui."
        valeur={r.retourVisuel}
        onChange={(retourVisuel) => majReglagesClavier({ retourVisuel })}
      />

      <Bascule
        titre="Rangée de chiffres"
        description="Affiche 1 à 0 au-dessus des lettres."
        valeur={r.rangeeChiffres}
        onChange={(rangeeChiffres) => majReglagesClavier({ rangeeChiffres })}
      />

      <Bascule
        titre="Lettres accentuées"
        description="Affiche é, è, ê, à, ç, ù, ô, î."
        valeur={r.accents}
        onChange={(accents) => majReglagesClavier({ accents })}
      />

      <Bascule
        titre="Tout écrire en majuscules"
        description="Conserve la saisie en majuscules dans toute l’application."
        valeur={r.majusculesAuto}
        onChange={(majusculesAuto) => majReglagesClavier({ majusculesAuto })}
      />

      <Bascule
        titre="Raccourcis de montants"
        description="Touches 000, +1 000, +5 000 et +10 000 sur le pavé numérique."
        valeur={r.raccourcisMontants}
        onChange={(raccourcisMontants) => majReglagesClavier({ raccourcisMontants })}
      />

      <Bascule
        titre="Effacement continu"
        description="Maintenez la touche effacer pour supprimer lettre après lettre."
        valeur={r.effacementContinu}
        onChange={(effacementContinu) => majReglagesClavier({ effacementContinu })}
      />

      <Bascule
        titre="Touche « tout effacer »"
        description="Vide le champ entier en un seul appui."
        valeur={r.toucheToutEffacer}
        onChange={(toucheToutEffacer) => majReglagesClavier({ toucheToutEffacer })}
      />

      <Bascule
        titre="Garder le clavier ouvert"
        description="Le clavier reste affiché après validation d’un champ."
        valeur={r.resterOuvert}
        onChange={(resterOuvert) => majReglagesClavier({ resterOuvert })}
      />

      <Bascule
        titre="Suggestions de mots"
        description="Le clavier apprend vos mots et les propose au-dessus des touches."
        valeur={r.suggestions}
        onChange={(suggestions) => majReglagesClavier({ suggestions })}
      />

      <Bascule
        titre="Correction automatique"
        description="Corrige le mot en cours dès l’appui sur la barre d’espace."
        valeur={r.correctionAuto}
        onChange={(correctionAuto) => majReglagesClavier({ correctionAuto })}
      />

      <Bascule
        titre="Bulle d’aperçu"
        description="La lettre appuyée s’affiche en grand au-dessus de la touche."
        valeur={r.apercuTouche}
        onChange={(apercuTouche) => majReglagesClavier({ apercuTouche })}
      />

      <Bascule
        titre="Appui long : accents et chiffres"
        description="Maintenez une lettre pour choisir é, è, ç… ou le chiffre caché."
        valeur={r.appuiLong}
        onChange={(appuiLong) => majReglagesClavier({ appuiLong })}
      />

      <Bascule
        titre="Curseur par glissement"
        description="Faites glisser le doigt sur la barre d’espace pour déplacer le curseur."
        valeur={r.glissementEspace}
        onChange={(glissementEspace) => majReglagesClavier({ glissementEspace })}
      />

      <Bascule
        titre="Panneau d’émojis"
        description="Ajoute un onglet émojis avec vos favoris récents."
        valeur={r.emojis}
        onChange={(emojis) => majReglagesClavier({ emojis })}
      />

      <Bascule
        titre="Barre d’outils"
        description="Émojis, flèches de curseur, copier, coller et tout effacer."
        valeur={r.barreOutils}
        onChange={(barreOutils) => majReglagesClavier({ barreOutils })}
      />

      <Bascule
        titre="Clavier sombre"
        description="Fond sombre du clavier, comme le mode nuit d’Android."
        valeur={r.themeSombre}
        onChange={(themeSombre) => majReglagesClavier({ themeSombre })}
      />


      <div className="rounded-xl bg-secondary/40 p-3">
        <label className="text-sm font-medium" htmlFor="essai-clavier">
          Champ d’essai
        </label>
        <input
          id="essai-clavier"
          value={essai}
          onChange={(e) => setEssai(e.target.value)}
          placeholder="TAPEZ ICI POUR TESTER"
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          reinitialiserClavier();
          toast.success("Réglages du clavier réinitialisés.");
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-semibold"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Réinitialiser les réglages du clavier
      </button>
    </section>
  );
}
