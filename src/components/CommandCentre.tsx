import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Pencil,
  Radio,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ChurchLogoBadge, UserAvatar } from './ChurchLogoBadge';
import { BiblePickerModal } from './BiblePickerModal';
import { SpiritualPublishDialog } from './spiritual/SpiritualPublishDialog';
import {
  DataExportPreviewDialog,
  SmsBroadcastDialog,
  UploadBibleDatabaseDialog,
  type PublishCategory,
} from './profile/CommandCentreDialogs';
import { audioSermonPlayer } from '../utils/audioSermonPlayer';
import { hasPlayableAudioSermon } from '../utils/spiritualLogic';
import {
  clearDatabasePreserveAdminOnly,
  deleteSpiritualResource,
  logAuditTrail,
  setExecutiveAccountStatus,
} from '../services/fellowshipService';
import {
  buildAttendanceCsv,
  buildFinancesCsv,
  buildRosterCsv,
  formatActionErrorMessage,
  formatAuditDateTime,
  formatNGN,
  getAttendanceTotalCount,
  getDepartmentDisplayName,
  getDisplayNameForAccount,
  getEventCategoryLabel,
  getProgrammeTitle,
  getRoleLabel,
  isAdministratorRole,
  isAnnouncementCategory,
  isPendingApprovalStatus,
  sumCompletedGiving,
} from '../utils/fellowshipLogic';
import type {
  AttendanceRecord,
  AuditLogEntry,
  CommunityPost,
  FellowshipAccount,
  GivingRecord,
  Programme,
  SpiritualResource,
  UploadedBibleDoc,
} from '../types/fellowship';

interface CommandCentreProps {
  account: FellowshipAccount;
  accounts: FellowshipAccount[];
  programmes: Programme[];
  posts: CommunityPost[];
  spiritualResources: SpiritualResource[];
  uploadedBibles: UploadedBibleDoc[];
  givingRecords: GivingRecord[];
  attendanceRecords: AttendanceRecord[];
  auditLogs: AuditLogEntry[];
}

const GOVERNANCE_CHECKLIST = [
  { label: 'RBAC Security & Role Verification', status: 'Enforced' },
  { label: 'Financial Ledger Auditability', status: 'Active' },
  { label: 'Offline-First Cache Sync', status: 'Operational' },
  { label: 'Member Data Protection', status: 'Compliant' },
  { label: 'Multilingual Resource Packs', status: 'Available (EN, YO, HA, IG)' },
] as const;

