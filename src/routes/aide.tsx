import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Shield,
  Smartphone,
  Users,
  Lightbulb,
  Calendar,
  Search,
  Bell,
  Lock,
  HelpCircle,
  Target,
  Handshake,
  Camera,
  Keyboard,
  RefreshCw,
  LifeBuoy,
  ArrowLeft,
  BarChart3,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Aide et guides — SUPER APP" },
      {
        name: "description",
        content:
          "Guides pas à pas : comptes, enveloppes, revenus et dépenses, dettes, objectifs, budget, simulation, conseiller local, sécurité et sauvegarde chiffrée.",
      },
      { property: "og:title", content: "Aide et guides — SUPER APP" },
      {
        property: "og:description",
        content:
          "Tous les guides d'utilisation du budget familial en FCFA : premiers pas, fonctions avancées, sécurité et dépannage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Aide,
});

type Lien = { to: string; libelle: string };

type Guide = {
  id: string;
  icone: typeof Wallet;
  titre: string;
  resume: string;
  etapes: string[];
  liens?: Lien[];
  motsCles: string;
};

const DEMARRAGE: string[] = [
  "Créez vos comptes : espèces, banque, MoMo, Moov Money, Wave, carte… et indiquez pour chacun s'il compte dans le solde disponible.",
  "Créez vos enveloppes : nourriture, transport, scolarité, santé, loisirs… avec un montant mensuel pour chacune.",
  "Enregistrez vos revenus du mois depuis l'accueil.",
  "Enregistrez vos dépenses : l'enveloppe est reconnue automatiquement et le compte est déduit tout seul.",
  "Regardez le bilan et les rapports pour comprendre où part l'argent.",
];

