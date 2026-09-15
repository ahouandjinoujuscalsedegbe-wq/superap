import { Component, type ErrorInfo, type ReactNode } from "react";
import { journaliser } from "@/lib/journal";

type Props = { nom: string; children: ReactNode };
type State = { enErreur: boolean };

/** Isole un service d'arrière-plan : sa panne ne doit jamais vider tout l'écran. */
export class LimiteErreur extends Component<Props, State> {
  state: State = { enErreur: false };

  static getDerivedStateFromError(): State {
    return { enErreur: true };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    journaliser("erreur", "application", `Service isolé indisponible : ${this.props.nom}.`, {
      erreur: erreur.message.slice(0, 200),
      composant: info.componentStack?.slice(0, 500) ?? "inconnu",
    });
  }

  render() {
    return this.state.enErreur ? null : this.props.children;
  }
}