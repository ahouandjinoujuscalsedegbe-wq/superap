import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Aide — Guide d'utilisation de SUPER APP" },
      {
        name: "description",
        content:
          "Guide pratique : enveloppes, saisie des revenus et dépenses, comptes, simulation, conseiller intelligent et confidentialité des données locales.",
      },
      { property: "og:title", content: "Aide — SUPER APP" },
      {
        property: "og:description",
        content: "Questions fréquentes et guide d'utilisation du budget du foyer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Aide,
});

const AVANTAGES = [
  {
    icone: Wallet,
    titre: "Tout votre argent en un coup d'œil",
    texte:
      "Voyez immédiatement votre solde disponible, vos revenus et vos dépenses du mois. Plus besoin de chercher dans plusieurs applications ou messages.",
  },
  {
    icone: PiggyBank,
    titre: "Des enveloppes pour ne plus dépasser son budget",
    texte:
      "Chaque enveloppe est comme une petite tirelire virtuelle. Vous savez exactement combien il vous reste pour chaque besoin du foyer.",
  },
  {
    icone: TrendingUp,
    titre: "Un suivi intelligent de vos habitudes",
    texte:
      "L'application apprend de vos comportements pour vous avertir quand une dépense est inhabituelle et pour vous proposer un budget adapté.",
  },
  {
    icone: Shield,
    titre: "Vos données restent sur votre téléphone",
    texte:
      "Vos informations financières ne quittent pas votre appareil. Elles sont chiffrées et protégées par un code PIN ou votre empreinte digitale.",
  },
  {
    icone: Smartphone,
    titre: "Fonctionne même sans connexion Internet",
    texte:
      "Saisissez vos revenus et dépenses à tout moment. Vous n'avez pas besoin de connexion pour gérer votre argent au quotidien.",
  },
  {
    icone: Users,
    titre: "Conçue pour le foyer et la famille",
    texte:
      "Que vous viviez seul, en couple ou en famille, l'application vous aide à organiser l'argent du foyer de manière claire et transparente.",
  },
];

const FACILITES = [
  {
    icone: Lightbulb,
    titre: "Saisie intelligente",
    texte:
      "La boule flottante rose vous permet d'ajouter une dépense ou un revenu rapidement. Elle reste accessible depuis presque toutes les pages.",
  },
  {
    icone: Calendar,
    titre: "Renouvellement automatique des enveloppes",
    texte:
      "Le 1er de chaque mois, vos enveloppes se rechargent automatiquement. Vous n'avez plus à tout recalculer à la main.",
  },
  {
    icone: TrendingUp,
    titre: "Budget automatique proposé",
    texte:
      "L'application analyse vos six derniers mois et vous propose un budget mensuel. Vous pouvez le modifier avant de l'appliquer.",
  },
  {
    icone: Search,
    titre: "Recherche de toutes vos opérations",
    texte:
      "Retrouvez facilement un revenu, une dépense, un compte ou une enveloppe grâce à la recherche globale.",
  },
  {
    icone: Bell,
    titre: "Rappels et alertes",
    texte:
      "Recevez des rappels pour modifier votre budget au début du mois et des alertes quand une enveloppe est presque vide.",
  },
  {
    icone: Lock,
    titre: "Sécurité renforcée",
    texte:
      "Code PIN, biométrie et chiffrement triple protègent vos données. Même quelqu'un qui prendrait votre téléphone ne pourrait pas lire vos informations.",
  },
];

