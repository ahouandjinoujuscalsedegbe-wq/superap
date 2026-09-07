import { useEffect, useState } from "react";
import { Eye, History, KeyRound, ShieldAlert, Vault } from "lucide-react";
import {
  abonnerOptions,
  definirCodeCamouflage,
  ecrireOptions,
  lireJournalAcces,
  lireOptions,
  retirerCodeCamouflage,
  viderJournalAcces,
  type EvenementAcces,
  type OptionsSecurite,
} from "@/lib/securite-avancee";
import {
  coffreSensibleConfigure,
  definirPhraseSensible,
  refermerCoffreSensible,
  retirerCoffreSensible,
} from "@/lib/coffre-sensible";

type Bascule = {
  cle: keyof OptionsSecurite;
  titre: string;
  detail: string;
};

const BASCULES: Bascule[] = [
  {
    cle: "pinObligatoire",
    titre: "Code obligatoire dès l'ouverture",
    detail: "L'application demande de créer un code au premier lancement.",
  },
  {
    cle: "pinPremierDuJour",
    titre: "Code requis une fois par jour",
    detail: "L'empreinte reste possible, mais le code est exigé au premier déverrouillage du jour.",
  },
  {
    cle: "masquageArrierePlan",
    titre: "Masquer les montants en arrière-plan",
    detail: "Vos chiffres disparaissent dès que vous quittez l'application.",
  },
  {
    cle: "verrouActionsSensibles",
    titre: "Protéger les actions sensibles",
    detail: "Suppression définitive, purge et sauvegarde demandent le code.",
  },
  {
    cle: "journalAcces",
    titre: "Journal des accès",
    detail: "Garde la trace locale des ouvertures et des tentatives ratées.",
  },
  {
    cle: "blocageCaptures",
    titre: "Bloquer les captures d'écran",
    detail: "Interdit les captures et les aperçus dans la liste des applications.",
  },
  {
    cle: "derivationForte",
    titre: "Chiffrement renforcé (Argon2id)",
    detail: "Rend les tentatives de devinette du code beaucoup plus lentes.",
  },
];

const LIBELLES: Record<EvenementAcces["type"], string> = {
  ouverture: "Ouverture",
  deverrouillage: "Déverrouillage",
  echec: "Code incorrect",
  verrouillage: "Verrouillage",
  camouflage: "Mode camouflage",
  effacement: "Effacement de sécurité",
};

