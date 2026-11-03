import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/context/NotificationContext';
import { cx, timeAgo } from '@/lib/format';
import type { NotificationType } from '@/types';
import { IconBell, IconCheck, IconClock, IconFlag, IconInfo, IconShare, IconUsers } from './icons';
import { IconButton } from './ui';

const ICONS: Record<NotificationType, typeof IconBell> = {
  journey: IconClock, checkin: IconClock, share: IconShare, invite: IconUsers, hazard: IconFlag, system: IconInfo,
};

export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        <IconBell />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </IconButton>
      {open && (
        <div className={cx('fixed inset-x-3 top-16 z-50 animate-slide-in rounded-2xl border border-navy/[0.06] bg-white shadow-lift sm:absolute sm:inset-x-auto sm:top-12 sm:w-96', align === 'right' ? 'sm:right-0' : 'sm:left-0')} role="region" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-mist px-4 py-3">
            <p className="font-semibold text-navy">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-teal-700 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                <IconCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-1.5">
            {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</li>}
            {items.map((n) => {
              const Icon = ICONS[n.type];
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      if (n.link) navigate(n.link);
                    }}
                    className={cx('flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', !n.read && 'bg-sky-50')}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-navy ring-1 ring-navy/[0.06]"><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-navy">{n.title}</span>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