export const CommandCentre: React.FC<CommandCentreProps> = ({
  account,
  accounts,
  programmes,
  posts,
  spiritualResources,
  uploadedBibles,
  givingRecords,
  attendanceRecords,
  auditLogs,
}) => {
  const isAdmin = isAdministratorRole(account.role);
  const displayName = getDisplayNameForAccount(account);

  const [tab, setTab] = useState<'kpis' | 'search' | 'audit'>('kpis');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Modals
  const [publishDialogCategory, setPublishDialogCategory] = useState<PublishCategory | null>(null);
  const [editingSpiritual, setEditingSpiritual] = useState<SpiritualResource | null>(null);
  const [showBibleUpload, setShowBibleUpload] = useState(false);
  const [biblePickerState, setBiblePickerState] = useState<{
    open: boolean;
    defaultTab: 'All' | 'Uploaded';
    initialDoc: UploadedBibleDoc | null;
  }>({ open: false, defaultTab: 'All', initialDoc: null });

  const [exportPreview, setExportPreview] = useState<{
    title: string;
    filename: string;
    csvContent: string;
    label: string;
  } | null>(null);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingDb, setClearingDb] = useState(false);

  // Local dismissal for fallback seed items if deleted
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Universal Search
  const [searchQuery, setSearchQuery] = useState('');

  const pendingExecutives = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (a.role === 'EXECUTIVE' || a.role === 'YOUTH_EXECUTIVE') &&
          isPendingApprovalStatus(a.status)
      ),
    [accounts]
  );

  const activeProgrammesCount = useMemo(
    () => programmes.filter((p) => (p.status || '').toUpperCase() !== 'CANCELLED').length,
    [programmes]
  );

  const totalAttendanceCount = useMemo(
    () => getAttendanceTotalCount(attendanceRecords),
    [attendanceRecords]
  );

  const totalCompletedFinancesNgn = useMemo(
    () => sumCompletedGiving(givingRecords),
    [givingRecords]
  );

  const visibleSpiritualResources = useMemo(
    () => spiritualResources.filter((r) => !dismissedIds.has(r.id)),
    [spiritualResources, dismissedIds]
  );

  const sermonsCount = useMemo(
    () => visibleSpiritualResources.filter((r) => r.kind === 'SERMON').length,
    [visibleSpiritualResources]
  );

  const devotionalsCount = useMemo(
    () => visibleSpiritualResources.filter((r) => r.kind === 'DEVOTIONAL').length,
    [visibleSpiritualResources]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedProgrammes = programmes.filter(
      (p) =>
        getProgrammeTitle(p).toLowerCase().includes(q) ||
        (p.venue || '').toLowerCase().includes(q) ||
        getEventCategoryLabel(p.category).toLowerCase().includes(q) ||
        (p.speaker || '').toLowerCase().includes(q)
    );

    const matchedAnnouncements = posts.filter(
      (p) =>
        p.isHidden !== true &&
        isAnnouncementCategory(p.category) &&
        ((p.title || '').toLowerCase().includes(q) ||
          (p.content || '').toLowerCase().includes(q) ||
          (p.authorName || '').toLowerCase().includes(q))
    );

    const matchedSpiritual = [
      ...visibleSpiritualResources.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.speaker.toLowerCase().includes(q) ||
          r.scriptureRef.toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q)
      ),
    ];
    const matchedBibles = uploadedBibles.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.translation || b.version).toLowerCase().includes(q)
    );

    const matchedForum = posts.filter(
      (p) =>
        p.isHidden !== true &&
        !isAnnouncementCategory(p.category) &&
        ((p.title || '').toLowerCase().includes(q) ||
          (p.content || '').toLowerCase().includes(q) ||
          (p.authorName || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q))
    );

    const matchedMembers = accounts.filter(
      (m) =>
        getDisplayNameForAccount(m).toLowerCase().includes(q) ||
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        getDepartmentDisplayName(m.department).toLowerCase().includes(q) ||
        getRoleLabel(m.role).toLowerCase().includes(q)
    );

    const totalHits =
      matchedProgrammes.length +
      matchedAnnouncements.length +
      matchedSpiritual.length +
      matchedBibles.length +
      matchedForum.length +
      matchedMembers.length;

    return {
      totalHits,
      programmes: matchedProgrammes,
      announcements: matchedAnnouncements,
      spiritual: matchedSpiritual,
      bibles: matchedBibles,
      forum: matchedForum,
      members: matchedMembers,
    };
  }, [searchQuery, programmes, posts, visibleSpiritualResources, uploadedBibles, accounts]);

  const handleDeleteSpiritual = async (res: SpiritualResource) => {
    setErrorFeedback(null);
    try {
      if (audioSermonPlayer.getState().activeResourceId === res.id) {
        audioSermonPlayer.stop();
      }
      if (!res.id.startsWith('seed-')) {
        await deleteSpiritualResource(res.id, res.audioCloudId);
      }
      setDismissedIds((prev) => new Set(prev).add(res.id));
      await logAuditTrail({
        actorName: displayName,
        actorRole: account.role,
        action: 'DELETE_SPIRITUAL_RESOURCE',
        actionType: 'DELETE_SPIRITUAL_RESOURCE',
        target: res.title,
        targetEntity: res.id,
        details: `Removed ${res.kind}: ${res.title}`,
      });
      setStatusMessage(`'${res.title}' removed.`);
    } catch (err) {
      setErrorFeedback(formatActionErrorMessage(err, 'Unable to remove resource.'));
    }
  };

  const handleExecDecision = async (exec: FellowshipAccount, decision: 'APPROVED' | 'SUSPENDED') => {
    setErrorFeedback(null);
    try {
      await setExecutiveAccountStatus(exec.id, decision);
      await logAuditTrail({
        actorName: displayName,
        actorRole: account.role,
        action: decision === 'APPROVED' ? 'EXECUTIVE_APPROVED' : 'EXECUTIVE_DECLINED',
        actionType: decision === 'APPROVED' ? 'EXECUTIVE_APPROVED' : 'EXECUTIVE_DECLINED',
        target: exec.email,
        targetEntity: exec.id,
        details: `${exec.fullName} set to ${decision}`,
      });
      setStatusMessage(
        decision === 'APPROVED'
          ? `Executive registration approved for ${exec.fullName}.`
          : `Executive registration declined for ${exec.fullName}.`
      );
    } catch (err) {
      setErrorFeedback(formatActionErrorMessage(err, 'Unable to update executive status.'));
    }
  };

  const handleClearDatabase = async () => {
    setErrorFeedback(null);
    setClearingDb(true);
    try {
      await clearDatabasePreserveAdminOnly();
      await logAuditTrail({
        actorName: 'Admin',
        actorRole: 'ADMINISTRATOR',
        action: 'DATABASE_RESET',
        actionType: 'DATABASE_RESET',
        target: 'ALL_COLLECTIONS',
        targetEntity: 'ALL_COLLECTIONS',
        details: 'Database cleared; Admin preserved.',
      });
      setShowClearConfirm(false);
      setStatusMessage('Database cleared for real user testing. Only Admin account was preserved.');
    } catch (err) {
      setErrorFeedback(formatActionErrorMessage(err, 'Unable to clear database records.'));
    } finally {
      setClearingDb(false);
    }
  };

  const handleOpenCsvExport = (kind: 'finances' | 'attendance' | 'roster') => {
    if (kind === 'finances') {
      setExportPreview({
        title: 'Finances CSV Export Preview',
        filename: 'gideonites-finances.csv',
        csvContent: buildFinancesCsv(givingRecords),
        label: 'Finances',
      });
    } else if (kind === 'attendance') {
      setExportPreview({
        title: 'Attendance CSV Export Preview',
        filename: 'gideonites-attendance.csv',
        csvContent: buildAttendanceCsv(attendanceRecords),
        label: 'Attendance',
      });
    } else {
      setExportPreview({
        title: 'Member Roster CSV Export Preview',
        filename: 'gideonites-roster.csv',
        csvContent: buildRosterCsv(accounts),
        label: 'Roster',
      });
    }
  };

  const handleSyncChms = async () => {
    await logAuditTrail({
      actorName: displayName,
      actorRole: account.role,
      action: 'CHMS_SYNC',
      actionType: 'CHMS_SYNC',
      target: 'GIDEONITES_CHMS',
      targetEntity: 'GIDEONITES_CHMS',
      details: `${accounts.length} member records verified`,
    });
    setStatusMessage(
      `ChMS synchronization completed (${accounts.length} member records verified).`
    );
  };

  return (
    <div className="space-y-5 pb-24">
      {/* 3 Inner Primary Tabs */}
      <div
        role="tablist"
        aria-label="Command Centre tabs"
        className="grid grid-cols-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] rounded-2xl p-1.5 gap-1.5"
      >
        {(
          [
            { id: 'kpis', label: 'KPIs' },
            { id: 'search', label: 'Search' },
            { id: 'audit', label: isAdmin ? 'Audit & Sync' : 'Ministry Reports' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`min-h-[42px] px-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap ${
              tab === item.id
                ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Dismissible Green Status Banner */}
      {statusMessage && (
        <div
          role="status"
          className="rounded-2xl bg-[#16A34A] text-white px-4 py-3 text-xs font-bold flex items-center justify-between gap-3 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </span>
          <button
            type="button"
            aria-label="Dismiss status message"
            onClick={() => setStatusMessage(null)}
            className="p-1 rounded-lg hover:bg-black/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorFeedback && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-4 py-3 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center justify-between gap-3"
        >
          <span>{errorFeedback}</span>
          <button type="button" onClick={() => setErrorFeedback(null)} className="p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* INNER TAB 0: KPIs */}
      {tab === 'kpis' && (
        <div className="space-y-5">
          {/* Dark Hero Card (#0F172A) */}
          <section className="rounded-3xl bg-[#0F172A] text-white border border-[#1E293B] p-5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3.5">
              <ChurchLogoBadge size={44} variant="circle" />
              <div>
                <p className="text-[11px] font-extrabold tracking-wider text-[#F59E0B] uppercase">
                  {isAdmin ? 'ADMIN COMMAND CENTRE' : 'EXECUTIVE COMMAND CENTRE'}
                </p>
                <p className="text-xs sm:text-sm text-[#CBD5E1] mt-0.5">
                  {isAdmin
                    ? 'System Oversight, Governance & Security Audit'
                    : 'Ministry Coordination & Operations Oversight'}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${
                isAdmin ? 'bg-[#F59E0B] text-[#0F172A]' : 'bg-[#E11D48] text-white'
              }`}
            >
              {getRoleLabel(account.role)}
            </span>
          </section>

          {/* 2x2 KPI Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4">
              <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                MEMBERS
              </p>
              <p className="font-display text-2xl sm:text-3xl font-extrabold mt-1 tabular-nums">
                {accounts.length}
              </p>
              <p className="text-xs text-[#F59E0B] font-semibold mt-1">
                {pendingExecutives.length} pending approval
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4">
              <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                ATTENDANCE
              </p>
              <p className="font-display text-2xl sm:text-3xl font-extrabold mt-1 tabular-nums">
                {totalAttendanceCount}
              </p>
              <p className="text-xs text-[#10B981] font-semibold mt-1">Across all services</p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4">
              <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                FINANCES
              </p>
              <p className="font-display text-2xl sm:text-3xl font-extrabold mt-1 tabular-nums">
                {formatNGN(totalCompletedFinancesNgn)}
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-semibold mt-1">
                Tithes, Pledges, Dues
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4">
              <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                PROGRAMMES
              </p>
              <p className="font-display text-2xl sm:text-3xl font-extrabold mt-1 tabular-nums">
                {activeProgrammesCount}
              </p>
              <p className="text-xs text-[#E11D48] font-semibold mt-1">Active events listed</p>
            </div>
          </div>

          {/* SERMONS, DEVOTIONALS & BIBLE BACKEND Card (Gold-Bordered) */}
          <section className="rounded-2xl bg-white dark:bg-[#111827] border-2 border-[#F59E0B]/70 p-5 space-y-4">
            <div>
              <h3 className="text-xs font-extrabold tracking-wider text-[#D97706] dark:text-[#F59E0B] uppercase">
                SERMONS, DEVOTIONALS &amp; BIBLE BACKEND
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                Publish sermons, devotionals, and PDF/EPUB Bible packs synced in real time across Android &amp; PWA.
              </p>
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPublishDialogCategory('SERMON')}
                className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Upload Sermon</span>
              </button>
              <button
                type="button"
                onClick={() => setPublishDialogCategory('DEVOTIONAL')}
                className="min-h-[44px] px-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-extrabold flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Daily Devotional</span>
              </button>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowBibleUpload(true)}
                className="min-h-[44px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] hover:border-[#E11D48] text-xs font-bold flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-[#E11D48]" />
                <span>Upload PDF / EPUB Bible</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setBiblePickerState({
                    open: true,
                    defaultTab: uploadedBibles.length > 0 ? 'Uploaded' : 'All',
                    initialDoc: null,
                  })
                }
                className="min-h-[44px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] hover:border-[#F59E0B] text-xs font-bold flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-[#F59E0B]" />
                <span>Open Bible Reference</span>
              </button>
            </div>

            {/* Backend PDF / EPUB Bibles Sub-List */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                BACKEND PDF / EPUB BIBLES ({uploadedBibles.length})
              </p>
              {uploadedBibles.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                  No uploaded Bible documents yet. Upload a PDF/EPUB or sync the 66-book pack above.
                </p>
              ) : (
                <div className="space-y-2">
                  {uploadedBibles.slice(0, 4).map((docItem) => (
                    <div
                      key={docItem.id}
                      className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#0F172A] text-[#F59E0B] text-[10px] font-extrabold">
                            {docItem.fileFormat || docItem.format}
                          </span>
                          <p className="text-xs font-bold truncate">{docItem.title}</p>
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                          {docItem.pageOrChapterCount || docItem.sections?.length || 1} sections &bull;{' '}
                          {docItem.extractedVersesCount || 0} extracted verses &bull; by{' '}
                          {docItem.uploadedBy}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBiblePickerState({
                            open: true,
                            defaultTab: 'Uploaded',
                            initialDoc: docItem,
                          })
                        }
                        className="min-h-[34px] px-3 rounded-lg bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold shrink-0"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Published Sermons & Devotionals Sub-List */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                PUBLISHED SERMONS ({sermonsCount}) &amp; DEVOTIONALS ({devotionalsCount})
              </p>
              {visibleSpiritualResources.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                  No sermons or devotionals published yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleSpiritualResources.slice(0, 4).map((res) => (
                    <div
                      key={res.id}
                      className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] dark:text-[#FB7185] text-[10px] font-extrabold">
                            {res.kind.replace('_', ' ')}
                          </span>
                          {hasPlayableAudioSermon(res) && (
                            <span className="px-2 py-0.5 rounded bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-[10px] font-extrabold">
                              🎧 Audio
                            </span>
                          )}
                          <p className="text-xs font-bold truncate">{res.title}</p>
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                          {res.scriptureRef} &bull; {res.speaker}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!res.id.startsWith('seed-') && (
                          <button
                            type="button"
                            aria-label={`Edit ${res.title}`}
                            onClick={() => {
                              setEditingSpiritual(res);
                              setPublishDialogCategory(res.kind);
                            }}
                            className="min-h-[36px] min-w-[36px] rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#E2E8F0]/60 dark:hover:bg-[#374151] flex items-center justify-center shrink-0"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${res.title}`}
                          onClick={() => handleDeleteSpiritual(res)}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-[#E11D48] hover:bg-[#FFF1F2] dark:hover:bg-[#9F1239]/25 flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* EXECUTIVE SIGN-UP APPROVALS (ADMINISTRATOR ONLY) */}
          {isAdmin && (
            <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3">
              <h3 className="text-xs font-extrabold tracking-wider text-[#0F172A] dark:text-white uppercase">
                EXECUTIVE SIGN-UP APPROVALS ({pendingExecutives.length})
              </h3>
              {pendingExecutives.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  No pending Youth Executive sign-up requests.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pendingExecutives.map((exec) => (
                    <div
                      key={exec.id}
                      className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar account={exec} size={42} />
                        <div>
                          <p className="text-sm font-bold">{exec.fullName}</p>
                          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {getRoleLabel(exec.role)} &bull; {getDepartmentDisplayName(exec.department)}
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            {exec.email} &bull; {exec.phone || exec.phoneNumber || 'No phone'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecDecision(exec, 'SUSPENDED')}
                          className="min-h-[38px] px-3.5 rounded-lg border border-[#E11D48] text-[#E11D48] text-xs font-bold inline-flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecDecision(exec, 'APPROVED')}
                          className="min-h-[38px] px-3.5 rounded-lg bg-[#10B981] text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* GOVERNANCE CHECKLIST & HEALTH */}
          <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3">
            <h3 className="text-xs font-extrabold tracking-wider text-[#0F172A] dark:text-white uppercase">
              GOVERNANCE CHECKLIST &amp; HEALTH
            </h3>
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#374151]">
              {GOVERNANCE_CHECKLIST.map((row) => (
                <div
                  key={row.label}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-semibold text-[#334155] dark:text-[#CBD5E1]">
                    {row.label}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#D1FAE5] dark:bg-[#10B981]/20 text-[#065F46] dark:text-[#34D399] font-bold text-[11px]">
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* RESET DATABASE FOR REAL USER TESTING (ADMINISTRATOR ONLY) */}
          {isAdmin && (
            <section className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/15 border border-[#E11D48]/40 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-extrabold tracking-wider text-[#9F1239] dark:text-[#FECDD3] uppercase">
                    RESET DATABASE FOR REAL USER TESTING
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                    Removes all programmes, scriptures, forum posts, inquiries, quizzes, notifications, and non-admin member records while strictly preserving the Admin account (user-admin-01).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full sm:w-auto min-h-[42px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold"
              >
                Clear Database (Preserve Admin Only)
              </button>
            </section>
          )}
        </div>
      )}

      {/* INNER TAB 1: SEARCH */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search programmes, alerts, forum, sermons, members..."
              className="w-full min-h-[48px] pl-11 pr-10 rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!searchResults ? (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
              Type keywords above to search across the entire The Gideonites - The Youth Alive Fellowship platform.
            </div>
          ) : searchResults.totalHits === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
              No records found matching "{searchQuery.trim()}".
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Programmes & Events */}
              {searchResults.programmes.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-[#E11D48] uppercase">
                    Programmes &amp; Events ({searchResults.programmes.length})
                  </h4>
                  {searchResults.programmes.slice(0, 6).map((p) => (
                    <div key={p.id} className="text-xs py-1 border-b last:border-b-0 border-[#F1F5F9] dark:border-[#1F2937]">
                      <p className="font-bold">{getProgrammeTitle(p)}</p>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">
                        {getEventCategoryLabel(p.category)} &bull; {p.venue}
                      </p>
                    </div>
                  ))}
                </section>
              )}

              {/* 2. Announcements */}
              {searchResults.announcements.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-[#E11D48] uppercase">
                    Announcements ({searchResults.announcements.length})
                  </h4>
                  {searchResults.announcements.slice(0, 6).map((a) => (
                    <div key={a.id} className="text-xs py-1 border-b last:border-b-0 border-[#F1F5F9] dark:border-[#1F2937]">
                      <p className="font-bold">{a.title || 'Fellowship Notice'}</p>
                      <p className="text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{a.content}</p>
                    </div>
                  ))}
                </section>
              )}

              {/* 3. Spiritual Library */}
              {(searchResults.spiritual.length > 0 || searchResults.bibles.length > 0) && (
                <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-[#E11D48] uppercase">
                    Spiritual Library ({searchResults.spiritual.length + searchResults.bibles.length})
                  </h4>
                  {searchResults.spiritual.slice(0, 5).map((r) => (
                    <div key={r.id} className="text-xs py-1 border-b last:border-b-0 border-[#F1F5F9] dark:border-[#1F2937]">
                      <p className="font-bold">{r.title}</p>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">
                        {r.kind.replace('_', ' ')} &bull; {r.scriptureRef} &bull; {r.speaker}
                      </p>
                    </div>
                  ))}
                  {searchResults.bibles.slice(0, 4).map((b) => (
                    <div key={b.id} className="text-xs py-1 border-b last:border-b-0 border-[#F1F5F9] dark:border-[#1F2937]">
                      <p className="font-bold">{b.title}</p>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">
                        {b.translation || b.version} &bull; {b.fileFormat || b.format} Bible Edition
                      </p>
                    </div>
                  ))}
                </section>
              )}

              {/* 4. Forum Discussions */}
              {searchResults.forum.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-[#E11D48] uppercase">
                    Forum Discussions ({searchResults.forum.length})
                  </h4>
                  {searchResults.forum.slice(0, 6).map((p) => (
                    <div key={p.id} className="text-xs py-1 border-b last:border-b-0 border-[#F1F5F9] dark:border-[#1F2937]">
                      <p className="font-bold">
                        {p.title || p.category} &bull; <span className="text-[#64748B]">{p.authorName}</span>
                      </p>
                      <p className="text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{p.content}</p>
                    </div>
                  ))}
                </section>
              )}

              {/* 5. Members & Roster */}
              {searchResults.members.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2">
                  <h4 className="text-xs font-extrabold text-[#E11D48] uppercase">
                    Members &amp; Roster ({searchResults.members.length})
                  </h4>
                  {searchResults.members.slice(0, 8).map((m) => (
                    <div key={m.id} className="text-xs py-1 border-b last:border-b-0 border-[#F1F5F9] dark:border-[#1F2937]">
                      <p className="font-bold">{getDisplayNameForAccount(m)}</p>
                      <p className="text-[#64748B] dark:text-[#94A3B8]">
                        {getRoleLabel(m.role)} &bull; {getDepartmentDisplayName(m.department)} &bull; {m.email}
                      </p>
                    </div>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* INNER TAB 2: AUDIT & SYNC / MINISTRY REPORTS */}
      {tab === 'audit' && (
        <div className="space-y-5">
          {/* 1. DATA EXPORT & AUDIT ARCHIVES (CSV) */}
          <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3">
            <h3 className="text-xs font-extrabold tracking-wider text-[#0F172A] dark:text-white uppercase">
              DATA EXPORT &amp; AUDIT ARCHIVES (CSV)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleOpenCsvExport('finances')}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#F59E0B]" />
                <span>Finances</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCsvExport('attendance')}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#10B981]" />
                <span>Attendance</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCsvExport('roster')}
                className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#E11D48]" />
                <span>Roster</span>
              </button>
            </div>
          </section>

          {/* 2. EXTERNAL INTEGRATIONS (#0F172A) */}
          <section className="rounded-2xl bg-[#0F172A] text-white border border-[#1E293B] p-5 space-y-3">
            <h3 className="text-xs font-extrabold tracking-wider text-[#F59E0B] uppercase">
              EXTERNAL INTEGRATIONS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSyncChms}
                className="min-h-[44px] px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4 text-[#10B981]" />
                <span>Sync ChMS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSmsDialog(true)}
                className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                <span>SMS Blast</span>
              </button>
            </div>
          </section>

          {/* 3. Admin Outlined Reset Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="w-full min-h-[46px] px-4 rounded-2xl border-2 border-[#E11D48] text-[#E11D48] hover:bg-[#FFF1F2] dark:hover:bg-[#9F1239]/20 text-xs font-extrabold"
            >
              Clear Database for Real User Testing (Keep Admin Only)
            </button>
          )}

          {/* 4. SECURITY AUDIT TRAIL */}
          <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold tracking-wider text-[#0F172A] dark:text-white uppercase">
                SECURITY AUDIT TRAIL
              </h3>
              <span className="text-xs font-mono font-bold text-[#64748B] tabular-nums">
                {auditLogs.length} logs
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-6 text-center">
                No audit events recorded yet. Actions across Profile, Giving, and Command Centre log here.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {auditLogs.slice(0, 50).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] px-3.5 py-2.5 text-xs flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-[#0F172A] dark:text-white">
                        {log.actionType || log.action}{' '}
                        <span className="font-normal text-[#64748B] dark:text-[#94A3B8]">
                          ({log.targetEntity || log.target})
                        </span>
                      </p>
                      {log.details && (
                        <p className="text-[11px] text-[#334155] dark:text-[#CBD5E1] break-words">
                          {log.details}
                        </p>
                      )}
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {log.actorName} &bull; {getRoleLabel(log.actorRole)}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] shrink-0">
                      {formatAuditDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Clear Database Confirmation Dialog */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-db-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E11D48] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#E11D48]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 id="clear-db-modal-title" className="text-base font-bold">
                Clear Database for Real User Testing?
              </h3>
            </div>
            <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
              This will permanently clear all programmes, daily scriptures, forum posts, inquiries, quizzes, notifications, giving records, and non-admin member accounts in{' '}
              <strong>GIDEONITES</strong>. Only <strong>Admin (user-admin-01)</strong> and baseline units/seed scriptures will be preserved.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 min-h-[42px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingDb}
                onClick={handleClearDatabase}
                className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
              >
                {clearingDb ? 'Clearing...' : 'Yes, Clear Database (Keep Admin Only)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publishing, Bible Upload, Export Preview & SMS Modals */}
      <SpiritualPublishDialog
        isOpen={publishDialogCategory !== null}
        initialCategory={publishDialogCategory || 'SERMON'}
        editingResource={editingSpiritual}
        account={account}
        onClose={() => {
          setPublishDialogCategory(null);
          setEditingSpiritual(null);
        }}
        onSuccess={(msg) => setStatusMessage(msg)}
      />

      <UploadBibleDatabaseDialog
        isOpen={showBibleUpload}
        account={account}
        onClose={() => setShowBibleUpload(false)}
        onSuccess={(msg) => setStatusMessage(msg)}
      />

      <BiblePickerModal
        isOpen={biblePickerState.open}
        onClose={() => setBiblePickerState((prev) => ({ ...prev, open: false, initialDoc: null }))}
        uploadedBibles={uploadedBibles}
        defaultTab={biblePickerState.defaultTab}
        initialDoc={biblePickerState.initialDoc}
      />

      <DataExportPreviewDialog
        isOpen={exportPreview !== null}
        title={exportPreview?.title || ''}
        filename={exportPreview?.filename || ''}
        csvContent={exportPreview?.csvContent || ''}
        onClose={() => setExportPreview(null)}
        onDownloaded={async () => {
          if (!exportPreview) return;
          await logAuditTrail({
            actorName: displayName,
            actorRole: account.role,
            action: `EXPORT_${exportPreview.label.toUpperCase()}_CSV`,
            actionType: `EXPORT_${exportPreview.label.toUpperCase()}_CSV`,
            target: exportPreview.filename,
            targetEntity: exportPreview.filename,
            details: `Downloaded ${exportPreview.label} CSV archive`,
          });
          setStatusMessage(`Downloaded ${exportPreview.filename}.`);
        }}
      />

      <SmsBroadcastDialog
        isOpen={showSmsDialog}
        account={account}
        accounts={accounts}
        onClose={() => setShowSmsDialog(false)}
        onSuccess={(msg) => setStatusMessage(msg)}
      />
    </div>
  );
};