const GUIDES: Guide[] = [
  {
    id: "comptes",
    icone: Wallet,
    titre: "Les comptes",
    resume:
      "Chaque endroit où se trouve votre argent est un compte. Le total de vos comptes inclus forme le solde disponible.",
    etapes: [
      "Ouvrez « Les comptes » puis « Action » pour créer, modifier ou supprimer un compte.",
      "À la création, choisissez si le compte entre dans le solde disponible. Une épargne, un compte réservé ou le solde Diamant peuvent en être exclus.",
      "Les transferts entre comptes se font depuis « Transferts » ; vous pouvez indiquer les frais et qui les supporte.",
      "L'historique d'un compte montre chaque mouvement avec la date, l'heure, le libellé et les frais.",
    ],
    liens: [
      { to: "/comptes", libelle: "Ouvrir les comptes" },
      { to: "/comptes/transferts/nouveau", libelle: "Faire un transfert" },
    ],
    motsCles: "compte banque momo wave especes solde transfert frais",
  },
  {
    id: "enveloppes",
    icone: PiggyBank,
    titre: "Les enveloppes",
    resume:
      "Une enveloppe est une petite tirelire virtuelle par besoin. Elle vous dit à tout moment ce qu'il vous reste pour ce besoin.",
    etapes: [
      "Créez vos enveloppes par catégorie et sous-catégorie pour les retrouver facilement.",
      "Le 1er de chaque mois, toutes les enveloppes se rechargent automatiquement à leur montant prévu.",
      "Pendant les deux premiers jours du mois, des rappels vous invitent à ajuster le budget avant qu'il ne s'applique.",
      "Quand une enveloppe est presque vide ou dépassée, une alerte apparaît sur l'accueil et sur la page de dépense.",
      "Si une enveloppe manque d'argent, « Secours » vous montre celles qui peuvent l'aider sans se mettre en danger.",
    ],
    liens: [
      { to: "/enveloppes", libelle: "Ouvrir les enveloppes" },
      { to: "/enveloppes/secours", libelle: "Secours d'une enveloppe" },
    ],
    motsCles: "enveloppe budget mensuel renouvellement alerte depassement secours",
  },
  {
    id: "operations",
    icone: TrendingUp,
    titre: "Revenus, dépenses et frais",
    resume:
      "Toute entrée et toute sortie d'argent s'enregistre en quelques secondes, avec les frais éventuels.",
    etapes: [
      "« Ajouter un revenu » : montant, source, compte de réception, frais éventuels. Vous voyez le montant réellement reçu.",
      "« Ajouter une dépense » : montant, libellé, frais. L'enveloppe est proposée automatiquement et le compte en découle.",
      "Si la reconnaissance se trompe, appuyez sur « Changer », ou reclassez plus tard avec « Classement manuel » dans l'historique.",
      "Les montants s'affichent toujours avec des séparateurs de milliers, en francs CFA.",
    ],
    liens: [
      { to: "/revenu", libelle: "Ajouter un revenu" },
      { to: "/depense", libelle: "Ajouter une dépense" },
      { to: "/historique/depenses", libelle: "Historique des dépenses" },
      { to: "/historique/revenus", libelle: "Historique des revenus" },
    ],
    motsCles: "revenu depense frais montant recu classement manuel historique",
  },
  {
    id: "budget",
    icone: Calendar,
    titre: "Budgétisation et suivi",
    resume:
      "Prévoyez le mois, puis comparez ce que vous aviez prévu avec ce que vous avez réellement dépensé.",
    etapes: [
      "« Budgétisation » regroupe le plan du mois, le bilan et le suivi.",
      "Le budget automatique analyse vos derniers mois et propose des montants. Vous choisissez les dates, modifiez chaque ligne, excluez ce que vous voulez, puis appliquez.",
      "Le suivi planifié/réel compare mois par mois, par enveloppe, catégorie ou libellé, avec des couleurs claires.",
      "Les dépenses planifiées actives ne sont pas recomptées dans la proposition automatique.",
    ],
    liens: [
      { to: "/budget", libelle: "Ouvrir la budgétisation" },
      { to: "/budget/suivi", libelle: "Suivi planifié / réel" },
      { to: "/rapport", libelle: "Rapports mensuels" },
    ],
    motsCles: "budget plan bilan suivi planifie reel rapport mois",
  },
  {
    id: "objectifs",
    icone: Target,
    titre: "Objectifs : épargne, achat, tontine",
    resume:
      "Un objectif vous aide à mettre de côté régulièrement pour un projet, un achat programmé ou une tontine.",
    etapes: [
      "La page « Objectifs » ne fait qu'afficher vos objectifs classés par type ; toutes les actions passent par le bouton « Action ».",
      "« Créer un nouvel objectif » ouvre un assistant guidé : type, montant visé, échéance, compte, enveloppe et prélèvement automatique.",
      "« Modifier, clôturer ou supprimer » ouvre la page de gestion d'un objectif existant.",
      "Les rappels se règlent librement (de 1 à 31 jours, semaines, mois ou années). Vous répondez Oui ou Non, et une confirmation peut créer le versement.",
      "L'historique des rappels garde la trace de chaque réponse.",
    ],
    liens: [
      { to: "/objectifs", libelle: "Voir mes objectifs" },
      { to: "/objectifs/action", libelle: "Actions sur les objectifs" },
    ],
    motsCles: "objectif epargne achat tontine rappel versement prelevement",
  },
  {
    id: "dettes",
    icone: Handshake,
    titre: "Dettes et créances",
    resume: "Suivez ce que vous devez et ce qu'on vous doit, avec les remboursements partiels.",
    etapes: [
      "Enregistrez une dette ou une créance avec la personne concernée, le montant et l'échéance.",
      "Chaque remboursement, même partiel, met le solde à jour.",
      "Les échéances proches vous sont rappelées.",
    ],
    liens: [{ to: "/dettes", libelle: "Ouvrir dettes et créances" }],
    motsCles: "dette creance pret remboursement echeance",
  },
  {
    id: "simulation",
    icone: BarChart3,
    titre: "Simulation avant de décider",
    resume:
      "Avant de vous engager, voyez l'effet d'une décision sur votre argent, jusqu'à douze mois à l'avance.",
    etapes: [
      "Six scénarios : objectif, dépense, tontine, dette, revenu et économie.",
      "Chaque simulation donne un verdict clair, une trajectoire sur les mois à venir et des conseils.",
      "Des suggestions prêtes à l'emploi sont proposées à partir de vos propres opérations, enveloppes, objectifs et dettes.",
    ],
    liens: [{ to: "/simulation", libelle: "Ouvrir la simulation" }],
    motsCles: "simulation scenario projection avant achat decision",
  },
  {
    id: "conseiller",
    icone: Lightbulb,
    titre: "Mon conseiller",
    resume:
      "Un assistant qui vit dans votre téléphone : il analyse vos habitudes et répond à vos questions, sans Internet.",
    etapes: [
      "Posez vos questions en français courant ; les fautes de frappe sont tolérées.",
      "Le bouton « Mes données » montre ce que le conseiller sait, sa fiabilité et la fiabilité de chaque objectif.",
      "Le conseiller annonce lui-même ses limites : il ne devine pas ce qu'il n'a jamais vu.",
      "Plus vous enregistrez d'opérations, plus ses prévisions et ses conseils deviennent précis.",
    ],
    liens: [
      { to: "/notifications", libelle: "Ouvrir Mon conseiller" },
      { to: "/conseiller/donnees", libelle: "Mes données et fiabilité" },
    ],
    motsCles: "conseiller ia intelligence question fiabilite limites donnees",
  },
  {
    id: "saisie",
    icone: Camera,
    titre: "Saisie rapide, photos de tickets et clavier",
    resume: "Plusieurs façons d'aller vite au moment d'enregistrer une opération.",
    etapes: [
      "La boule rose flottante ouvre la saisie rapide depuis presque toutes les pages.",
      "La lecture d'un ticket ou d'un reçu par photo remplit le montant et le libellé ; vos corrections lui apprennent à mieux faire.",
      "Le clavier interne de l'application peut remplacer le clavier du téléphone ; le champ en cours de saisie reste toujours visible au-dessus du clavier.",
      "La recherche globale retrouve une opération, un compte, une enveloppe ou un objectif.",
    ],
    liens: [
      { to: "/saisie", libelle: "Saisie rapide" },
      { to: "/recherche", libelle: "Recherche globale" },
      { to: "/parametres/clavier", libelle: "Réglages du clavier" },
    ],
    motsCles: "saisie rapide ticket photo ocr clavier recherche",
  },
  {
    id: "securite",
    icone: Lock,
    titre: "Sécurité et confidentialité",
    resume:
      "Vos données financières restent dans la mémoire de l'application, chiffrées, sur votre téléphone.",
    etapes: [
      "Code PIN obligatoire, empreinte digitale possible, verrouillage automatique après inactivité.",
      "Un mot de passe d'action protège toute modification et toute suppression.",
      "Après plusieurs codes faux, l'effacement de sécurité peut se déclencher.",
      "Mode invité, blocage des captures d'écran et journal d'audit sont disponibles dans les réglages.",
    ],
    liens: [
      { to: "/parametres/securite", libelle: "Réglages de sécurité" },
      { to: "/parametres/donnees", libelle: "Mes données locales" },
    ],
    motsCles: "securite pin biometrie chiffrement mot de passe suppression confidentialite",
  },
  {
    id: "sauvegarde",
    icone: Mail,
    titre: "Sauvegarde et changement de téléphone",
    resume:
      "Une copie chiffrée peut être envoyée par e-mail pour retrouver vos données sur un nouvel appareil.",
    etapes: [
      "Activez la sauvegarde chiffrée et notez soigneusement votre phrase de récupération : sans elle, rien ne peut être relu.",
      "Les sauvegardes partent automatiquement ; hors connexion, elles attendent et repartent plus tard.",
      "Sur le nouveau téléphone, utilisez la récupération avec l'e-mail reçu ou le fichier de sauvegarde.",
      "Faites toujours une sauvegarde avant de changer d'appareil ou de réinstaller.",
    ],
    liens: [{ to: "/sauvegarde", libelle: "Sauvegarde et récupération" }],
    motsCles: "sauvegarde email chiffree phrase recuperation nouveau telephone restauration",
  },
  {
    id: "maj",
    icone: RefreshCw,
    titre: "Mises à jour de l'application",
    resume:
      "L'application vérifie s'il existe une version plus récente et vous propose l'installer.",
    etapes: [
      "Ouvrez « Mises à jour » pour voir la version installée et la version disponible.",
      "Si le téléchargement échoue, réessayez plus tard : la nouvelle version n'est peut-être pas encore publiée.",
      "Vos données ne sont jamais effacées par une mise à jour.",
    ],
    liens: [{ to: "/parametres/mises-a-jour", libelle: "Vérifier les mises à jour" }],
    motsCles: "mise a jour version apk telechargement",
  },
];

