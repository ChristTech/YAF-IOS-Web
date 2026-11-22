import type { FellowshipAccount, FellowshipNotification, MainTab } from '../types/fellowship';
import {
  MAX_TRACKED_NOTIF_IDS,
  appendCappedIds,
  evaluatePushReadiness,
  getNotificationTargetTab,
  syncRemoteNotificationIfNew,
  type PushReadinessState,
} from './notificationLogic';

const LS_LOCAL_NOTIFS_KEY = 'gideonites_local_notifications_v1';
const LS_READ_NOTIFS_PREFIX = 'gideonites_read_notifs_';
const LS_DEVICE_INSTANCE_KEY = 'gideonites_device_instance_id_v1';
const LS_LOCAL_ORIGIN_IDS_KEY = 'gideonites_locally_originating_notif_ids_v1';
const LS_DELIVERED_IDS_PREFIX = 'gideonites_delivered_notif_ids_';
export const LOCAL_NOTIF_EVENT = 'gideonites-notifications-updated';

export interface NotificationDiagnostics {
  state: PushReadinessState;
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  isIOS: boolean;
  isStandalone: boolean;
  hasActiveSubscription: boolean;
  endpoint: string | null;
}

function detectIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectIsStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const navStandalone = Boolean(
    (navigator as unknown as { standalone?: boolean }).standalone
  );
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return navStandalone || displayStandalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function getNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  const isIOS = detectIsIOS();
  const isStandalone = detectIsStandalone();
  const hasNotificationApi =
    typeof window !== 'undefined' && 'Notification' in window;
  const hasServiceWorker =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPushManager =
    typeof window !== 'undefined' && 'PushManager' in window;

  const permission: 'granted' | 'denied' | 'default' | 'unsupported' =
    hasNotificationApi ? Notification.permission : 'unsupported';

  let endpoint: string | null = null;
  let hasActiveSubscription = false;

  if (hasServiceWorker && hasPushManager) {
    try {
      const reg = await getSwRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        hasActiveSubscription = true;
        endpoint = sub.endpoint;
      }
    } catch {
      hasActiveSubscription = false;
    }
  }

  const state = evaluatePushReadiness({
    hasNotificationApi,
    hasServiceWorker,
    hasPushManager,
    permission,
    isIOS,
    isStandalone,
    hasActiveSubscription,
  });

  return {
    state,
    permission,
    isIOS,
    isStandalone,
    hasActiveSubscription,
    endpoint,
  };
}

export async function enableBackgroundPushNotifications(params: {
  userId?: string;
  role?: string;
}): Promise<{
  ok: boolean;
  diagnostics: NotificationDiagnostics;
  error?: string;
}> {
  const preDiag = await getNotificationDiagnostics();
  if (preDiag.state === 'ios-install-required') {
    return {
      ok: false,
      diagnostics: preDiag,
      error:
        'Install The Gideonites to your iPhone/iPad Home Screen first (Share → Add to Home Screen), then open it from the Home Screen to enable background alerts.',
    };
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      ok: false,
      diagnostics: preDiag,
      error: 'Web notifications are not supported in this browser.',
    };
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      const diag = await getNotificationDiagnostics();
      return {
        ok: false,
        diagnostics: diag,
        error:
          permission === 'denied'
            ? 'Notification permission is blocked in browser/device settings.'
            : 'Notification permission was not granted.',
      };
    }

    const reg = await getSwRegistration();
    if (!reg || !reg.pushManager) {
      const diag = await getNotificationDiagnostics();
      return {
        ok: false,
        diagnostics: diag,
        error: 'Service Worker Push Manager is unavailable on this browser.',
      };
    }

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      const keyRes = await fetch('/api/push/vapid-public-key');
      const keyCt = keyRes.headers.get('content-type') || '';
      if (!keyRes.ok || !keyCt.includes('application/json')) {
        await registerPeriodicOrBackgroundSync();
        const diagnostics = await getNotificationDiagnostics();
        return {
          ok: true,
          diagnostics,
        };
      }
      const { publicKey } = (await keyRes.json()) as { publicKey?: string };
      if (!publicKey) {
        throw new Error('Push server VAPID key is missing.');
      }

      const appServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });
    }

    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId: params.userId,
        role: params.role,
        platform: preDiag.isIOS ? 'ios-pwa' : 'web-pwa',
      }),
    });

    const subCt = subRes.headers.get('content-type') || '';
    if (!subRes.ok || !subCt.includes('application/json')) {
      const diagnostics = await getNotificationDiagnostics();
      return { ok: true, diagnostics };
    }

    // Optional Background Sync & Periodic Background Sync for supported installed PWAs
    try {
      const regAny = reg as unknown as {
        sync?: {
          register: (tag: string) => Promise<void>;
        };
        periodicSync?: {
          register: (tag: string, options: { minInterval: number }) => Promise<void>;
        };
      };
      if ('sync' in reg && regAny.sync?.register) {
        await regAny.sync.register('gideonites-bg-sync').catch(() => {});
      }
      if ('periodicSync' in reg && regAny.periodicSync?.register) {
        await regAny.periodicSync
          .register('gideonites-check-notifications', {
            minInterval: 12 * 60 * 60 * 1000,
          })
          .catch(() => {});
      }
    } catch {
      // Background Sync / Periodic Sync is optional
    }

    const diagnostics = await getNotificationDiagnostics();
    return { ok: true, diagnostics };
  } catch (err) {
    const diagnostics = await getNotificationDiagnostics();
    return {
      ok: false,
      diagnostics,
      error:
        err instanceof Error
          ? err.message
          : 'Unable to activate background push notifications.',
    };
  }
}