/** Réglages avancés de sécurité (tout reste sur l'appareil). */
export function SectionSecuriteAvancee() {
  const [options, setOptions] = useState(() => lireOptions());
  const [journal, setJournal] = useState<EvenementAcces[]>([]);
  const [voirJournal, setVoirJournal] = useState(false);
  const [codeCamouflage, setCodeCamouflage] = useState("");
  const [phrase, setPhrase] = useState("");
  const [message, setMessage] = useState("");
  const [coffreSensible, setCoffreSensible] = useState(false);

  useEffect(() => {
    setJournal(lireJournalAcces());
    setCoffreSensible(coffreSensibleConfigure());
    return abonnerOptions(setOptions);
  }, []);

  const basculer = (cle: keyof OptionsSecurite) => {
    setOptions(ecrireOptions({ [cle]: !options[cle] } as Partial<OptionsSecurite>));
  };

  return (
    <section className="carte space-y-4 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="font-semibold">Protections renforcées</h2>
      </div>

      <div className="space-y-2">
        {BASCULES.map((b) => (
          <button
            key={b.cle}
            type="button"
            onClick={() => basculer(b.cle)}
            className="flex w-full items-start justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold">{b.titre}</span>
              <span className="block text-xs text-muted-foreground">{b.detail}</span>
            </span>
            <span
              className={`shrink-0 text-xs font-semibold ${
                options[b.cle] ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {options[b.cle] ? "Activé" : "Désactivé"}
            </span>
          </button>
        ))}
      </div>

      {/* Effacement automatique après échecs */}
      <div className="space-y-2">
        <label htmlFor="effacement" className="text-sm font-semibold">
          Effacer les données après des échecs répétés
        </label>
        <select
          id="effacement"
          value={options.effacementApresEchecs}
          onChange={(e) =>
            setOptions(ecrireOptions({ effacementApresEchecs: Number(e.target.value) }))
          }
          className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
        >
          <option value={3}>Après 3 codes faux (recommandé)</option>
          <option value={5}>Après 5 codes faux</option>
          <option value={10}>Après 10 codes faux</option>
          <option value={0}>Jamais</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Attention : l'effacement est définitif. Gardez une sauvegarde par e-mail à jour.
        </p>
      </div>

      {/* Mode camouflage */}
      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="h-4 w-4 text-primary" aria-hidden />
          Mode camouflage
        </p>
        <p className="text-xs text-muted-foreground">
          Un second code ouvre une version fictive de l'application : personne ne voit vos vraies
          données.
        </p>
        {options.camouflageActif ? (
          <button
            type="button"
            onClick={() => {
              retirerCodeCamouflage();
              setOptions(lireOptions());
              setMessage("Code de camouflage supprimé.");
            }}
            className="w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive"
          >
            Supprimer le code de camouflage
          </button>
        ) : (
          <div className="space-y-2">
            <input
              inputMode="numeric"
              value={codeCamouflage}
              onChange={(e) => setCodeCamouflage(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Code de camouflage (4 à 6 chiffres)"
              className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={codeCamouflage.length < 4}
              onClick={() =>
                void definirCodeCamouflage(codeCamouflage).then(() => {
                  setCodeCamouflage("");
                  setOptions(lireOptions());
                  setMessage("Code de camouflage enregistré.");
                })
              }
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Enregistrer ce code
            </button>
          </div>
        )}
      </div>

      {/* Double coffre */}
      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Vault className="h-4 w-4 text-primary" aria-hidden />
          Deuxième coffre
        </p>
        <p className="text-xs text-muted-foreground">
          Objectifs, dettes, sauvegarde et journal réclament une phrase distincte du code quotidien.
        </p>
        <input
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={coffreSensible ? "Phrase actuelle" : "Nouvelle phrase (8 caractères min.)"}
          className="surface w-full rounded-xl border border-border px-3 py-2.5 text-sm"
        />
        {coffreSensible ? (
          <button
            type="button"
            onClick={() =>
              void retirerCoffreSensible(phrase).then((ok) => {
                setPhrase("");
                setCoffreSensible(coffreSensibleConfigure());
                setOptions(ecrireOptions({ doubleCoffre: !ok && options.doubleCoffre }));
                setMessage(ok ? "Deuxième coffre supprimé." : "Phrase incorrecte.");
              })
            }
            className="w-full rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-semibold text-destructive"
          >
            Supprimer le deuxième coffre
          </button>
        ) : (
          <button
            type="button"
            disabled={phrase.length < 8}
            onClick={() =>
              void definirPhraseSensible(phrase).then(() => {
                setPhrase("");
                setCoffreSensible(true);
                setOptions(ecrireOptions({ doubleCoffre: true }));
                setMessage("Deuxième coffre activé.");
              })
            }
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Activer le deuxième coffre
          </button>
        )}
        {coffreSensible && (
          <button
            type="button"
            onClick={() => {
              refermerCoffreSensible();
              setMessage("Deuxième coffre refermé.");
            }}
            className="w-full rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            Refermer maintenant
          </button>
        )}
      </div>

      {/* Journal d'accès */}
      <div className="space-y-2 rounded-xl border border-border p-3">
        <button
          type="button"
          onClick={() => {
            setJournal(lireJournalAcces());
            setVoirJournal((v) => !v);
          }}
          className="flex w-full items-center justify-between text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden />
            Journal des accès
          </span>
          <span className="text-xs text-muted-foreground">{voirJournal ? "Masquer" : "Voir"}</span>
        </button>
        {voirJournal && (
          <div className="space-y-2">
            {journal.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun accès enregistré.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                {journal.map((e, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-border py-1">
                    <span className="font-semibold">{LIBELLES[e.type]}</span>
                    <span className="text-muted-foreground">
                      {new Date(e.date).toLocaleString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                viderJournalAcces();
                setJournal([]);
              }}
              className="w-full rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Vider le journal
            </button>
          </div>
        )}
      </div>

      {message && (
        <p className="flex items-center gap-2 text-xs font-semibold text-primary">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          {message}
        </p>
      )}
    </section>
  );
}
