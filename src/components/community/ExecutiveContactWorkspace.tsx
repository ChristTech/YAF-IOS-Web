import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Inbox,
  Lock,
  Mail,
  MessageSquareReply,
  Shield,
  X,
} from 'lucide-react';
import { UserAvatar } from '../ChurchLogoBadge';
import { INQUIRY_SUBJECT_TOPICS } from '../../data/bibleData';
import { createExecutiveInquiry, respondToInquiry } from '../../services/fellowshipService';
import {
  formatActionErrorMessage,
  formatShortDateTime,
  getDisplayNameForAccount,
  getInquiryMessage,
  getInquiryResponse,
  getInquiryTopic,
  getRoleLabel,
  normalizeInquiryStatus,
} from '../../utils/fellowshipLogic';
import type { ExecutiveInquiry, FellowshipAccount } from '../../types/fellowship';

interface ExecutiveContactWorkspaceProps {
  account: FellowshipAccount;
  inquiries: ExecutiveInquiry[];
  isLeadership: boolean;
  onError: (msg: string | null) => void;
}

type InboxFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

export const ExecutiveContactWorkspace: React.FC<ExecutiveContactWorkspaceProps> = ({
  account,
  inquiries,
  isLeadership,
  onError,
}) => {
  const currentUserId = account.userId || account.id;
  const displayName = getDisplayNameForAccount(account);
  const roleLabel = getRoleLabel(account.role);

  const [mode, setMode] = useState<'inbox' | 'submit'>(isLeadership ? 'inbox' : 'submit');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('ALL');

  // Member Submit Inquiry State
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [topic, setTopic] = useState<string>(INQUIRY_SUBJECT_TOPICS[0]);
  const [messageText, setMessageText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [justDelivered, setJustDelivered] = useState(false);

  // Pastoral Response Modal State
  const [respondingInquiry, setRespondingInquiry] = useState<ExecutiveInquiry | null>(null);
  const [respStatus, setRespStatus] = useState<'IN_PROGRESS' | 'RESOLVED'>('RESOLVED');
  const [respMessage, setRespMessage] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const sortedInquiries = useMemo(
    () => [...inquiries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [inquiries]
  );

  const pendingCount = useMemo(
    () =>
      sortedInquiries.filter((inq) => {
        const s = normalizeInquiryStatus(inq.status);
        return s === 'PENDING' || s === 'IN_PROGRESS';
      }).length,
    [sortedInquiries]
  );

  const filteredInbox = useMemo(() => {
    if (inboxFilter === 'ALL') return sortedInquiries;
    return sortedInquiries.filter((inq) => normalizeInquiryStatus(inq.status) === inboxFilter);
  }, [sortedInquiries, inboxFilter]);

  const myInquiries = useMemo(
    () =>
      sortedInquiries.filter(
        (inq) => inq.senderId === currentUserId || inq.senderId === account.id
      ),
    [sortedInquiries, currentUserId, account.id]
  );

  const handleTransmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    onError(null);
    setSubmitting(true);
    try {
      await createExecutiveInquiry({
        sender: account,
        isAnonymous,
        topic,
        message: messageText.trim(),
      });
      setMessageText('');
      setJustDelivered(true);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to transmit confidential message.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openResponseModal = (inq: ExecutiveInquiry) => {
    setRespondingInquiry(inq);
    const norm = normalizeInquiryStatus(inq.status);
    setRespStatus(norm === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'RESOLVED');
    setRespMessage(getInquiryResponse(inq));
    setResponseError(null);
  };

  const handleSendResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingInquiry || !respMessage.trim()) return;
    setResponseError(null);
    setSendingResponse(true);
    try {
      await respondToInquiry(respondingInquiry, {
        status: respStatus,
        responseMessage: respMessage.trim(),
        responderName: displayName,
        responderRole: roleLabel,
      });
      setRespondingInquiry(null);
    } catch (err) {
      setResponseError(formatActionErrorMessage(err, 'Unable to save pastoral response.'));
    } finally {
      setSendingResponse(false);
    }
  };

  const renderStatusPill = (inq: ExecutiveInquiry) => {
    const s = normalizeInquiryStatus(inq.status);
    if (s === 'RESOLVED') {
      return (
        <span className="px-2.5 py-1 rounded-lg bg-[#DCFCE7] text-[#16A34A] text-[10px] font-extrabold shrink-0">
          RESOLVED
        </span>
      );
    }
    if (s === 'IN_PROGRESS') {
      return (
        <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#B45309] text-[10px] font-extrabold shrink-0">
          IN PROGRESS
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] text-[#E11D48] text-[10px] font-extrabold shrink-0">
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="rounded-2xl bg-[#0F172A] text-white p-4 sm:p-5 border border-[#1E293B] space-y-1.5">
        <div className="flex items-center gap-2 text-[#F59E0B]">
          <Shield className="w-5 h-5 shrink-0" />
          <p className="text-xs font-extrabold tracking-wider">DIRECT PASTORAL &amp; EXECUTIVE ACCESS</p>
        </div>
        <p className="text-xs text-[#CBD5E1] leading-relaxed">
          Reach out confidentially to The Gideonites Youth Executives and Fellowship Leadership for spiritual counsel, prayer, academic or career guidance, and feedback.
        </p>
      </div>

      {/* Leadership Mode Switcher */}
      {isLeadership && (
        <div className="grid grid-cols-2 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setMode('inbox')}
            className={`min-h-[42px] px-3 rounded-xl text-xs font-bold transition-colors ${
              mode === 'inbox'
                ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            Executive Inbox ({pendingCount} Pending)
          </button>
          <button
            type="button"
            onClick={() => setMode('submit')}
            className={`min-h-[42px] px-3 rounded-xl text-xs font-bold transition-colors ${
              mode === 'submit'
                ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            Send Inquiry
          </button>
        </div>
      )}

      {/* Executive Inbox View */}
      {isLeadership && mode === 'inbox' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'PENDING', label: 'PENDING' },
                { key: 'IN_PROGRESS', label: 'IN PROGRESS' },
                { key: 'RESOLVED', label: 'RESOLVED' },
              ] as { key: InboxFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setInboxFilter(f.key)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border transition-colors ${
                  inboxFilter === f.key
                    ? 'bg-[#0F172A] dark:bg-[#E11D48] border-transparent text-white'
                    : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredInbox.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-2">
              <Inbox className="w-10 h-10 text-[#64748B] mx-auto opacity-60" />
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">No Inquiries in Queue</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Member counseling requests and questions will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInbox.map((inq) => {
                const topicStr = getInquiryTopic(inq);
                const msgStr = getInquiryMessage(inq);
                const responseStr = getInquiryResponse(inq);
                const responderName = inq.respondedByName || inq.respondedBy || 'Youth Leadership';
                const responderRole = inq.respondedByRole || 'Executive';

                return (
                  <article
                    key={inq.id}
                    className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {inq.isAnonymous ? (
                          <div className="w-9 h-9 rounded-full bg-[#0F172A] flex items-center justify-center shrink-0">
                            <Lock className="w-4 h-4 text-[#F59E0B]" />
                          </div>
                        ) : (
                          <UserAvatar
                            account={{
                              id: inq.senderId,
                              role: (inq.senderRole as FellowshipAccount['role']) || 'MEMBER',
                              fullName: inq.senderName,
                              avatarUrl: inq.senderAvatarUri || undefined,
                            }}
                            size={36}
                          />
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                            {topicStr}
                          </h4>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                            {inq.senderName} • {formatShortDateTime(inq.createdAt)}
                          </p>
                        </div>
                      </div>
                      {renderStatusPill(inq)}
                    </div>

                    <p className="text-sm text-[#334155] dark:text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">
                      {msgStr}
                    </p>

                    {responseStr && (
                      <div className="rounded-[10px] bg-[#0F172A] p-3.5 space-y-1">
                        <p className="text-[11px] font-extrabold text-[#F59E0B]">
                          PASTORAL / EXECUTIVE RESPONSE • {responderName} ({responderRole})
                        </p>
                        <p className="text-xs sm:text-sm text-white whitespace-pre-wrap">
                          {responseStr}
                        </p>
                      </div>
                    )}

                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openResponseModal(inq)}
                        className="min-h-[40px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <MessageSquareReply className="w-4 h-4" />
                        <span>
                          {responseStr ? 'Update Reply / Status' : 'Send Pastoral Reply'}
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Member / Submit Inquiry View */
        <div className="space-y-5">
          {justDelivered ? (
            <div className="rounded-2xl bg-[#DCFCE7] border border-[#16A34A]/30 p-5 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-[#16A34A] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-[#14532D]">
                  MESSAGE DELIVERED IN CONFIDENCE
                </h3>
                <p className="text-xs text-[#166534]">
                  Track leadership replies below in 'My Inquiries &amp; Responses'
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJustDelivered(false)}
                className="min-h-[42px] px-4 rounded-xl bg-[#16A34A] text-white text-xs font-bold"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleTransmitInquiry}
              className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 sm:p-5 space-y-4"
            >
              {/* Sender Identity + Anonymity Toggle */}
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#0F172A] text-[#F59E0B] flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                      {isAnonymous
                        ? 'From: Anonymous Youth Member'
                        : `From: ${displayName} (${roleLabel})`}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Toggle anonymity for sensitive counseling/prayer requests
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  aria-label="Toggle anonymity for sensitive counseling or prayer requests"
                  onClick={() => setIsAnonymous((v) => !v)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    isAnonymous ? 'bg-[#E11D48]' : 'bg-[#CBD5E1] dark:bg-[#475569]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition ${
                      isAnonymous ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Subject Chips */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#0F172A] dark:text-white">Inquiry Subject</p>
                <div className="flex flex-wrap gap-2">
                  {INQUIRY_SUBJECT_TOPICS.map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setTopic(subj)}
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-bold border transition-colors text-left ${
                        topic === subj
                          ? 'bg-[#0F172A] dark:bg-[#E11D48] border-transparent text-white'
                          : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                      }`}
                    >
                      {subj}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={4}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Your confidential message or prayer request..."
                className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />

              <button
                type="submit"
                disabled={submitting || !messageText.trim()}
                className="w-full min-h-[46px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>{submitting ? 'Transmitting...' : 'Transmit Confidential Message'}</span>
              </button>
            </form>
          )}

          {/* Member History */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              MY INQUIRIES &amp; PASTORAL RESPONSES ({myInquiries.length})
            </h3>

            {myInquiries.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-6 text-center text-xs text-[#64748B]">
                No confidential inquiries sent from your account yet.
              </div>
            ) : (
              myInquiries.map((inq) => {
                const topicStr = getInquiryTopic(inq);
                const msgStr = getInquiryMessage(inq);
                const responseStr = getInquiryResponse(inq);
                const responderName = inq.respondedByName || inq.respondedBy || 'Youth Leadership';
                const responderRole = inq.respondedByRole || 'Executive';

                return (
                  <article
                    key={inq.id}
                    className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">{topicStr}</h4>
                        <p className="text-[11px] text-[#64748B]">
                          {inq.isAnonymous ? 'Sent Anonymously' : inq.senderName} •{' '}
                          {formatShortDateTime(inq.createdAt)}
                        </p>
                      </div>
                      {renderStatusPill(inq)}
                    </div>
                    <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] whitespace-pre-wrap">
                      {msgStr}
                    </p>
                    {responseStr && (
                      <div className="rounded-[10px] bg-[#0F172A] p-3.5 space-y-1">
                        <p className="text-[11px] font-extrabold text-[#F59E0B]">
                          PASTORAL / EXECUTIVE RESPONSE • {responderName} ({responderRole})
                        </p>
                        <p className="text-xs sm:text-sm text-white whitespace-pre-wrap">
                          {responseStr}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Pastoral & Executive Response Modal */}
      {respondingInquiry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pastoral-reply-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-2">
              <h2 id="pastoral-reply-title" className="text-base font-bold">
                Pastoral &amp; Executive Response
              </h2>
              <button
                type="button"
                aria-label="Close pastoral response modal"
                onClick={() => setRespondingInquiry(null)}
                className="p-2 rounded-lg text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendResponse} className="p-5 space-y-4">
              {responseError && (
                <div
                  role="alert"
                  className="rounded-xl bg-[#FFF1F2] text-[#9F1239] px-3 py-2 text-xs font-semibold"
                >
                  {responseError}
                </div>
              )}

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3 space-y-1">
                <p className="text-[11px] font-bold text-[#64748B]">
                  {respondingInquiry.senderName} • {getInquiryTopic(respondingInquiry)}
                </p>
                <p className="text-xs text-[#334155] dark:text-[#CBD5E1] line-clamp-3">
                  "{getInquiryMessage(respondingInquiry)}"
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#0F172A] dark:text-white">Update Status</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRespStatus('IN_PROGRESS')}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold border ${
                      respStatus === 'IN_PROGRESS'
                        ? 'bg-[#F59E0B] border-[#F59E0B] text-[#0F172A]'
                        : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    IN PROGRESS
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespStatus('RESOLVED')}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold border ${
                      respStatus === 'RESOLVED'
                        ? 'bg-[#16A34A] border-[#16A34A] text-white'
                        : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    RESOLVED
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                required
                value={respMessage}
                onChange={(e) => setRespMessage(e.target.value)}
                placeholder="Write counsel, prayer, or leadership response..."
                className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRespondingInquiry(null)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingResponse || !respMessage.trim()}
                  className="min-h-[42px] px-5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold"
                >
                  {sendingResponse ? 'Sending...' : 'Send Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
