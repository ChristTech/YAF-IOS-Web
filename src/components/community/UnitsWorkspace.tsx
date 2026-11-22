import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { UserAvatar } from '../ChurchLogoBadge';
import { ALL_DEPARTMENT_TYPES, MINISTRY_DEPARTMENTS } from '../../data/bibleData';
import {
  assignMemberToDepartment,
  getActiveQrPassCode,
  recordUnitAttendance,
  reviewWeeklyReport,
  saveActiveQrPassCode,
  submitWeeklyReport,
} from '../../services/fellowshipService';
import {
  formatActionErrorMessage,
  formatShortDateTime,
  generateQrPassCode,
  getAttendanceTotalCount,
  getDepartmentDisplayName,
  getDisplayNameForAccount,
  normalizeDepartmentType,
} from '../../utils/fellowshipLogic';
import type { TranslationStrings } from '../../data/translations';
import type {
  AttendanceRecord,
  DepartmentType,
  FellowshipAccount,
  MinistryDepartment,
  WeeklyReport,
} from '../../types/fellowship';

interface UnitsWorkspaceProps {
  account: FellowshipAccount;
  accounts: FellowshipAccount[];
  attendanceRecords: AttendanceRecord[];
  weeklyReports: WeeklyReport[];
  labels: TranslationStrings;
  onMemberDepartmentAssigned?: (accountId: string, department: string) => void;
  onError: (msg: string | null) => void;
}

type UnitsInnerTab = 'units' | 'reports' | 'attendance' | 'qr';

function buildDeterministicQrMatrix(seedText: string): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isEdge = r === 0 || r === 6 || c === 0 || c === 6;
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = isEdge || isCore;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      hash ^= (r * 31 + c * 17 + 7);
      hash = Math.imul(hash, 16777619) >>> 0;
      grid[r][c] = (hash % 5) < 2;
    }
  }
  return grid;
}