const FAQ = [
  {
    q: "Comment fonctionne une enveloppe ?",
    r: "Chaque enveloppe reçoit un plafond mensuel. Quand vous dépensez, vous choisissez l'enveloppe concernée et le montant disponible diminue. Le 1er du mois suivant, l'enveloppe se recharge automatiquement.",
  },
  {
    q: "Comment enregistrer un revenu ?",
    r: "Appuyez sur le bouton « Ajouter un revenu » en haut de l'accueil. Saisissez le montant, la source (salaire, activité, remboursement...), le compte de réception et validez.",
  },
  {
    q: "Comment enregistrer une dépense ?",
    r: "Appuyez sur « Ajouter une dépense ». Saisissez le montant, choisissez l'enveloppe concernée (le compte source se remplit automatiquement), ajoutez un libellé et validez.",
  },
  {
    q: "À quoi sert l'onglet Comptes ?",
    r: "Il liste tous vos supports d'argent : espèces, compte bancaire, MoMo, Moov Money, Wave, carte virtuelle, etc. Vous pouvez choisir si un compte fait partie du solde disponible ou s'il est réservé.",
  },
  {
    q: "Qu'est-ce que le solde disponible ?",
    r: "C'est l'argent que vous pouvez utiliser librement au jour le jour. Les comptes épargne, les comptes exclus et les enveloppes d'objectifs d'épargne ne sont pas comptés dedans.",
  },
  {
    q: "Comment fonctionne la Simulation ?",
    r: "Avant un gros achat, entrez le montant dans « Si je dépense… ». L'application vous montre immédiatement l'effet sur votre solde, vos enveloppes et les mois à venir.",
  },
  {
    q: "Qu'est-ce que le conseiller intelligent ?",
    r: "C'est un assistant local qui analyse vos habitudes et répond à vos questions. Il reste dans votre téléphone : aucune donnée financière n'est envoyée sur Internet.",
  },
  {
    q: "Comment protéger mes données ?",
    r: "Dans Paramètres, activez le code PIN et la biométrie. Vos données sont chiffrées avec trois couches de sécurité. Vous pouvez aussi effacer toutes les données depuis les Paramètres.",
  },
  {
    q: "Puis-je exporter mes données ?",
    r: "Oui, depuis la section Sauvegarde et chiffrement. Vous pouvez créer une copie chiffrée de vos données pour les conserver en sécurité.",
  },
  {
    q: "Que se passe-t-il si je change de téléphone ?",
    r: "Vous pouvez transférer votre sauvegarde chiffrée sur le nouvel appareil. Comme les données restent locale, pensez à faire une sauvegarde avant de changer de téléphone.",
  },
  {
    q: "L'application est-elle gratuite ?",
    r: "Oui, elle fonctionne entièrement sur votre appareil sans abonnement. Aucune publicité ne lit vos données financières.",
  },
  {
    q: "Comment signaler un problème ?",
    r: "Utilisez le Journal de diagnostic dans le menu latéral. Il vous aide à comprendre ce qui se passe et à partager des informations utiles si vous avez besoin d'aide.",
  },
];

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{titre}</h2>
      {children}
    </section>
  );
}

