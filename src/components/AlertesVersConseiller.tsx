import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { publierAlerteConseiller } from "@/lib/alertes-conseiller";

function estNatif(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

/**
 * Quand l'utilisateur touche une notification du téléphone (même reçue en
 * arrière-plan), l'application s'ouvre directement sur la discussion avec
 * « Mon conseiller », où l'alerte est reprise mot pour mot.
 */
export function AlertesVersConseiller() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!estNatif()) return;
    let vivant = true;
    let retirer: (() => void) | null = null;

    void (async () => {
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const abonnement = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          (evenement) => {
            const notif = evenement.notification;
            void publierAlerteConseiller({
              titre: notif.title ?? "Notification",
              texte: notif.body ?? "",
              urgent: Boolean((notif.extra as { urgent?: boolean } | undefined | null)?.urgent),
            });
            void navigate({ to: "/notifications" });
          },
        );
        if (!vivant) {
          void abonnement.remove();
          return;
        }
        retirer = () => void abonnement.remove();
      } catch {
        /* notifications indisponibles */
      }
    })();

    return () => {
      vivant = false;
      retirer?.();
    };
  }, [navigate]);

  return null;
}