export const UnitsWorkspace: React.FC<UnitsWorkspaceProps> = ({
  account,
  accounts,
  attendanceRecords,
  weeklyReports,
  labels,
  onMemberDepartmentAssigned,
  onError,
}) => {
  const [innerTab, setInnerTab] = useState<UnitsInnerTab>('units');

  const upperRole = (account.role || '').toUpperCase();
  const isAdmin = upperRole === 'ADMINISTRATOR' || account.id === 'user-admin-01';
  const isExecutive = upperRole.includes('EXECUTIVE') || upperRole === 'EXCO';
  const isLeadership = isAdmin || isExecutive;
  const isGuest = upperRole === 'GUEST';
  const displayName = getDisplayNameForAccount(account);
  const currentUserId = account.userId || account.id;

  // Unit Detail & Member Assignment Modals
  const [selectedUnit, setSelectedUnit] = useState<MinistryDepartment | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Unit Reports State
  const [reportFilterType, setReportFilterType] = useState<'ALL' | DepartmentType>('ALL');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [repTitle, setRepTitle] = useState('');
  const [repDeptType, setRepDeptType] = useState<DepartmentType>(
    normalizeDepartmentType(account.department)
  );
  const [repTotalAtt, setRepTotalAtt] = useState('15');
  const [repFirstTimers, setRepFirstTimers] = useState('2');
  const [repActivities, setRepActivities] = useState('');
  const [repAchievements, setRepAchievements] = useState('');
  const [repChallenges, setRepChallenges] = useState('');
  const [repNextGoals, setRepNextGoals] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Admin Review Report Modal
  const [reviewingReport, setReviewingReport] = useState<WeeklyReport | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'REVIEWED' | 'ARCHIVED'>('REVIEWED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // Attendance Tab & Record Modal
  const [attModalOpen, setAttModalOpen] = useState(false);
  const [attTitle, setAttTitle] = useState('Sunday Youth Service');
  const [attDept, setAttDept] = useState<DepartmentType>('GENERAL');
  const [attMales, setAttMales] = useState('25');
  const [attFemales, setAttFemales] = useState('30');
  const [attFirstTimers, setAttFirstTimers] = useState('3');
  const [attNotes, setAttNotes] = useState('');
  const [savingAtt, setSavingAtt] = useState(false);

  // QR Check-In Tab
  const [activePassCode, setActivePassCode] = useState<string>(() => getActiveQrPassCode());
  const [selfPassInput, setSelfPassInput] = useState('');
  const [selfCheckedInRecord, setSelfCheckedInRecord] = useState<AttendanceRecord | null>(null);
  const [selfCheckinSubmitting, setSelfCheckinSubmitting] = useState(false);

  const sortedUnits = useMemo(
    () => [...MINISTRY_DEPARTMENTS].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const unitRosterMap = useMemo(() => {
    const map: Record<DepartmentType, FellowshipAccount[]> = {
      CHOIR: [],
      DRAMA: [],
      MEDIA: [],
      PRAYER: [],
      SPORTS: [],
      USHERING: [],
      HOSPITALITY: [],
      GENERAL: [],
    };
    for (const acc of accounts) {
      const t = normalizeDepartmentType(acc.department);
      map[t].push(acc);
    }
    return map;
  }, [accounts]);

  const filteredReports = useMemo(() => {
    if (reportFilterType === 'ALL') return weeklyReports;
    return weeklyReports.filter(
      (rep) => (rep.departmentType || normalizeDepartmentType(rep.department)) === reportFilterType
    );
  }, [weeklyReports, reportFilterType]);

  const reportsStats = useMemo(() => {
    const totalReports = filteredReports.length;
    const totalAttended = filteredReports.reduce((s, r) => s + (Number(r.attendanceCount) || 0), 0);
    const totalFirstTimers = filteredReports.reduce((s, r) => s + (Number(r.firstTimersCount) || 0), 0);
    return { totalReports, totalAttended, totalFirstTimers };
  }, [filteredReports]);

  const totalHeadcount = useMemo(
    () => getAttendanceTotalCount(attendanceRecords),
    [attendanceRecords]
  );

  const qrMatrix = useMemo(() => buildDeterministicQrMatrix(activePassCode), [activePassCode]);

  const handleAssignMember = async (member: FellowshipAccount, dept: MinistryDepartment) => {
    setAssigningId(member.id);
    onError(null);
    try {
      await assignMemberToDepartment(member.id, dept.name);
      if (onMemberDepartmentAssigned) {
        onMemberDepartmentAssigned(member.id, dept.name);
      }
      setAssignModalOpen(false);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to assign member to unit.'));
    } finally {
      setAssigningId(null);
    }
  };

  const handleSubmitUnitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repTitle.trim() || !repActivities.trim()) return;
    setSubmittingReport(true);
    onError(null);
    try {
      const deptLabel = getDepartmentDisplayName(repDeptType);
      await submitWeeklyReport({
        department: deptLabel,
        departmentType: repDeptType,
        submittedBy: displayName,
        submittedById: currentUserId,
        title: repTitle.trim(),
        weekLabel: repTitle.trim(),
        attendanceCount: Math.max(0, Number(repTotalAtt) || 0),
        firstTimersCount: Math.max(0, Number(repFirstTimers) || 0),
        highlights: repActivities.trim(),
        achievements: repAchievements.trim(),
        challenges: repChallenges.trim(),
        nextWeekGoals: repNextGoals.trim(),
        prayerNeeds: repChallenges.trim(),
        status: 'SUBMITTED',
      });
      setRepTitle('');
      setRepActivities('');
      setRepAchievements('');
      setRepChallenges('');
      setRepNextGoals('');
      setReportModalOpen(false);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to submit unit report.'));
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSaveReportReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingReport) return;
    setSavingReview(true);
    onError(null);
    try {
      await reviewWeeklyReport(reviewingReport, {
        status: reviewStatus,
        reviewerNotes: reviewNotes.trim(),
        reviewedBy: displayName,
      });
      setReviewingReport(null);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to save report review.'));
    } finally {
      setSavingReview(false);
    }
  };

  const liveModalHeadcount =
    (Math.max(0, Number(attMales) || 0) || 0) + (Math.max(0, Number(attFemales) || 0) || 0);

  const handleSaveAttendanceRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAtt(true);
    onError(null);
    try {
      const males = Math.max(0, Number(attMales) || 0);
      const females = Math.max(0, Number(attFemales) || 0);
      const firstTimers = Math.max(0, Number(attFirstTimers) || 0);
      const total = males + females;
      const title = attTitle.trim() || 'Sunday Youth Service';
      await recordUnitAttendance({
        userId: currentUserId,
        userName: displayName,
        department: getDepartmentDisplayName(attDept),
        verificationCode: 'LEADER-LOG',
        serviceTitle: title,
        meetingTitle: title,
        totalAttendees: total,
        maleCount: males,
        femaleCount: females,
        firstTimersCount: firstTimers,
        notes: attNotes.trim() || undefined,
        checkedInBy: displayName,
        method: 'LEADER_LOG',
      });
      setAttNotes('');
      setAttModalOpen(false);
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to save attendance record.'));
    } finally {
      setSavingAtt(false);
    }
  };

  const handleGenerateNewPass = () => {
    const nextCode = generateQrPassCode();
    setActivePassCode(nextCode);
    saveActiveQrPassCode(nextCode);
  };

  const handleSelfCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setSelfCheckinSubmitting(true);
    const code = selfPassInput.trim().toUpperCase() || activePassCode;
    try {
      await recordUnitAttendance({
        userId: currentUserId,
        userName: displayName,
        department: getDepartmentDisplayName(account.department),
        verificationCode: code,
        serviceTitle: 'Sunday Youth Service',
        meetingTitle: 'Sunday Youth Service',
        totalAttendees: 1,
        maleCount: 0,
        femaleCount: 0,
        firstTimersCount: 0,
        checkedInBy: displayName,
        method: 'QR_SELF_CODE',
        passCode: code,
      });
      setSelfCheckedInRecord({
        id: 'recent',
        fellowshipId: 'GIDEONITES',
        userId: currentUserId,
        userName: displayName,
        department: getDepartmentDisplayName(account.department),
        verificationCode: code,
        serviceTitle: 'Sunday Youth Service',
        meetingTitle: 'Sunday Youth Service',
        totalAttendees: 1,
        checkedInBy: displayName,
        method: 'QR_SELF_CODE',
        passCode: code,
        createdAt: Date.now(),
      });
      setSelfPassInput('');
    } catch (err) {
      onError(formatActionErrorMessage(err, 'Unable to confirm check-in.'));
    } finally {
      setSelfCheckinSubmitting(false);
    }
  };

  const assignableMembers = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    return accounts
      .filter((a) => {
        if (!q) return true;
        return (
          a.fullName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [accounts, assignSearch]);

  return (
    <div className="space-y-4">
      {/* 4 Inner Tabs */}
      <div
        role="tablist"
        aria-label="Units workspace sections"
        className="grid grid-cols-4 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] rounded-2xl p-1 gap-1"
      >
        {(
          [
            { key: 'units', label: 'Units' },
            { key: 'reports', label: labels.subTabs.unitReports },
            { key: 'attendance', label: 'Attendance' },
            { key: 'qr', label: 'QR Check-In' },
          ] as { key: UnitsInnerTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={innerTab === t.key}
            onClick={() => setInnerTab(t.key)}
            className={`min-h-[42px] px-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-colors truncate ${
              innerTab === t.key
                ? 'bg-[#E11D48] text-white'
                : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 0: UNITS */}
      {innerTab === 'units' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0F172A] text-white p-4 sm:p-5 border border-[#1E293B]">
            <h3 className="font-display text-xs sm:text-sm font-extrabold tracking-wide text-[#F59E0B]">
              THE GIDEONITES - THE YOUTH ALIVE FELLOWSHIP UNITS
            </h3>
            <p className="text-xs text-[#CBD5E1] mt-1">
              Explore service arms across the fellowship, view unit rosters, and track weekly service reports.
            </p>
          </div>

          {isGuest && (
            <div className="rounded-2xl bg-[#FEF3C7] dark:bg-[#F59E0B]/15 border border-[#F59E0B]/40 p-4 text-xs text-[#92400E] dark:text-[#FBBF24] space-y-1">
              <p className="font-bold">Guest Orientation Mode</p>
              <p>
                Welcome to The Gideonites! Browse our ministry units below and speak with any Unit Coordinator after service to get started.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {sortedUnits.map((dept) => {
              const roster = unitRosterMap[dept.type] || [];
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setSelectedUnit(dept)}
                  className="text-left rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] hover:border-[#E11D48]/60 p-4 sm:p-5 space-y-2.5 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-[#E11D48] uppercase">
                      {dept.leadTitle}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1F2937] text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] tabular-nums">
                      <Users className="w-3 h-3 text-[#64748B]" />
                      {roster.length}
                    </span>
                  </div>
                  <h4 className="font-display text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                    {dept.name}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                    {dept.description}
                  </p>
                  <div className="pt-1 space-y-1 text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                      <span className="truncate">{dept.meetingSchedule}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                      <span className="truncate">{dept.venue}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: UNIT REPORTS */}
      {innerTab === 'reports' && (
        <div className="space-y-4">
          {/* Role-Specific Top Banner */}
          {isAdmin ? (
            <div className="rounded-2xl bg-[#0F172A] text-white p-4 sm:p-5 border border-[#1E293B] space-y-3">
              <div>
                <p className="text-[11px] font-extrabold tracking-wider text-[#F59E0B]">
                  ADMINISTRATOR REPORTS OVERSIGHT
                </p>
                <p className="text-xs text-[#CBD5E1] mt-0.5">
                  Review unit submissions, audit weekly headcounts, and record official leadership notes.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#1E293B] p-3 text-center">
                  <p className="text-lg font-extrabold text-white tabular-nums">
                    {reportsStats.totalReports}
                  </p>
                  <p className="text-[10px] font-semibold text-[#94A3B8]">Reports Total</p>
                </div>
                <div className="rounded-xl bg-[#1E293B] p-3 text-center">
                  <p className="text-lg font-extrabold text-[#10B981] tabular-nums">
                    {reportsStats.totalAttended}
                  </p>
                  <p className="text-[10px] font-semibold text-[#94A3B8]">Total Attended</p>
                </div>
                <div className="rounded-xl bg-[#1E293B] p-3 text-center">
                  <p className="text-lg font-extrabold text-[#E11D48] tabular-nums">
                    {reportsStats.totalFirstTimers}
                  </p>
                  <p className="text-[10px] font-semibold text-[#94A3B8]">1st Timers</p>
                </div>
              </div>
            </div>
          ) : isExecutive ? (
            <div className="rounded-2xl bg-[#0F172A] text-white p-4 border border-[#1E293B]">
              <p className="text-xs font-extrabold text-[#F59E0B]">YOUTH EXECUTIVE REPORTING DESK</p>
              <p className="text-xs text-[#CBD5E1] mt-1">
                Submit weekly unit reports for Administrator review using the button below.
              </p>
            </div>
          ) : isGuest ? (
            <div className="rounded-2xl bg-[#FEF3C7] dark:bg-[#F59E0B]/15 border border-[#F59E0B]/40 p-4 text-xs text-[#92400E] dark:text-[#FBBF24]">
              <p className="font-bold">Welcome, Guest!</p>
              <p className="mt-0.5">
                View highlights from The Gideonites service units and fellowships across recent weeks.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 text-xs text-[#475569] dark:text-[#CBD5E1]">
              <p className="font-bold text-[#0F172A] dark:text-white">Fellowship Unit Transparency</p>
              <p className="mt-0.5">
                Stay informed on weekly ministry activities, achievements, and prayer focus across all units.
              </p>
            </div>
          )}

          {/* Leadership Department Filter Chips */}
          {isLeadership && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setReportFilterType('ALL')}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border ${
                  reportFilterType === 'ALL'
                    ? 'bg-[#0F172A] dark:bg-[#E11D48] border-transparent text-white'
                    : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                }`}
              >
                All Units
              </button>
              {ALL_DEPARTMENT_TYPES.map((dt) => (
                <button
                  key={dt.type}
                  type="button"
                  onClick={() => setReportFilterType(dt.type)}
                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border ${
                    reportFilterType === dt.type
                      ? 'bg-[#E11D48] border-[#E11D48] text-white'
                      : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {dt.type}
                </button>
              ))}
            </div>
          )}

          {/* Reports Feed */}
          {filteredReports.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-2">
              <FileText className="w-9 h-9 text-[#64748B] mx-auto opacity-60" />
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">No Unit Reports Yet</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {isLeadership
                  ? 'Tap Submit Report below to file this week’s unit report.'
                  : 'Weekly unit reports will appear here once submitted by leadership.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((rep) => {
                const status = rep.status || 'SUBMITTED';
                const statusBadge =
                  status === 'REVIEWED'
                    ? 'bg-[#DCFCE7] text-[#10B981]'
                    : status === 'SUBMITTED'
                    ? 'bg-[#FEF3C7] text-[#B45309]'
                    : 'bg-[#F1F5F9] text-[#64748B]';

                return (
                  <article
                    key={rep.id}
                    className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-extrabold text-[#E11D48]">
                          {rep.department}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                          {rep.title || rep.weekLabel}
                        </h4>
                        <p className="text-[11px] text-[#64748B]">
                          Submitted by {rep.submittedBy} • {formatShortDateTime(rep.createdAt)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${statusBadge}`}>
                        {status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1F2937] font-bold tabular-nums">
                        Attended: {rep.attendanceCount}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] dark:bg-[#9F1239]/25 text-[#E11D48] font-bold tabular-nums">
                        1st Timers: {rep.firstTimersCount ?? 0}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#334155] dark:text-[#CBD5E1]">
                      <p>
                        <strong className="text-[#0F172A] dark:text-white">Activities:</strong>{' '}
                        {rep.highlights}
                      </p>
                      {rep.achievements && (
                        <p>
                          <strong className="text-[#0F172A] dark:text-white">Achievements:</strong>{' '}
                          {rep.achievements}
                        </p>
                      )}
                      {(rep.challenges || rep.prayerNeeds) && (
                        <p>
                          <strong className="text-[#0F172A] dark:text-white">Challenges:</strong>{' '}
                          {rep.challenges || rep.prayerNeeds}
                        </p>
                      )}
                      {rep.nextWeekGoals && (
                        <p>
                          <strong className="text-[#0F172A] dark:text-white">Next Week Goals:</strong>{' '}
                          {rep.nextWeekGoals}
                        </p>
                      )}
                    </div>

                    {rep.reviewerNotes && (
                      <div className="rounded-xl bg-[#0F172A] p-3 text-xs space-y-1">
                        <p className="text-[10px] font-extrabold text-[#F59E0B]">
                          OFFICIAL ADMIN NOTES • {rep.reviewedBy || 'Administrator'}
                        </p>
                        <p className="text-white">{rep.reviewerNotes}</p>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewingReport(rep);
                            setReviewStatus(status === 'ARCHIVED' ? 'ARCHIVED' : 'REVIEWED');
                            setReviewNotes(rep.reviewerNotes || '');
                          }}
                          className="min-h-[40px] px-3.5 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold"
                        >
                          Review &amp; Leave Official Notes
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {/* Leadership Submit Report FAB */}
          {isLeadership && (
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              aria-label="Submit Weekly Unit Report"
              className="fixed bottom-24 right-4 sm:right-6 z-25 min-h-[52px] px-4 rounded-2xl bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-xl flex items-center gap-2 font-bold text-xs sm:text-sm"
            >
              <ClipboardList className="w-5 h-5" />
              <span>Submit Report</span>
            </button>
          )}
        </div>
      )}

      {/* TAB 2: ATTENDANCE */}
      {innerTab === 'attendance' && (
        <div className="space-y-4">
          {isGuest && (
            <div className="rounded-2xl bg-[#FEF3C7] dark:bg-[#F59E0B]/15 border border-[#F59E0B]/40 p-4 text-xs text-[#92400E] dark:text-[#FBBF24]">
              Guest View: Service attendance totals and fellowship check-in activity are shown below.
            </div>
          )}

          <div className="rounded-2xl bg-[#0F172A] text-white p-5 border border-[#1E293B] flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold tracking-wider text-[#F59E0B]">TOTAL HEADCOUNT</p>
              <p className="text-2xl font-extrabold text-white mt-0.5 tabular-nums">
                {totalHeadcount} Attendees
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                Across {attendanceRecords.length} recorded service &amp; unit logs
              </p>
            </div>
            {isLeadership && (
              <button
                type="button"
                onClick={() => setAttModalOpen(true)}
                className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold shrink-0"
              >
                Record
              </button>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              RECENT SERVICES &amp; MEETINGS
            </h3>

            {attendanceRecords.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center text-xs text-[#64748B]">
                No service attendance records logged yet.
              </div>
            ) : (
              attendanceRecords.map((rec) => {
                const count =
                  typeof rec.totalAttendees === 'number' && rec.totalAttendees > 0
                    ? rec.totalAttendees
                    : (rec.maleCount || 0) + (rec.femaleCount || 0) > 0
                    ? (rec.maleCount || 0) + (rec.femaleCount || 0)
                    : 1;

                return (
                  <article
                    key={rec.id}
                    className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                          {rec.meetingTitle || rec.serviceTitle}
                        </h4>
                        <p className="text-[11px] text-[#64748B]">
                          {formatShortDateTime(rec.createdAt)} • {rec.department}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] text-[#E11D48] text-xs font-extrabold tabular-nums shrink-0">
                        {count} Total
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1]">
                        Males: {rec.maleCount ?? 0}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1]">
                        Females: {rec.femaleCount ?? 0}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#DCFCE7] text-[#15803D]">
                        1st Timers: {rec.firstTimersCount ?? 0}
                      </span>
                    </div>

                    {rec.notes && (
                      <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
                        <strong>Note:</strong> {rec.notes}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {isLeadership && (
            <button
              type="button"
              onClick={() => setAttModalOpen(true)}
              aria-label="Record Service Attendance"
              className="fixed bottom-24 right-4 sm:right-6 z-25 min-h-[52px] min-w-[52px] rounded-2xl bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-xl flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* TAB 3: QR CHECK-IN */}
      {innerTab === 'qr' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0F172A] text-white p-5 sm:p-6 border border-[#1E293B] flex flex-col items-center text-center space-y-4">
            <div className="flex items-center gap-2 text-[#F59E0B]">
              <QrCode className="w-5 h-5" />
              <h3 className="text-xs font-extrabold tracking-wider">MEETING CHECK-IN (QR &amp; PASS)</h3>
            </div>

            {/* 160x160 White Rounded QR Display */}
            <div className="w-[160px] h-[160px] rounded-2xl bg-white p-3 flex flex-col items-center justify-center shadow-lg">
              <svg
                viewBox="0 0 21 21"
                className="w-[120px] h-[120px] text-[#0F172A]"
                role="img"
                aria-label={`QR Code for pass ${activePassCode}`}
              >
                {qrMatrix.map((row, r) =>
                  row.map((cell, c) =>
                    cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" /> : null
                  )
                )}
              </svg>
              <span className="mt-1 font-mono text-xs font-extrabold text-[#0F172A] tracking-wider">
                {activePassCode}
              </span>
            </div>

            <p className="text-sm font-bold text-white">
              Active Meeting Pass: <span className="text-[#F59E0B] font-mono">{activePassCode}</span>
            </p>

            {isLeadership && (
              <button
                type="button"
                onClick={handleGenerateNewPass}
                className="min-h-[42px] px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-bold text-[#FEF3C7] inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-[#F59E0B]" />
                <span>Generate New Pass Code</span>
              </button>
            )}
          </div>

          {/* Member Self Check-In Card */}
          <form
            onSubmit={handleSelfCheckIn}
            className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#E11D48]" />
              <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">Member Self Check-In</h4>
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Confirm your presence for Sunday Youth Service using the active meeting pass code above.
            </p>
            <input
              type="text"
              value={selfPassInput}
              onChange={(e) => setSelfPassInput(e.target.value)}
              placeholder={`Enter Pass Code (default: ${activePassCode})`}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm font-mono"
            />
            <button
              type="submit"
              disabled={selfCheckinSubmitting}
              className="w-full min-h-[46px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold"
            >
              {selfCheckinSubmitting ? 'Confirming...' : 'Confirm Check-In'}
            </button>
          </form>

          {selfCheckedInRecord && (
            <div className="rounded-2xl bg-[#DCFCE7] border border-[#16A34A]/30 p-4 flex items-center gap-3 text-[#14532D]">
              <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
              <div>
                <p className="text-xs font-extrabold">CHECKED IN SUCCESSFULLY!</p>
                <p className="text-xs text-[#166534]">
                  {selfCheckedInRecord.userName} checked into {selfCheckedInRecord.meetingTitle} with pass{' '}
                  <span className="font-mono font-bold">{selfCheckedInRecord.passCode}</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UNIT WORKSPACE DETAIL MODAL */}
      {selectedUnit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
        >
          <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-extrabold text-[#F59E0B]">{selectedUnit.leadTitle}</p>
                <h2 id="unit-detail-title" className="text-base font-bold">
                  {selectedUnit.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close unit workspace modal"
                onClick={() => setSelectedUnit(null)}
                className="p-2 rounded-lg text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1]">
                {selectedUnit.description}
              </p>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#F59E0B]" />
                  <span>{selectedUnit.meetingSchedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#10B981]" />
                  <span>{selectedUnit.venue}</span>
                </div>
              </div>

              {/* UNIT ROSTER (X) */}
              {(() => {
                const unitMembers = unitRosterMap[selectedUnit.type] || [];
                return (
                  <div className="space-y-2">
                    <h3 className="text-xs font-extrabold tracking-wider text-[#64748B]">
                      UNIT ROSTER ({unitMembers.length})
                    </h3>
                    {unitMembers.length === 0 ? (
                      <p className="text-xs text-[#64748B] py-3">
                        No members synced to {selectedUnit.name} yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {unitMembers.slice(0, 5).map((m) => (
                          <div
                            key={m.id}
                            className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] px-3 py-2 flex items-center gap-2.5"
                          >
                            <UserAvatar account={m} size={32} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                                {getDisplayNameForAccount(m)}
                              </p>
                              <p className="text-[11px] text-[#64748B] truncate">{m.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReportFilterType(selectedUnit.type);
                    setSelectedUnit(null);
                    setInnerTab('reports');
                  }}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#0F172A] text-white text-xs font-bold"
                >
                  Open Unit Reports
                </button>
                {isLeadership && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignSearch('');
                      setAssignModalOpen(true);
                    }}
                    className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Assign Member to Unit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MEMBER TO UNIT PICKER MODAL */}
      {assignModalOpen && selectedUnit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-member-title"
          className="fixed inset-0 z-55 flex items-center justify-center bg-black/65 p-3 sm:p-5"
        >
          <div className="w-full max-w-md max-h-[82vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between">
              <h2 id="assign-member-title" className="text-sm font-bold">
                Assign Member to {selectedUnit.name}
              </h2>
              <button
                type="button"
                aria-label="Close member picker"
                onClick={() => setAssignModalOpen(false)}
                className="p-1.5 text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-[#E2E8F0] dark:border-[#374151]">
              <input
                type="search"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                placeholder="Search member by name or email..."
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {assignableMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={assigningId === m.id}
                  onClick={() => handleAssignMember(m, selectedUnit)}
                  className="w-full rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] hover:bg-[#FFF1F2] dark:hover:bg-[#374151] px-3.5 py-2.5 flex items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                      {getDisplayNameForAccount(m)}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      Current: {getDepartmentDisplayName(m.department)}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-[#E11D48] shrink-0">
                    {assigningId === m.id ? 'Assigning...' : 'Assign'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBMIT WEEKLY UNIT REPORT MODAL */}
      {reportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-report-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
        >
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between">
              <h2 id="submit-report-title" className="text-base font-bold">
                Submit Weekly Unit Report
              </h2>
              <button
                type="button"
                aria-label="Close report modal"
                onClick={() => setReportModalOpen(false)}
                className="p-2 text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitUnitReport} className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="text-xs font-bold">Report Title *</label>
                <input
                  type="text"
                  required
                  value={repTitle}
                  onChange={(e) => setRepTitle(e.target.value)}
                  placeholder="e.g., Week 47 Media & Livestream Report"
                  className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-bold">Department / Unit</label>
                  <select
                    value={repDeptType}
                    onChange={(e) => setRepDeptType(e.target.value as DepartmentType)}
                    className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-semibold"
                  >
                    {ALL_DEPARTMENT_TYPES.map((dt) => (
                      <option key={dt.type} value={dt.type}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold">Total Att.</label>
                  <input
                    type="number"
                    min={0}
                    value={repTotalAtt}
                    onChange={(e) => setRepTotalAtt(e.target.value)}
                    className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold">1st Timers</label>
                  <input
                    type="number"
                    min={0}
                    value={repFirstTimers}
                    onChange={(e) => setRepFirstTimers(e.target.value)}
                    className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold">Key Activities Conducted *</label>
                <textarea
                  rows={2}
                  required
                  value={repActivities}
                  onChange={(e) => setRepActivities(e.target.value)}
                  placeholder="Describe unit rehearsals, outreaches, or Sunday service duties..."
                  className="w-full p-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold">Achievements &amp; Highlights</label>
                <textarea
                  rows={2}
                  value={repAchievements}
                  onChange={(e) => setRepAchievements(e.target.value)}
                  placeholder="Soul winning, smooth ministration, new members joined..."
                  className="w-full p-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold">Challenges Encountered</label>
                <textarea
                  rows={2}
                  value={repChallenges}
                  onChange={(e) => setRepChallenges(e.target.value)}
                  placeholder="Equipment, logistics, or prayer needs..."
                  className="w-full p-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold">Goals for Next Week</label>
                <textarea
                  rows={2}
                  value={repNextGoals}
                  onChange={(e) => setRepNextGoals(e.target.value)}
                  placeholder="Upcoming priorities for the unit..."
                  className="w-full p-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="min-h-[42px] px-5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN REVIEW REPORT MODAL */}
      {reviewingReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-report-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between">
              <h2 id="review-report-title" className="text-sm font-bold">
                Review &amp; Leave Official Notes
              </h2>
              <button
                type="button"
                aria-label="Close review modal"
                onClick={() => setReviewingReport(null)}
                className="p-1.5 text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveReportReview} className="p-5 space-y-4">
              <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                {reviewingReport.title || reviewingReport.weekLabel} ({reviewingReport.department})
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewStatus('REVIEWED')}
                  className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold border ${
                    reviewStatus === 'REVIEWED'
                      ? 'bg-[#10B981] border-[#10B981] text-white'
                      : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151]'
                  }`}
                >
                  REVIEWED (Approved)
                </button>
                <button
                  type="button"
                  onClick={() => setReviewStatus('ARCHIVED')}
                  className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold border ${
                    reviewStatus === 'ARCHIVED'
                      ? 'bg-[#64748B] border-[#64748B] text-white'
                      : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151]'
                  }`}
                >
                  ARCHIVED
                </button>
              </div>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Write official Administrator feedback or approval notes..."
                className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingReport(null)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReview}
                  className="min-h-[40px] px-4 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
                >
                  {savingReview ? 'Saving...' : 'Save Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD SERVICE ATTENDANCE MODAL */}
      {attModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-att-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between">
              <h2 id="record-att-title" className="text-base font-bold">
                Record Service Attendance
              </h2>
              <button
                type="button"
                aria-label="Close attendance modal"
                onClick={() => setAttModalOpen(false)}
                className="p-1.5 text-[#94A3B8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAttendanceRecord} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-bold">Meeting / Service Title</label>
                <input
                  type="text"
                  required
                  value={attTitle}
                  onChange={(e) => setAttTitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold">Department / Unit</label>
                <select
                  value={attDept}
                  onChange={(e) => setAttDept(e.target.value as DepartmentType)}
                  className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-semibold"
                >
                  {ALL_DEPARTMENT_TYPES.map((dt) => (
                    <option key={dt.type} value={dt.type}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold">Males</label>
                  <input
                    type="number"
                    min={0}
                    value={attMales}
                    onChange={(e) => setAttMales(e.target.value)}
                    className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold">Females</label>
                  <input
                    type="number"
                    min={0}
                    value={attFemales}
                    onChange={(e) => setAttFemales(e.target.value)}
                    className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold">First Timers</label>
                  <input
                    type="number"
                    min={0}
                    value={attFirstTimers}
                    onChange={(e) => setAttFirstTimers(e.target.value)}
                    className="w-full min-h-[42px] px-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[#0F172A] text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold">
                <span>Total Headcount:</span>
                <span className="text-[#F59E0B] text-sm tabular-nums">{liveModalHeadcount}</span>
              </div>

              <div>
                <label className="text-xs font-bold">Observations / Notes</label>
                <textarea
                  rows={2}
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  placeholder="Optional service observations..."
                  className="w-full p-3 mt-1 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAttModalOpen(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAtt}
                  className="min-h-[42px] px-5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
                >
                  {savingAtt ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
