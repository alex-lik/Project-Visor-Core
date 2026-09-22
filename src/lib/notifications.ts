/**
 * Visor Core Notification Provider Interface
 *
 * Core provides an event dispatch mechanism. In Core, dispatch is a no-op by default.
 * Commercial modules register implementations (e.g. Telegram, Email SMTP)
 * via registerNotificationProvider().
 */

export interface VisorNotificationEvent {
  event: string;
  title: string;
  message: string;
  projectId?: string;
  projectTitle?: string;
  userId?: string;
  data?: Record<string, unknown>;
  url?: string;
}

export interface NotificationProvider {
  dispatch(event: VisorNotificationEvent): Promise<void>;
}

let activeProvider: NotificationProvider | null = null;

export function registerNotificationProvider(provider: NotificationProvider | null) {
  activeProvider = provider;
}

export function getNotificationProvider(): NotificationProvider | null {
  return activeProvider;
}

export async function dispatchNotification(event: VisorNotificationEvent): Promise<void> {
  if (activeProvider) {
    try {
      await activeProvider.dispatch(event);
    } catch (err) {
      console.error('[Visor Core] Notification provider execution failed:', err);
    }
  }
}
