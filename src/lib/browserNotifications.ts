export type BrowserPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function browserNotificationPermission(): BrowserPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotifications(): Promise<BrowserPermission> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Shows a system notification only if the user has granted permission. Returns whether it was shown. */
export function showBrowserNotification(title: string, body: string, tag?: string): boolean {
  if (browserNotificationPermission() !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag, icon: '/favicon.svg' });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
