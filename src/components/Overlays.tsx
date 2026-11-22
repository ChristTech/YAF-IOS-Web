import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Megaphone,
  Plus,
  Send,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { createCommunityPost, markNotificationsRead } from '../services/fellowshipService';
import {
  canManageFellowship,
  formatActionErrorMessage,
  formatRelativeTime,
} from '../utils/fellowshipLogic';
import {
  getNotificationTargetTab,
  isNotificationReadByAccount,
} from '../utils/notificationLogic';
import {
  disableBackgroundPushNotifications,
  enableBackgroundPushNotifications,
  getNotificationDiagnostics,
  sendTestPushNotification,
  type NotificationDiagnostics,
} from '../utils/pushNotifications';
import type {
  CommunityPost,
  FellowshipAccount,
  FellowshipNotification,
  MainTab,
} from '../types/fellowship';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: CommunityPost[];
  account: FellowshipAccount;
  titleLabel: string;
}

export const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({
  isOpen,
  onClose,
  announcements,
  account,
  titleLabel,
}) => {
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isManager = canManageFellowship(account.role);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setPublishError(null);
    setSubmitting(true);
    try {
      await createCommunityPost({
        author: account,
        category: urgent ? 'ANNOUNCEMENT_URGENT' : 'ANNOUNCEMENT_NORMAL',
        title: title.trim(),
        content: content.trim(),
      });
      setTitle('');
      setContent('');
      setUrgent(false);
      setShowComposer(false);
    } catch (err) {
      setPublishError(formatActionErrorMessage(err, 'Unable to broadcast announcement.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcements-modal-title"
      className="fixed inset-0 z-50 bg-white dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col"
    >
      <div className="bg-[#0F172A] text-white px-4 sm:px-6 h-16 flex items-center justify-between gap-3 border-b border-[#1E293B]">
        <div className="flex items-center gap-2.5">
          <Megaphone className="w-5 h-5 text-[#F59E0B]" />
          <h2 id="announcements-modal-title" className="text-base sm:text-lg font-bold">
            {titleLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <button
              type="button"
              onClick={() => setShowComposer((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] px-3 py-2 text-xs font-semibold text-white min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>New Notice</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Close announcements"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-[#1E293B] flex items-center justify-center text-[#94A3B8] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4">
        {showComposer && isManager && (
          <form
            onSubmit={handlePublish}
            className="rounded-2xl bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-3"
          >
            <h3 className="text-sm font-bold">Broadcast Fellowship Announcement</h3>
            {publishError && (
              <p role="alert" className="text-xs font-semibold text-[#E11D48]">
                {publishError}
              </p>
            )}
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement Headline"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
            <textarea
              rows={3}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write official notice for all Gideonites..."
              className="w-full p-3.5 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                  className="w-4 h-4 accent-[#E11D48]"
                />
                <span>Mark as Urgent Alert</span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold"
              >
                {submitting ? 'Broadcasting...' : 'Broadcast Now'}
              </button>
            </div>
          </form>
        )}

        {announcements.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
            No official announcements posted yet.
          </div>
        ) : (
          announcements.map((item) => {
            const isUrgent = item.category === 'ANNOUNCEMENT_URGENT';
            return (
              <article
                key={item.id}
                className={`rounded-2xl p-5 border ${
                  isUrgent
                    ? 'bg-[#FFF1F2] dark:bg-[#9F1239]/20 border-[#E11D48]/40'
                    : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#374151]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] mb-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-white">
                    {isUrgent && <AlertTriangle className="w-3.5 h-3.5 text-[#E11D48]" />}
                    {isUrgent ? 'URGENT NOTICE' : 'OFFICIAL ANNOUNCEMENT'}
                  </span>
                  <span>
                    {item.authorName} · {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
                {item.title && <h3 className="text-base font-bold mb-1.5">{item.title}</h3>}
                <p className="text-sm text-[#334155] dark:text-[#CBD5E1] whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: FellowshipNotification[];
  account: FellowshipAccount;
  titleLabel: string;
  onNavigateTab?: (tab: MainTab) => void;
  onPermissionGranted?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  account,
  titleLabel,
  onNavigateTab,
  onPermissionGranted,
}) => {
  const [diag, setDiag] = useState<NotificationDiagnostics | null>(null);
  const [busyPush, setBusyPush] = useState(false);
  const [pushMessage, setPushMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setPushMessage(null);
    void getNotificationDiagnostics().then((d) => {
      if (active) setDiag(d);
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const userId = account.id;
  const secondaryId = account.userId;

  const handleEnableBackgroundPush = async () => {
    setBusyPush(true);
    setPushMessage(null);
    try {
      const res = await enableBackgroundPushNotifications({
        userId: secondaryId || userId,
        role: account.role,
      });
      setDiag(res.diagnostics);
      if (res.diagnostics.permission === 'granted') {
        onPermissionGranted?.();
      }
      if (res.ok) {
        setPushMessage({
          kind: 'ok',
          text: 'Background & lock-screen push alerts enabled on this device.',
        });
      } else {
        setPushMessage({
          kind: 'err',
          text: res.error || 'Could not enable background push.',
        });
      }
    } finally {
      setBusyPush(false);
    }
  };

  const handleDisableBackgroundPush = async () => {
    setBusyPush(true);
    setPushMessage(null);
    try {
      const next = await disableBackgroundPushNotifications();
      setDiag(next);
      setPushMessage({
        kind: 'ok',
        text: 'Background push disabled for this device.',
      });
    } finally {
      setBusyPush(false);
    }
  };

  const handleSendTest = async () => {
    setBusyPush(true);
    setPushMessage(null);
    try {
      const res = await sendTestPushNotification({
        userId: secondaryId || userId,
      });
      setPushMessage({
        kind: res.ok ? 'ok' : 'err',
        text: res.message,
      });
    } finally {
      setBusyPush(false);
    }
  };

  const handleOpenItem = async (item: FellowshipNotification) => {
    await markNotificationsRead([item], userId, secondaryId);
    if (onNavigateTab) {
      onNavigateTab(getNotificationTargetTab(item.type));
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notifications-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-safe-modal"
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
        <div className="bg-[#0F172A] text-white px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-5 h-5 text-[#F59E0B] shrink-0" />
            <h2 id="notifications-modal-title" className="text-base font-bold">
              {titleLabel}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close notification center"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device & Lock-Screen Push Readiness Card */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-[#E2E8F0] dark:border-[#374151] bg-[#F8FAFC] dark:bg-[#0F172A]/60 space-y-2.5">
          {diag?.state === 'push-active' ? (
            <div className="rounded-xl bg-[#DCFCE7] dark:bg-[#16A34A]/15 border border-[#16A34A]/30 p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <ShieldCheck className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#15803D] dark:text-[#86EFAC]">
                    Background Push Active
                  </p>
                  <p className="text-[11px] text-[#166534] dark:text-[#BBF7D0]">
                    Alerts arrive on your lock screen even when the app is closed.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={busyPush}
                  onClick={handleSendTest}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white px-2.5 py-1.5 text-[11px] font-bold min-h-[36px]"
                >
                  <Send className="w-3 h-3" />
                  <span>Send Test Alert</span>
                </button>
                <button
                  type="button"
                  disabled={busyPush}
                  onClick={handleDisableBackgroundPush}
                  aria-label="Disable background alerts"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#15803D]/30 px-2.5 py-1.5 text-[11px] font-semibold text-[#15803D] dark:text-[#86EFAC] min-h-[36px]"
                >
                  <BellOff className="w-3 h-3" />
                  <span>Disable</span>
                </button>
              </div>
            </div>
          ) : diag?.state === 'ios-install-required' ? (
            <div className="rounded-xl bg-[#FEF3C7]/70 dark:bg-[#F59E0B]/15 border border-[#F59E0B]/50 p-3 flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-[#92400E] dark:text-[#FEF3C7]">
                  Install to Home Screen for iPhone Lock-Screen Alerts
                </p>
                <p className="text-[11px] text-[#78350F] dark:text-[#FDE68A] mt-0.5">
                  On iOS 16.4+, tap <strong>Share → Add to Home Screen</strong> in Safari, then open the installed icon to turn on closed-app push notifications.
                </p>
              </div>
            </div>
          ) : diag?.state === 'permission-denied' ? (
            <div className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/20 border border-[#E11D48]/30 p-3 flex items-start gap-2.5">
              <BellOff className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-[#9F1239] dark:text-[#FDA4AF]">
                  Notifications Blocked in Browser Settings
                </p>
                <p className="text-[11px] text-[#881337] dark:text-[#FECDD3] mt-0.5">
                  Allow notifications for this site in Chrome/Safari settings to receive alerts when the app is closed.
                </p>
              </div>
            </div>
          ) : diag?.state === 'unsupported' ? (
            <div className="rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3 text-xs text-[#475569] dark:text-[#94A3B8]">
              In-app notifications are active. Install via Chrome, Edge, or iOS 16.4+ Home Screen Safari for background OS push.
            </div>
          ) : (
            <div className="rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#F59E0B]/50 p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-start gap-2.5 flex-1 min-w-[180px]">
                <BellRing className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                    Device alerts are currently disabled
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Enable notifications to get announcements, programmes &amp; game alerts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={busyPush}
                onClick={handleEnableBackgroundPush}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] px-4 py-2 text-xs font-bold text-white min-h-[44px] shrink-0"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{busyPush ? 'Allowing...' : 'Allow'}</span>
              </button>
            </div>
          )}

          {pushMessage && (
            <p
              role="status"
              className={`text-xs font-semibold ${
                pushMessage.kind === 'ok'
                  ? 'text-[#15803D] dark:text-[#4ADE80]'
                  : 'text-[#E11D48]'
              }`}
            >
              {pushMessage.text}
            </p>
          )}

          {notifications.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                {notifications.length} {notifications.length === 1 ? 'alert' : 'alerts'}
              </span>
              <button
                type="button"
                onClick={() => markNotificationsRead(notifications, userId, secondaryId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] dark:bg-[#1E293B] hover:bg-[#1E293B] dark:hover:bg-[#334155] px-3 py-1.5 text-xs font-semibold text-[#FEF3C7] min-h-[36px]"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark Read</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <p className="text-center py-8 text-sm text-[#64748B] dark:text-[#94A3B8]">
              You are all caught up! Real-time fellowship alerts appear here.
            </p>
          ) : (
            notifications.map((n) => {
              const isRead = isNotificationReadByAccount(n, account);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenItem(n)}
                  className={`w-full text-left rounded-xl p-3.5 border transition-colors min-h-[44px] ${
                    isRead
                      ? 'bg-[#F8FAFC] dark:bg-[#1F2937]/60 border-[#E2E8F0] dark:border-[#374151] hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937]'
                      : 'bg-[#FEF3C7]/45 dark:bg-[#F59E0B]/10 border-[#F59E0B]/60 hover:bg-[#FEF3C7]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#E11D48]">
                      {!isRead && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#E11D48]"
                          aria-label="Unread"
                        />
                      )}
                      {n.type}
                    </span>
                    <span>{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5">
                    {n.title}
                  </h4>
                  <p className="text-xs text-[#334155] dark:text-[#CBD5E1] mt-1">
                    {n.message}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface LiveNotificationBannerProps {
  notification: FellowshipNotification | null;
  onDismiss: () => void;
  onOpen: () => void;
}

export const LiveNotificationBanner: React.FC<LiveNotificationBannerProps> = ({
  notification,
  onDismiss,
  onOpen,
}) => {
  if (!notification) return null;

  return (
    <div
      role="status"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md rounded-2xl bg-[#0F172A] text-white border border-[#F59E0B] shadow-2xl p-3.5 flex items-start justify-between gap-3 animate-[slideDown_200ms_ease-out]"
    >
      <button
        type="button"
        onClick={onOpen}
        className="text-left flex items-start gap-2.5 flex-1 min-h-[44px]"
      >
        <Bell className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-[#F59E0B]">{notification.title}</p>
          <p className="text-xs text-[#E2E8F0] line-clamp-2 mt-0.5">
            {notification.message}
          </p>
        </div>
      </button>
      <button
        type="button"
        aria-label="Dismiss live alert"
        onClick={onDismiss}
        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