export async function syncExistingPushSubscription(params: {
  userId?: string;
  role?: string;
}): Promise<void> {
  try {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }
    const reg = await getSwRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userId: params.userId,
        role: params.role,
        platform: detectIsIOS() ? 'ios-pwa' : 'web-pwa',
      }),
    });
  } catch {
    // Non-fatal silent sync
  }
}

export async function disableBackgroundPushNotifications(): Promise<NotificationDiagnostics> {
  try {
    const reg = await getSwRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // ignore unsubscribe errors
  }
  return getNotificationDiagnostics();
}

export async function sendTestPushNotification(params: {
  userId?: string;
}): Promise<{ ok: boolean; sent: number; message: string }> {
  const diag = await getNotificationDiagnostics();
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: diag.endpoint || undefined,
        userId: params.userId,
      }),
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = (await res.json()) as { sent?: number; failed?: number };
      if ((data.sent ?? 0) > 0) {
        return {
          ok: true,
          sent: data.sent ?? 1,
          message: 'Background Web Push test sent to this device.',
        };
      }
    }
    // Fallback: display directly via Service Worker registration when permission is granted
    const reg = await getSwRegistration();
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      reg
    ) {
      await reg.showNotification('The Gideonites — Test Alert', {
        body: 'Background alerts are active on this device.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `test-${Date.now()}`,
        data: { url: '/?tab=home', targetTab: 'home' },
      });
      return {
        ok: true,
        sent: 1,
        message: 'Device notification triggered via active Service Worker.',
      };
    }
    return {
      ok: false,
      sent: 0,
      message: 'Enable background alerts first to receive OS notifications.',
    };
  } catch {
    return {
      ok: false,
      sent: 0,
      message: 'Unable to reach push dispatch service right now.',
    };
  }
}

export async function showBackgroundLocalNotification(
  notif: FellowshipNotification
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const targetTab: MainTab = getNotificationTargetTab(notif.type);
  try {
    const reg = await getSwRegistration();
    if (reg) {
      await reg.showNotification(notif.title, {
        body: notif.message,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: notif.id,
        data: {
          url: `/?tab=${encodeURIComponent(targetTab)}`,
          targetTab,
          notificationId: notif.id,
        },
      });
    }
  } catch {
    // ignore OS notification error
  }
}