const AVANTAGES = [
  {
    icone: Wallet,
    titre: "Tout votre argent en un coup d'œil",
    texte:
      "Solde disponible, revenus et dépenses du mois s'affichent dès l'ouverture, sans rien chercher.",
  },
  {
    icone: PiggyBank,
    titre: "On ne dépasse plus sans le savoir",
    texte:
      "Les enveloppes montrent en temps réel ce qu'il reste pour chaque besoin, et alertent avant le dépassement.",
  },
  {
    icone: Shield,
    titre: "Vos données ne quittent pas votre téléphone",
    texte:
      "Aucun envoi en ligne pour l'usage normal. Tout est chiffré localement et protégé par votre code.",
  },
  {
    icone: Smartphone,
    titre: "Fonctionne sans connexion",
    texte: "Enregistrez et consultez à tout moment, même sans réseau ni forfait Internet.",
  },
  {
    icone: Users,
    titre: "Pensée pour le foyer",
    texte:
      "Seul, en couple ou en famille, chacun comprend où va l'argent grâce aux enveloppes et aux rapports.",
  },
  {
    icone: Bell,
    titre: "Elle vous rappelle au bon moment",
    texte:
      "Renouvellement des enveloppes, budget du mois, objectifs, échéances de dettes : rien ne s'oublie.",
  },
];

