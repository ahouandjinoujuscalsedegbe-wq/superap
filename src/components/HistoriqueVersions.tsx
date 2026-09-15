import { useState } from "react";
import { CloudUpload, History, Mail, RotateCcw, Trash2 } from "lucide-react";
import {
  lireVersions,
  ouvrirColisColle,
  ouvrirVersion,
  supprimerVersion,
  tailleTotaleVersions,
  viderVersions,
  VERSIONS_MAX,
  type VersionSauvegarde,
} from "@/lib/versions-sauvegarde";
import { lirePhrase } from "@/lib/sauvegarde-email";
import { demanderMotDePasse } from "@/lib/mot-de-passe-actions";
import type { Etat } from "@/lib/store";

function dateLisible(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fr-FR");
}

function poids(octets: number) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Historique des versions : l'e-mail garde toutes les copies chiffrées, et
 * cette liste permet de revenir à la copie d'une date précise.
 */
export function HistoriqueVersions({
  onRestaurer,
}: {
  onRestaurer: (etat: Partial<Etat>, source: string) => void;
}) {
  const [versions, setVersions] = useState<VersionSauvegarde[]>(() =>
    typeof window === "undefined" ? [] : lireVersions(),
  );
  const [phrase, setPhrase] = useState("");
  const [colisColle, setColisColle] = useState("");
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");

  const phraseUtilisable = async () => phrase.trim() || (await lirePhrase()) || "";

  const restaurer = async (version: VersionSauvegarde) => {
    setErreur("");
    setInfo("");
    const secret = await phraseUtilisable();
    if (!secret) {
      setErreur("Saisissez votre phrase de récupération pour ouvrir cette copie.");
      return;
    }
    try {
      const donnees = await ouvrirVersion<Partial<Etat>>(version, secret);
      if (!donnees || !Array.isArray(donnees.transactions)) {
        setErreur("Cette copie ne contient pas de données SUPER APP valides.");
        return;
      }
      onRestaurer(donnees, `copie du ${dateLisible(version.creeLe)}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Copie illisible.");
    }
  };

  const restaurerColle = async () => {
    setErreur("");
    setInfo("");
    if (!colisColle.trim()) {
      setErreur("Collez le contenu de l'e-mail de sauvegarde à restaurer.");
      return;
    }
    const secret = await phraseUtilisable();
    if (!secret) {
      setErreur("Saisissez votre phrase de récupération.");
      return;
    }
    try {
      const extrait = colisColle.slice(colisColle.indexOf("SAM5:"));
      const donnees = await ouvrirColisColle<Partial<Etat>>(extrait, secret);
      if (!donnees || !Array.isArray(donnees.transactions)) {
        setErreur("Ce contenu ne correspond pas à une copie SUPER APP.");
        return;
      }
      onRestaurer(donnees, "copie reçue par e-mail");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Contenu illisible.");
    }
  };

  const retirer = async (id: string) => {
    if (!(await demanderMotDePasse("Supprimer cette copie datée"))) return;
    setVersions(supprimerVersion(id));
    setInfo("Copie retirée de cet appareil. L'e-mail correspondant existe toujours.");
  };

  const toutVider = async () => {
    if (!(await demanderMotDePasse("Vider l'historique des copies"))) return;
    viderVersions();
    setVersions([]);
    setInfo("Historique local vidé. Vos e-mails de sauvegarde restent intacts.");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-primary" aria-hidden /> Historique des versions
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Votre boîte e-mail conserve toutes les copies chiffrées : c'est votre coffre-fort. Ici,{" "}
        {VERSIONS_MAX} copies datées restent à portée de main pour revenir à un jour précis.
      </p>

      <label className="mt-3 block text-xs font-medium">
        Phrase de récupération
        <input
          type="password"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="Laissez vide si elle est déjà enregistrée"
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      {versions.length === 0 ? (
        <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          Aucune copie datée pour l'instant. Dès la prochaine sauvegarde, elle apparaîtra ici.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{dateLisible(v.creeLe)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {v.appareil} · {poids(v.taille)} ·{" "}
                  {v.envoyee ? "envoyée par e-mail" : "en attente d'envoi"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void restaurer(v)}
                  aria-label="Restaurer cette copie"
                  title="Restaurer cette copie"
                  className="rounded-lg border border-border p-2 text-primary"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void retirer(v.id)}
                  aria-label="Supprimer cette copie"
                  title="Supprimer cette copie"
                  className="rounded-lg border border-border p-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-xl bg-muted/40 p-3">
        <p className="flex items-center gap-2 text-xs font-medium">
          <Mail className="h-4 w-4 text-primary" aria-hidden /> Restaurer une copie reçue par e-mail
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Ouvrez l'e-mail de la date souhaitée, copiez tout le message, puis collez-le ici.
        </p>
        <textarea
          value={colisColle}
          onChange={(e) => setColisColle(e.target.value)}
          rows={3}
          placeholder="Collez ici le contenu de l'e-mail (SAM5:...)"
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={() => void restaurerColle()}
          className="mt-2 flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <CloudUpload className="h-4 w-4" aria-hidden /> Ouvrir cette copie
        </button>
      </div>

      {versions.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Espace utilisé sur l'appareil : {poids(tailleTotaleVersions(versions))}</span>
          <button type="button" onClick={() => void toutVider()} className="underline">
            Vider l'historique local
          </button>
        </div>
      )}

      {erreur && <p className="mt-3 text-xs text-destructive">{erreur}</p>}
      {info && <p className="mt-3 text-xs text-primary">{info}</p>}
    </section>
  );
}