function Carte({ icone: Icon, titre, texte }: { icone: typeof Wallet; titre: string; texte: string }) {
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
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Aide</h1>
        <p className="text-sm text-muted-foreground">
          Tout comprendre en quelques minutes pour utiliser SUPER APP avec confiance.
        </p>
      </header>

      <section className="carte space-y-3 p-4">
        <h2 className="text-lg font-semibold tracking-tight">Bienvenue dans SUPER APP</h2>
        <p className="text-sm text-muted-foreground">
          SUPER APP est votre compagnon de gestion budgétaire familiale. Elle vous aide à
          connaître l'état de votre argent, à planifier vos dépenses et à atteindre vos objectifs
          sans stress. Tout reste sur votre téléphone : vos données ne sont ni vendues, ni
          envoyées en ligne.
        </p>
        <p className="text-sm text-muted-foreground">
          Cette page répond aux questions essentielles : comment l'utiliser, pourquoi elle est
          utile, quels avantages elle offre et comment vos informations sont protégées.
        </p>
      </section>

      <Section titre="Comment utiliser l'application ?">
        <ol className="carte list-inside list-decimal space-y-2 p-4 text-sm text-muted-foreground">
          <li>
            <strong>Créez vos comptes</strong> : allez dans « Les comptes » depuis l'accueil et
            ajoutez vos supports d'argent (espèces, banque, mobile money, etc.).
          </li>
          <li>
            <strong>Créez vos enveloppes</strong> : dans « Les enveloppes », définissez vos
            catégories de dépenses (nourriture, transport, scolarité, loisirs, etc.).
          </li>
          <li>
            <strong>Enregistrez vos revenus</strong> : utilisez le bouton « Ajouter un revenu » en
            haut de l'accueil.
          </li>
          <li>
            <strong>Enregistrez vos dépenses</strong> : utilisez « Ajouter une dépense » et
            choisissez l'enveloppe concernée.
          </li>
          <li>
            <strong>Suivez votre budget</strong> : ouvrez « Budgétisation » pour comparer ce que
            vous avez prévu et ce que vous avez réellement dépensé.
          </li>
          <li>
            <strong>Demandez conseil</strong> : dans « Mon conseiller », posez vos questions et
            recevez des réponses personnalisées basées sur vos propres données.
          </li>
          <li>
            <strong>Simulez avant d'acheter</strong> : utilisez le bouton « Simulation » pour
            voir l'impact d'une grosse dépense avant de vous engager.
          </li>
        </ol>
      </Section>

      <Section titre="Pourquoi cette application est-elle importante ?">
        <p className="text-sm text-muted-foreground">
          Gérer l'argent du foyer peut devenir compliqué quand plusieurs comptes, plusieurs
          dépenses et plusieurs objectifs se mélangent. SUPER APP centralise tout en un seul endroit
          et vous donne une vision claire.
        </p>
        <p className="text-sm text-muted-foreground">
          Elle vous aide à éviter les fins de mois difficiles, à anticiper les grosses dépenses et à
          mettre de côté sereinement pour vos projets. Elle devient de plus en plus pertinente au
          fur et à mesure que vous l'utilisez, car elle apprend de vos habitudes.
        </p>
      </Section>

      <Section titre="Quelle est la nécessité de SUPER APP ?">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="carte p-4">
            <h3 className="font-semibold">Sans budget, on dépense à l'aveugle</h3>
            <p className="text-sm text-muted-foreground">
              L'application donne une limite claire à chaque catégorie de dépense.
            </p>
          </div>
          <div className="carte p-4">
            <h3 className="font-semibold">Les objectifs ont besoin de discipline</h3>
            <p className="text-sm text-muted-foreground">
              Les prélèvements automatiques vers vos objectifs d'épargne vous aident à avancer
              sans y penser.
            </p>
          </div>
          <div className="carte p-4">
            <h3 className="font-semibold">La famille doit pouvoir suivre</h3>
            <p className="text-sm text-muted-foreground">
              Tout le monde peut comprendre où va l'argent du foyer grâce aux enveloppes et aux
              rapports simples.
            </p>
          </div>
          <div className="carte p-4">
            <h3 className="font-semibold">La confidentialité est essentielle</h3>
            <p className="text-sm text-muted-foreground">
              Vos données financières sont trop sensibles pour être stockées n'importe où. Ici, elles
              restent chez vous.
            </p>
          </div>
        </div>
      </Section>

      <Section titre="Les avantages de SUPER APP">
        <div className="grid gap-3">
          {AVANTAGES.map((a) => (
            <Carte key={a.titre} icone={a.icone} titre={a.titre} texte={a.texte} />
          ))}
        </div>
      </Section>

      <Section titre="Les facilités que procure l'application">
        <div className="grid gap-3">
          {FACILITES.map((f) => (
            <Carte key={f.titre} icone={f.icone} titre={f.titre} texte={f.texte} />
          ))}
        </div>
      </Section>

      <Section titre="Questions fréquentes">
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
      </Section>

      <section className="carte space-y-2 p-4">
        <h2 className="font-semibold">Confiance et tranquillité d'esprit</h2>
        <p className="text-sm text-muted-foreground">
          SUPER APP est conçue pour être simple, sûre et utile au quotidien. Vous gardez le
          contrôle total de vos données. L'application ne prend aucune décision à votre place : elle
          vous propose, vous choisissez.
        </p>
        <p className="text-sm text-muted-foreground">
          Si vous êtes perdu, commencez par ajouter un compte, une enveloppe et une dépense. En
          quelques minutes, vous verrez déjà l'intérêt d'avoir tout organisé au même endroit.
        </p>
      </section>
    </div>
  );
}