const FAQ = [
  {
    q: "Qu'est-ce que le solde disponible ?",
    r: "C'est l'argent utilisable librement au quotidien. Les comptes que vous avez exclus (épargne, comptes réservés, solde Diamant) n'y sont pas comptés.",
  },
  {
    q: "Pourquoi je ne choisis plus le compte quand je dépense ?",
    r: "Le compte est déduit de l'enveloppe choisie. Cela évite les erreurs et fait gagner du temps. Vous pouvez toujours vérifier le compte utilisé dans l'historique.",
  },
  {
    q: "Comment l'application devine-t-elle l'enveloppe ?",
    r: "Elle compare votre libellé au nom des enveloppes, à leurs catégories, à un vocabulaire local et à vos habitudes passées. Elle affiche sa confiance et vous pouvez toujours corriger.",
  },
  {
    q: "Pourquoi me demande-t-on un mot de passe pour modifier ou supprimer ?",
    r: "Toutes les modifications et suppressions sont protégées par un mot de passe que vous définissez, pour éviter les gestes involontaires ou une main étrangère.",
  },
  {
    q: "Les enveloppes se renouvellent quand ?",
    r: "Automatiquement le 1er de chaque mois. Pendant les deux premiers jours, des rappels vous laissent le temps d'ajuster avant que la proposition ne s'applique.",
  },
  {
    q: "Que deviennent mes données si je perds mon téléphone ?",
    r: "Sans sauvegarde chiffrée, elles sont perdues, car rien n'est stocké en ligne. Activez la sauvegarde par e-mail et conservez la phrase de récupération.",
  },
  {
    q: "Le conseiller envoie-t-il mes questions sur Internet ?",
    r: "Non. Il fonctionne entièrement dans le téléphone. C'est aussi pourquoi il a des limites, qu'il vous indique lui-même.",
  },
  {
    q: "Puis-je enregistrer les frais d'une opération ?",
    r: "Oui. Chaque revenu, dépense et transfert accepte des frais, et l'application distingue le montant brut, les frais, le coût réel et le montant reçu.",
  },
  {
    q: "Comment revenir en arrière dans l'application ?",
    r: "Le bouton Retour en haut et le bouton du téléphone suivent le même chemin : ils remontent d'un niveau jusqu'à l'accueil. Sur l'accueil, deux appuis rapides ferment l'application.",
  },
  {
    q: "L'application est-elle payante ?",
    r: "Non. Elle fonctionne sur votre appareil, sans abonnement et sans publicité qui lirait vos données.",
  },
];

const DEPANNAGE = [
  {
    q: "Le clavier cache le champ que je remplis",
    r: "Le champ actif est automatiquement remonté au-dessus du clavier. Si cela persiste sur une page, fermez puis rouvrez la page, et vérifiez le réglage du clavier dans les paramètres.",
  },
  {
    q: "Une enveloppe affiche un montant que je ne comprends pas",
    r: "Ouvrez son détail : chaque mouvement est daté et expliqué, y compris les renouvellements, les prélèvements d'objectifs et les secours.",
  },
  {
    q: "Le téléchargement de la mise à jour échoue",
    r: "Cela signifie que la nouvelle version n'est pas encore disponible au téléchargement. Réessayez plus tard ; votre version actuelle continue de fonctionner normalement.",
  },
  {
    q: "J'ai oublié mon code",
    r: "Par sécurité, aucun code ne peut être retrouvé. Après plusieurs erreurs, l'effacement de sécurité peut se déclencher ; seule une sauvegarde chiffrée permet de retrouver les données.",
  },
  {
    q: "Quelque chose semble bloqué",
    r: "Ouvrez le journal de diagnostic : il liste ce qui s'est passé récemment et aide à identifier le problème.",
  },
];

