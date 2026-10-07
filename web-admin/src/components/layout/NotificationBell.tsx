// web-admin/src/components/layout/NotificationBell.tsx
//
// Cloche des notifications du compte connecté, en haut à droite du back-office : pastille du nombre de non lues, panneau
// avec la liste, lecture (au clic, ou par la coche), suppression (une ou toutes) et « tout marquer comme lu ».
// Les notifications informent seulement : un clic la marque comme lue, il ne change jamais de page.
// Le compteur se rafraîchit toutes les 30 s ; la liste, seulement quand le panneau est ouvert.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconBell,
  IconBellOff,
  IconCash,
  IconChecks,
  IconCircleCheck,
  IconTrash,
  IconUserCheck,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useRemoveAllNotifications,
  useRemoveNotification,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications';
import type { InboxNotification } from '@/types/notifications.types';

const PAGE_SIZE = 15;

type VisualTone = 'danger' | 'accent' | 'primary' | 'success';

const TONE_CLASSES: Record<VisualTone, { tile: string; bar: string }> = {
  danger: { tile: 'bg-danger-light text-danger-dark', bar: 'bg-danger' },
  accent: { tile: 'bg-accent-light text-accent-dark', bar: 'bg-accent' },
  primary: { tile: 'bg-primary-light text-primary', bar: 'bg-primary' },
  success: { tile: 'bg-success-light text-success-dark', bar: 'bg-success' },
};

function visualFor(type: InboxNotification['type']): { icon: React.ReactNode; tone: VisualTone } {
  switch (type) {
    case 'DISPUTE':
    case 'SUPPORT_MESSAGE':
      return { icon: <IconAlertTriangle size={18} />, tone: 'danger' };
    case 'DRIVER_PAYMENT':
      return { icon: <IconWallet size={18} />, tone: 'accent' };
    case 'PAYMENT':
    case 'REFUND':
      return { icon: <IconCash size={18} />, tone: 'success' };
    case 'STATUS_CHANGE':
      return { icon: <IconUserCheck size={18} />, tone: 'primary' };
    default:
      return { icon: <IconBell size={18} />, tone: 'primary' };
  }
}

const RELATIVE_FORMAT = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

function formatRelativeTime(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "À l'instant";
  if (abs < 3600) return RELATIVE_FORMAT.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return RELATIVE_FORMAT.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return RELATIVE_FORMAT.format(Math.round(seconds / 86_400), 'day');
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Une notification
// ---------------------------------------------------------------------------

function NotificationCard({
  notification,
  onRead,
  onMarkRead,
  onRemove,
}: {
  notification: InboxNotification;
  onRead: () => void;
  onMarkRead: () => void;
  onRemove: () => void;
}) {
  const isUnread = notification.readAt === null;
  const { icon, tone } = visualFor(notification.type);
  const classes = TONE_CLASSES[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ring-1 shadow-[0_6px_18px_-10px_rgba(8,58,99,0.35)] ${
        isUnread ? 'bg-surface ring-primary/25' : 'bg-surface-muted/60 ring-border/60'
      }`}
    >
      {isUnread ? <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${classes.bar}`} /> : null}
      <div className="flex items-start gap-3 p-3 pl-4">
        <button
          type="button"
          onClick={isUnread ? onRead : undefined}
          className={`flex min-w-0 flex-1 items-start gap-3 text-left ${isUnread ? '' : 'cursor-default'}`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${classes.tile}`}>{icon}</span>
          <span className="min-w-0 flex-1">
            <span className={`block text-sm leading-snug text-text-primary ${isUnread ? 'font-bold' : 'font-medium'}`}>
              {notification.title ?? 'Notification'}
            </span>
            {notification.body ? (
              <span className="mt-0.5 line-clamp-3 block text-xs text-text-secondary">{notification.body}</span>
            ) : null}
            <span className="mt-1 block text-[11px] font-medium text-text-muted">{formatRelativeTime(notification.createdAt)}</span>
          </span>
        </button>
        <div className="flex shrink-0 flex-col gap-1">
          {isUnread ? (
            <button
              type="button"
              onClick={onMarkRead}
              aria-label="Marquer comme lue"
              title="Marquer comme lue"
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-success-light hover:text-success-dark"
            >
              <IconCircleCheck size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer la notification"
            title="Supprimer"
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger-light/50 hover:text-danger"
          >
            <IconTrash size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cloche + panneau
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const { data: unread } = useUnreadNotificationCount();
  const { data: list, isLoading, isError } = useNotificationList(limit, open);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useRemoveNotification();
  const removeAll = useRemoveAllNotifications();

  const unreadCount = unread?.count ?? 0;
  const notifications = list?.data ?? [];
  const total = list?.meta.total ?? 0;

  // Fermeture : clic à l'extérieur ou Échap.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setConfirmingClear(false);
      setLimit(PAGE_SIZE);
    }
  }, [open]);

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount > 0 ? `Notifications : ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
          open ? 'bg-primary text-on-primary' : 'bg-primary-light text-primary-dark hover:bg-primary-light/70'
        }`}
      >
        <IconBell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-bold leading-none text-[#ffffff]">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(80vh,34rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_24px_60px_-18px_rgba(8,58,99,0.45)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text-primary">Notifications</h2>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-danger-light px-2 py-0.5 text-xs font-bold text-danger-dark">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={unreadCount === 0 || markAllRead.isPending}
                aria-label="Tout marquer comme lu"
                title="Tout marquer comme lu"
                className="rounded-lg p-2 text-text-secondary transition hover:bg-primary-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconChecks size={18} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                disabled={notifications.length === 0}
                aria-label="Tout supprimer"
                title="Tout supprimer"
                className="rounded-lg p-2 text-text-secondary transition hover:bg-danger-light/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconTrash size={18} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-muted"
              >
                <IconX size={18} />
              </button>
            </div>
          </div>

          {confirmingClear ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-danger-light/40 px-4 py-2.5">
              <span className="text-sm font-medium text-danger-dark">Supprimer toutes les notifications ?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-text-secondary hover:bg-surface"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={removeAll.isPending}
                  onClick={() => removeAll.mutate(undefined, { onSuccess: () => setConfirmingClear(false) })}
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-[#ffffff] hover:brightness-95 disabled:opacity-60"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
            {isError ? (
              <p className="rounded-2xl bg-danger-light/40 px-4 py-3 text-sm text-danger-dark">
                Impossible de charger les notifications. Réessayez dans un instant.
              </p>
            ) : isLoading && !list ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-2xl bg-border/50" />)
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <IconBellOff size={26} />
                </span>
                <p className="mt-3 font-semibold text-text-primary">Aucune notification</p>
                <p className="mt-1 max-w-64 text-sm text-text-secondary">
                  Les litiges, retraits à valider et documents à contrôler apparaîtront ici.
                </p>
              </div>
            ) : (
              <>
                {notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onRead={() => markRead.mutate(notification.id)}
                    onMarkRead={() => markRead.mutate(notification.id)}
                    onRemove={() => remove.mutate(notification.id)}
                  />
                ))}
                {total > notifications.length ? (
                  <button
                    type="button"
                    onClick={() => setLimit((value) => value + PAGE_SIZE)}
                    className="w-full rounded-xl py-2 text-sm font-semibold text-primary transition hover:bg-primary-light/60"
                  >
                    Voir plus ({total - notifications.length})
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}