export function readLocalNotifications(): FellowshipNotification[] {
  try {
    const raw = localStorage.getItem(LS_LOCAL_NOTIFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FellowshipNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotification(notif: FellowshipNotification): void {
  try {
    const existing = readLocalNotifications();
    const next = [notif, ...existing.filter((n) => n.id !== notif.id)].slice(
      0,
      100
    );
    localStorage.setItem(LS_LOCAL_NOTIFS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(LOCAL_NOTIF_EVENT));
  } catch {
    // ignore storage quota errors
  }
}

export function readLocalReadNotifIds(userIds: string[]): string[] {
  const merged = new Set<string>();
  for (const uid of userIds) {
    if (!uid) continue;
    try {
      const raw = localStorage.getItem(`${LS_READ_NOTIFS_PREFIX}${uid}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string') merged.add(id);
        }
      }
    } catch {
      // ignore
    }
  }
  return Array.from(merged);
}

export function markLocalNotifsRead(userIds: string[], notifIds: string[]): void {
  if (notifIds.length === 0) return;
  for (const uid of userIds) {
    if (!uid) continue;
    try {
      const existing = readLocalReadNotifIds([uid]);
      const next = Array.from(new Set([...existing, ...notifIds])).slice(-250);
      localStorage.setItem(
        `${LS_READ_NOTIFS_PREFIX}${uid}`,
        JSON.stringify(next)
      );
    } catch {
      // ignore
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(LOCAL_NOTIF_EVENT));
  } catch {
    // ignore
  }
}

export function getDeviceInstanceId(): string {
  try {
    const existing = localStorage.getItem(LS_DEVICE_INSTANCE_KEY);
    if (existing && existing.trim().length > 0) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(LS_DEVICE_INSTANCE_KEY, generated);
    return generated;
  } catch {
    return 'dev_web_fallback';
  }
}

export function readLocallyOriginatingIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_LOCAL_ORIGIN_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function recordLocallyOriginatingIds(ids: string[]): string[] {
  const next = appendCappedIds(readLocallyOriginatingIds(), ids, MAX_TRACKED_NOTIF_IDS);
  try {
    localStorage.setItem(LS_LOCAL_ORIGIN_IDS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function readDeliveredNotifIds(userId?: string | null): string[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`${LS_DELIVERED_IDS_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function recordDeliveredNotifIds(
  userId: string | null | undefined,
  ids: string[]
): string[] {
  if (!userId) return [];
  const next = appendCappedIds(readDeliveredNotifIds(userId), ids, MAX_TRACKED_NOTIF_IDS);
  try {
    localStorage.setItem(`${LS_DELIVERED_IDS_PREFIX}${userId}`, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function cancelProgrammeReminders(programmeId: string): void {
  if (!programmeId) return;
  const rem5 = `notif_prog5d_${programmeId}`;
  const rem1 = `notif_prog1d_${programmeId}`;
  try {
    const existing = readLocalNotifications();
    const filtered = existing.filter((n) => n.id !== rem5 && n.id !== rem1);
    if (filtered.length !== existing.length) {
      localStorage.setItem(LS_LOCAL_NOTIFS_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent(LOCAL_NOTIF_EVENT));
    }
  } catch {
    // ignore
  }
}

export async function evaluateAndDispatchRemoteNotification(params: {
  notification: FellowshipNotification;
  account: Pick<FellowshipAccount, 'id' | 'userId' | 'role'> | null | undefined;
  activeUserId: string | null | undefined;
  localReadIds?: string[];
  onlyWhenHidden?: boolean;
}): Promise<boolean> {
  const { notification, account, activeUserId, localReadIds = [], onlyWhenHidden = false } = params;
  if (!activeUserId || !account) return false;

  const deviceInstanceId = getDeviceInstanceId();
  const locallyOriginatingIds = readLocallyOriginatingIds();
  const deliveredIds = readDeliveredNotifIds(activeUserId);

  const decision = syncRemoteNotificationIfNew({
    notification,
    account,
    activeUserId,
    deviceInstanceId,
    locallyOriginatingIds,
    deliveredIds,
    localReadIds,
  });

  if (!decision.shouldDeliver) {
    return false;
  }

  recordDeliveredNotifIds(activeUserId, decision.tokens);

  if (
    onlyWhenHidden &&
    typeof document !== 'undefined' &&
    document.visibilityState !== 'hidden'
  ) {
    return false;
  }

  await showBackgroundLocalNotification(notification);
  return true;
}

export async function registerPeriodicOrBackgroundSync(): Promise<void> {
  try {
    const reg = await getSwRegistration();
    if (!reg) return;
    const regAny = reg as unknown as {
      sync?: { register: (tag: string) => Promise<void> };
      periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
    };
    if ('sync' in reg && regAny.sync?.register) {
      await regAny.sync.register('gideonites-bg-sync').catch(() => {});
    }
    if ('periodicSync' in reg && regAny.periodicSync?.register) {
      await regAny.periodicSync
        .register('gideonites-check-notifications', {
          minInterval: 12 * 60 * 60 * 1000,
        })
        .catch(() => {});
    }
  } catch {
    // ignore unsupported SW sync
  }
}