function Carte({
  icone: Icon,
  titre,
  texte,
}: {
  icone: typeof Wallet;
  titre: string;
  texte: string;
}) {
  return (
    <div className="carte flex gap-3 p-4">
      <div className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">{titre}</h3>
        <p className="text-sm text-muted-foreground">{texte}</p>
      </div>
    </div>
  );
}

function Aide() {
  const [recherche, setRecherche] = useState("");

  const guides = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return GUIDES;
    return GUIDES.filter((g) =>
      `${g.titre} ${g.resume} ${g.etapes.join(" ")} ${g.motsCles}`.toLowerCase().includes(q),
    );
  }, [recherche]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Aide et guides</h1>
        <p className="text-sm text-muted-foreground">
          Tout ce que fait SUPER APP, expliqué simplement : premiers pas, guides par sujet,
          questions fréquentes et dépannage.
        </p>
      </header>

      <section className="carte space-y-3 p-4">
        <h2 className="text-lg font-semibold tracking-tight">En cinq minutes</h2>
        <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
          {DEMARRAGE.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to="/comptes" className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            Créer un compte
          </Link>
          <Link
            to="/enveloppes"
            className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
          >
            Créer une enveloppe
          </Link>
          <Link to="/revenu" className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            Ajouter un revenu
          </Link>
          <Link to="/depense" className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            Ajouter une dépense
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Chercher dans l'aide</span>
          <span className="carte flex items-center gap-2 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Exemple : enveloppe, tontine, sauvegarde…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </span>
        </label>

        <h2 className="text-lg font-semibold tracking-tight">Les guides</h2>
        {guides.length === 0 ? (
          <p className="carte p-4 text-sm text-muted-foreground">
            Aucun guide ne correspond à « {recherche} ». Essayez un autre mot, par exemple « dépense
            », « objectif » ou « sécurité ».
          </p>
        ) : (
          <div className="space-y-3">
            {guides.map((g) => {
              const Icon = g.icone;
              return (
                <details key={g.id} className="carte p-4">
                  <summary className="flex cursor-pointer items-start gap-3">
                    <span className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="space-y-1">
                      <span className="block font-semibold">{g.titre}</span>
                      <span className="block text-sm text-muted-foreground">{g.resume}</span>
                    </span>
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {g.etapes.map((e) => (
                      <li key={e} className="flex gap-2">
                        <span aria-hidden>•</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                  {g.liens && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {g.liens.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                        >
                          {l.libelle}
                        </Link>
                      ))}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Ce que l'application vous apporte</h2>
        <div className="grid gap-3">
          {AVANTAGES.map((a) => (
            <Carte key={a.titre} icone={a.icone} titre={a.titre} texte={a.texte} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Se déplacer dans l'application</h2>
        <div className="carte space-y-2 p-4 text-sm text-muted-foreground">
          <p className="flex gap-2">
            <ArrowLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              Le bouton Retour en haut et celui du téléphone remontent d'un seul niveau, toujours
              vers la même entrée, jusqu'à l'accueil.
            </span>
          </p>
          <p className="flex gap-2">
            <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              Pendant une saisie, le champ rempli reste visible au-dessus du clavier, qu'il soit
              interne ou celui du téléphone.
            </span>
          </p>
          <p className="flex gap-2">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              Le menu latéral (les trois points) n'existe que sur l'accueil ; les autres pages
              gardent une barre épurée.
            </span>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Questions fréquentes</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="carte p-4">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                <HelpCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Quand quelque chose ne va pas</h2>
        <div className="space-y-3">
          {DEPANNAGE.map((item) => (
            <details key={item.q} className="carte p-4">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                <LifeBuoy className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {item.q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{item.r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Ce que l'application ne fait pas</h2>
        <p className="text-sm text-muted-foreground">
          Elle ne se connecte à aucune banque, ne lit aucun message, et ne décide rien à votre
          place. Elle travaille uniquement avec ce que vous enregistrez : plus vous êtes régulier,
          plus ses analyses sont justes.
        </p>
        <p className="text-sm text-muted-foreground">
          Si vous débutez : un compte, une enveloppe, une dépense. En quelques minutes, vous verrez
          déjà l'intérêt de tout garder au même endroit.
        </p>
      </section>
    </div>
  );
}
