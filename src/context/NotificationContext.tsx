import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { showBrowserNotification } from '@/lib/browserNotifications';
import { backend } from '@/services';
import type { AppNotification, NotificationType } from '@/types';
import { useAuth } from './AuthContext';

interface NotificationState {
  items: AppNotification[];
  unread: number;
  notify: (n: { type: NotificationType; title: string; body: string; link?: string; tag?: string }) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const Ctx = createContext<NotificationState | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const browserEnabled = !!profile?.notificationPreferences.browser;

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let active = true;
    backend.listNotifications().then((n) => active && setItems(n));
    const off = backend.subscribeNotifications((n) => {
      setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      if (browserEnabled && document.visibilityState !== 'visible') showBrowserNotification(n.title, n.body, n.id);
    });
    return () => {
      active = false;
      off();
    };
  }, [user, browserEnabled]);

  const notify = useCallback<NotificationState['notify']>(async ({ tag, ...n }) => {
    let id: string | undefined;
    try {
      const created = await backend.createNotification(n);
      id = created.id;
      setItems((prev) => (prev.some((x) => x.id === created.id) ? prev : [created, ...prev]));
    } catch {
      /* in-app inbox write failed; the browser notification below is still attempted */
    }
    // Same tag as the realtime path, so the browser shows it once.
    if (browserEnabled) showBrowserNotification(n.title, n.body, id ?? tag);
  }, [browserEnabled]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
    await backend.markNotificationRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    await backend.markAllNotificationsRead();
  }, []);

  const value = useMemo(
    () => ({ items, unread: items.filter((i) => !i.read).length, notify, markRead, markAllRead }),
    [items, notify, markRead, markAllRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNotifications must be used inside NotificationProvider');
  return c;
}
