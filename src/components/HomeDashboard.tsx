import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  Plus,
  Sparkles,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { CHURCH_LOGO_PATH } from './ChurchLogoBadge';
import { SCRIPTURE_OF_THE_DAY_PRESETS } from '../data/bibleData';
import {
  createProgramme,
  publishDailyScripture,
  purgeExpiredEvents,
  registerForProgramme,
} from '../services/fellowshipService';
import {
  EVENT_CATEGORY_ITEMS,
  buildPassMailtoHref,
  buildProgrammeCalendarUrl,
  buildProgrammeIcsContent,
  buildReminderSchedule,
  calculateRegistrationProgress,
  canManageFellowship,
  filterActiveProgrammes,
  filterProgrammesByEventCategory,
  formatActionErrorMessage,
  formatBadgeMonthDay,
  formatProgrammeFullDateTime,
  formatRegistrantsSummary,
  formatReminderDate,
  generateOfficialPassCode,
  getDisplayNameForAccount,
  getEventCategoryLabel,
  getProgrammeDescription,
  getProgrammeLimit,
  getProgrammeRegisteredCount,
  getProgrammeRegistrations,
  getProgrammeSpeaker,
  getProgrammeStartMillis,
  getProgrammeTitle,
  getRegistrationAttendeeName,
  isUserRegisteredForProgramme,
  sortProgrammesAscending,
  type NormalizedDailyScripture,
} from '../utils/fellowshipLogic';
import type { TranslationStrings } from '../data/translations';
import type {
  EventCategory,
  FellowshipAccount,
  LanguageCode,
  Programme,
} from '../types/fellowship';

interface HomeDashboardProps {
  account: FellowshipAccount;
  dailyScripture: NormalizedDailyScripture;
  programmes: Programme[];
  language: LanguageCode;
  labels: TranslationStrings;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  account,
  dailyScripture,
  programmes,
  language,
  labels,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);
  const [showScriptureModal, setShowScriptureModal] = useState(false);
  const [showProgrammeModal, setShowProgrammeModal] = useState(false);
  const [detailProgId, setDetailProgId] = useState<string | null>(null);
  const [confirmedPassProg, setConfirmedPassProg] = useState<Programme | null>(null);
  const [busyProgId, setBusyProgId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Post Scripture Modal Form
  const [scriptRef, setScriptRef] = useState('');
  const [scriptVerse, setScriptVerse] = useState('');
  const [scriptCharge, setScriptCharge] = useState(
    'Rise as mighty Gideonites today and do Kingdom exploits!'
  );
  const [postingScripture, setPostingScripture] = useState(false);

  // Post Upcoming Programme Modal Form
  const [progTitle, setProgTitle] = useState('');
  const [progVenue, setProgVenue] = useState('');
  const [progSpeaker, setProgSpeaker] = useState('');
  const [progCategory, setProgCategory] = useState<EventCategory>('YOUTH_SERVICE');
  const [progDaysFromNow, setProgDaysFromNow] = useState('7');
  const [progLimit, setProgLimit] = useState('100');
  const [progDesc, setProgDesc] = useState('');
  const [creatingProg, setCreatingProg] = useState(false);

  const isAdmin = account.id === 'user-admin-01' || account.role === 'ADMINISTRATOR';
  const isGuest = (account.role || '').toUpperCase() === 'GUEST';
  const isManager = canManageFellowship(account.role);
  const displayName = getDisplayNameForAccount(account);
  const resolvedUserId = account.userId || account.id;
  const greetingName = isAdmin ? 'Admin' : account.fullName || 'Kingdom Giant';

  const programmesRef = useRef<Programme[]>(programmes);
  programmesRef.current = programmes;

  useEffect(() => {
    const runPurge = () => {
      if (programmesRef.current.length > 0) {
        void purgeExpiredEvents(programmesRef.current);
      }
    };
    runPurge();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runPurge();
      }
    };

    window.addEventListener('focus', runPurge);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', runPurge);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [programmes.length]);

  const activeProgrammes = useMemo(
    () => filterActiveProgrammes(programmes),
    [programmes]
  );
  const sortedProgrammes = useMemo(
    () => sortProgrammesAscending(activeProgrammes),
    [activeProgrammes]
  );
  const filteredProgrammes = useMemo(
    () => filterProgrammesByEventCategory(sortedProgrammes, selectedCategory),
    [sortedProgrammes, selectedCategory]
  );

  // Keep detail modal live against real-time Firestore programme snapshots
  const detailProg = useMemo(
    () =>
      detailProgId ? activeProgrammes.find((p) => p.id === detailProgId) || null : null,
    [activeProgrammes, detailProgId]
  );

  const openScriptureModal = () => {
    setActionError(null);
    const ref = dailyScripture.reference || 'Judges 6:12';
    const matchingPreset = SCRIPTURE_OF_THE_DAY_PRESETS.find(
      (p) => p.reference.toLowerCase() === ref.trim().toLowerCase()
    );
    setScriptRef(ref);
    setScriptVerse(matchingPreset ? matchingPreset.translations.EN : dailyScripture.verseText || '');
    setScriptCharge(
      dailyScripture.chargeText || 'Rise as mighty Gideonites today and do Kingdom exploits!'
    );
    setShowScriptureModal(true);
  };

  const handleSelectScripturePreset = (reference: string, verseEn: string) => {
    setScriptRef(reference);
    setScriptVerse(verseEn);
  };

  const handlePostScripture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptRef.trim() || !scriptVerse.trim()) return;
    setActionError(null);
    setPostingScripture(true);
    try {
      await publishDailyScripture({
        authorId: resolvedUserId,
        authorName: isAdmin ? 'Admin' : displayName,
        referenceEn: scriptRef.trim(),
        verseTextEn: scriptVerse.trim(),
        chargeText: scriptCharge.trim(),
      });
      setShowScriptureModal(false);
    } catch (err) {
      setActionError(formatActionErrorMessage(err, 'Unable to publish Scripture for the Day.'));
    } finally {
      setPostingScripture(false);
    }
  };

  const handleCreateProgramme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progTitle.trim() || !progVenue.trim()) return;
    setActionError(null);
    setCreatingProg(true);

    const days = Math.max(0, Number(progDaysFromNow) || 7);
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    targetDate.setHours(9, 0, 0, 0);

    try {
      await createProgramme({
        createdById: resolvedUserId,
        titleEn: progTitle.trim(),
        descriptionEn: progDesc.trim(),
        category: progCategory,
        venue: progVenue.trim(),
        speaker: progSpeaker.trim(),
        contactPerson: isAdmin ? 'Admin' : displayName,
        participantLimit: Math.max(0, Number(progLimit) || 100),
        startDateMillis: targetDate.getTime(),
      });
      setProgTitle('');
      setProgVenue('');
      setProgSpeaker('');
      setProgCategory('YOUTH_SERVICE');
      setProgDaysFromNow('7');
      setProgLimit('100');
      setProgDesc('');
      setShowProgrammeModal(false);
    } catch (err) {
      setActionError(formatActionErrorMessage(err, 'Unable to create upcoming programme.'));
    } finally {
      setCreatingProg(false);
    }
  };

  const handleConfirmRsvp = async (prog: Programme) => {
    if (isUserRegisteredForProgramme(prog, account)) {
      setDetailProgId(prog.id);
      return;
    }
    setActionError(null);
    setBusyProgId(prog.id);
    try {
      await registerForProgramme(prog, account);
      setDetailProgId(null);
      setConfirmedPassProg(prog);
    } catch (err) {
      setActionError(formatActionErrorMessage(err, 'Unable to confirm RSVP for this programme.'));
    } finally {
      setBusyProgId(null);
    }
  };

  const handleDownloadIcs = (prog: Programme, passCode: string) => {
    const ics = buildProgrammeIcsContent(prog, passCode);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getProgrammeTitle(prog).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-alerts.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedCategoryLabel = selectedCategory ? getEventCategoryLabel(selectedCategory) : '';

  return (
    <div className="space-y-4 pb-28">
      {actionError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-4 py-3 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center justify-between gap-3"
        >
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setActionError(null)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* A. Fellowship Hero Banner Card */}
      <section className="rounded-[22px] bg-[#0F172A] dark:bg-[#131B2E] text-white p-4 sm:p-5 border border-[#1E293B] shadow-md space-y-4">
        {/* Top Badge Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/20 text-[10px] font-extrabold tracking-wide text-[#F59E0B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" aria-hidden="true" />
            <span>THE GIDEONITES • KINGDOM GIANTS</span>
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/12 text-[10px] font-bold text-white shrink-0">
            Youth Platform
          </span>
        </div>

        {/* Greeting Row */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-full bg-white border border-[#F59E0B] flex items-center justify-center shrink-0 shadow-xs">
            <img
              src={CHURCH_LOGO_PATH}
              alt="The Gideonites Church Logo"
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs sm:text-sm font-extrabold text-[#F59E0B] leading-snug">
              The Gideonites - The Youth Alive Fellowship
            </p>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
              {labels.graceAndPeace}, {greetingName}
            </h1>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              The Gideonites - The Youth Alive Fellowship platform is ready. Explore daily
              scriptures, upcoming youth summits, retreats, and spiritual encounters.
            </p>
          </div>
        </div>

        {/* Leadership Quick Actions */}
        {isManager && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowProgrammeModal(true)}
              className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{labels.postUpcomingProgramme}</span>
            </button>
            <button
              type="button"
              onClick={openScriptureModal}
              className="min-h-[44px] px-4 rounded-xl border border-[#F59E0B] bg-transparent hover:bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{labels.postScriptureForTheDay}</span>
            </button>
          </div>
        )}
      </section>

      {/* B. Scripture for the Day Card */}
      <section className="rounded-[18px] bg-white dark:bg-[#111827] border border-[#F59E0B]/65 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-[#F59E0B]">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[#B45309] dark:text-[#F59E0B]">
              {labels.scriptureForTheDay}
            </span>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-[11px] font-bold shrink-0">
            {dailyScripture.reference} • {language}
          </span>
        </div>

        <blockquote className="text-sm sm:text-base italic font-medium text-[#0F172A] dark:text-white leading-relaxed">
          "{dailyScripture.verseText}"
        </blockquote>

        {dailyScripture.chargeText && (
          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            {dailyScripture.chargeText}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#374151]">
          <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
            The Gideonites Daily Charge • By {dailyScripture.authorName}
          </span>
          {isManager && (
            <button
              type="button"
              onClick={openScriptureModal}
              className="min-h-[36px] px-2.5 text-xs font-bold text-[#E11D48] hover:underline shrink-0"
            >
              Post / Update
            </button>
          )}
        </div>
      </section>

      {/* C. Guest Welcome Banner (Guest role only) */}
      {isGuest && (
        <section className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/20 border border-[#E11D48]/30 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E11D48] text-white flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-extrabold text-[#9F1239] dark:text-[#FECDD3]">
              Welcome, Honored Guest! 👋
            </h2>
            <p className="text-xs text-[#334155] dark:text-[#E2E8F0] leading-relaxed">
              You are warmly invited to attend our youth gatherings, praise nights & spiritual
              summits. Feel free to RSVP for any programme!
            </p>
          </div>
        </section>
      )}

      {/* D. Upcoming Youth Programmes Header & Category Filter Bar */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xs sm:text-sm font-extrabold tracking-wide text-[#0F172A] dark:text-white uppercase">
            {labels.upcomingProgrammes}
          </h2>
          {isManager ? (
            <button
              type="button"
              onClick={() => setShowProgrammeModal(true)}
              className="min-h-[36px] text-xs font-bold text-[#E11D48] hover:underline shrink-0"
            >
              {labels.postUpcomingProgramme}
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              {filteredProgrammes.length} event{filteredProgrammes.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === null
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'bg-white dark:bg-[#111827] text-[#334155] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#374151] hover:border-[#E11D48]/50'
            }`}
          >
            All Programmes
          </button>

          {EVENT_CATEGORY_ITEMS.map((cat) => {
            const active = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : 'bg-white dark:bg-[#111827] text-[#334155] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#374151] hover:border-[#E11D48]/50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* E. Programmes Feed (Sorted Ascending by startDateMillis) */}
      {filteredProgrammes.length === 0 ? (
        <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-7 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] dark:bg-[#1F2937] text-[#64748B] flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#0F172A] dark:text-white">
              {selectedCategory ? `No ${selectedCategoryLabel} Programmes` : 'No Scheduled Programmes'}
            </p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
              {isManager
                ? 'Tap "+ Schedule First Programme" to publish an upcoming youth gathering for The Gideonites.'
                : 'Check back soon or switch back to All Programmes for upcoming youth gatherings.'}
            </p>
          </div>
          {isManager && (
            <button
              type="button"
              onClick={() => setShowProgrammeModal(true)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule First Programme</span>
            </button>
          )}
        </section>
      ) : (
        <div className="space-y-3.5">
          {filteredProgrammes.map((prog) => {
            const regs = getProgrammeRegistrations(prog);
            const regCount = getProgrammeRegisteredCount(prog, regs);
            const limit = getProgrammeLimit(prog);
            const startMillis = getProgrammeStartMillis(prog);
            const { month, day } = formatBadgeMonthDay(startMillis);
            const speaker = getProgrammeSpeaker(prog);
            const isRegistered = isUserRegisteredForProgramme(prog, account);
            const { percentage, isFull } = calculateRegistrationProgress(regCount, limit);
            const regEnabled = prog.isRegistrationEnabled !== false;
            const summaryLine = formatRegistrantsSummary(regs);

            return (
              <article
                key={prog.id}
                className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 shadow-xs space-y-3.5"
              >
                {/* Top Row: 56x56 #E11D48 Date Badge + Right Content */}
                <div className="flex items-start gap-3.5">
                  <div className="w-14 h-14 rounded-xl bg-[#E11D48] text-white flex flex-col items-center justify-center shrink-0 shadow-xs">
                    <span className="text-[10px] font-bold tracking-wider uppercase leading-none">
                      {month}
                    </span>
                    <span className="font-display text-xl font-extrabold leading-tight tabular-nums mt-0.5">
                      {day}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] dark:text-[#FB7185] text-[10px] font-bold">
                      {getEventCategoryLabel(prog.category)}
                    </span>
                    <h3 className="font-display text-base font-bold text-[#0F172A] dark:text-white leading-snug line-clamp-2">
                      {getProgrammeTitle(prog)}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      <MapPin className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                      <span className="truncate">{prog.venue}</span>
                    </div>
                    {speaker && (
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        <UserCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                        <span className="truncate">Minister: {speaker}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirmed Registered Banner */}
                {isRegistered && (
                  <div className="rounded-xl bg-[#16A34A]/12 border border-[#16A34A]/30 px-3 py-2 flex items-center gap-2 text-xs font-semibold text-[#15803D] dark:text-[#4ADE80]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Registered ✓ • Event reminders enabled</span>
                  </div>
                )}

                {/* Progress Bar (6px height, #F59E0B turns #E11D48 at 100%) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    <span>Registered Attendance</span>
                    <span>
                      {limit > 0 ? `${regCount} / ${limit} registered` : `${regCount} registered`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#F1F5F9] dark:bg-[#1F2937] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        limit > 0 && percentage >= 100 ? 'bg-[#E11D48]' : 'bg-[#F59E0B]'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {summaryLine && (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {summaryLine}
                    </p>
                  )}
                </div>

                {/* Action Row */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setDetailProgId(prog.id)}
                    className="flex-1 min-h-[44px] px-4 rounded-xl border border-[#E2E8F0] dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:bg-[#F1F5F9] dark:hover:bg-[#374151] text-xs font-bold text-[#0F172A] dark:text-white transition-colors"
                  >
                    Details
                  </button>

                  {isRegistered ? (
                    <button
                      type="button"
                      onClick={() => setDetailProgId(prog.id)}
                      className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#16A34A]/15 border border-[#16A34A]/40 text-xs font-bold text-[#15803D] dark:text-[#4ADE80] flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{labels.registeredPass}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyProgId === prog.id || isFull || !regEnabled}
                      onClick={() => handleConfirmRsvp(prog)}
                      className={`flex-1 min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        isFull || !regEnabled
                          ? 'bg-[#F1F5F9] dark:bg-[#1F2937] text-[#64748B] cursor-not-allowed'
                          : 'bg-[#E11D48] hover:bg-[#9F1239] text-white'
                      }`}
                    >
                      {busyProgId === prog.id
                        ? 'Confirming...'
                        : isFull
                        ? 'Capacity Reached'
                        : !regEnabled
                        ? 'Registration Closed'
                        : labels.registerRsvp}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating + Pill FAB for Leadership */}
      {isManager && (
        <button
          type="button"
          onClick={() => setShowProgrammeModal(true)}
          aria-label="Post Upcoming Programme"
          className="fixed bottom-20 right-4 sm:right-6 z-20 inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-lg transition-transform active:scale-95"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Post Scripture for the Day Modal (Leadership Only) */}
      {showScriptureModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-scripture-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <form
            onSubmit={handlePostScripture}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3.5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 id="post-scripture-title" className="text-base font-bold text-[#0F172A] dark:text-white">
                Post Scripture for the Day
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowScriptureModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div
                role="alert"
                className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
              >
                {actionError}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">
                Quick Youth Presets
              </p>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {SCRIPTURE_OF_THE_DAY_PRESETS.map((preset) => (
                  <button
                    key={preset.reference}
                    type="button"
                    onClick={() =>
                      handleSelectScripturePreset(preset.reference, preset.translations.EN)
                    }
                    className={`min-h-[34px] px-3 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                      scriptRef.trim().toLowerCase() === preset.reference.toLowerCase()
                        ? 'bg-[#F59E0B] text-[#0F172A]'
                        : 'bg-[#F1F5F9] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {preset.reference}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Scripture Reference *
              </label>
              <input
                type="text"
                required
                value={scriptRef}
                onChange={(e) => setScriptRef(e.target.value)}
                placeholder="e.g., Judges 6:12"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Scripture Verse Text *
              </label>
              <textarea
                rows={3}
                required
                value={scriptVerse}
                onChange={(e) => setScriptVerse(e.target.value)}
                placeholder="The LORD is with thee, thou mighty man of valour."
                className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Gideonites Youth Charge / Meditation
              </label>
              <textarea
                rows={2}
                value={scriptCharge}
                onChange={(e) => setScriptCharge(e.target.value)}
                placeholder="Rise as mighty Gideonites today and do Kingdom exploits!"
                className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={postingScripture}
              className="w-full min-h-[46px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-sm font-bold transition-colors"
            >
              {postingScripture ? 'Publishing...' : 'Publish Scripture for the Day'}
            </button>
          </form>
        </div>
      )}

      {/* Post Upcoming Youth Programme Modal (Leadership Only) */}
      {showProgrammeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-prog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <form
            onSubmit={handleCreateProgramme}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 id="create-prog-title" className="text-base font-bold text-[#0F172A] dark:text-white">
                Post Upcoming Youth Programme
              </h3>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowProgrammeModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div
                role="alert"
                className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
              >
                {actionError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Programme Title *
              </label>
              <input
                type="text"
                required
                value={progTitle}
                onChange={(e) => setProgTitle(e.target.value)}
                placeholder="e.g., Kingdom Giants Annual Summit"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Venue / Location *
              </label>
              <input
                type="text"
                required
                value={progVenue}
                onChange={(e) => setProgVenue(e.target.value)}
                placeholder="e.g., Youth Alive Main Sanctuary"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Minister / Speaker
              </label>
              <input
                type="text"
                value={progSpeaker}
                onChange={(e) => setProgSpeaker(e.target.value)}
                placeholder="e.g., Pastor Tunde Adeyemi"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Programme Category
              </label>
              <select
                value={progCategory}
                onChange={(e) => setProgCategory(e.target.value as EventCategory)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              >
                {EVENT_CATEGORY_ITEMS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                  Days from now
                </label>
                <input
                  type="number"
                  min={0}
                  value={progDaysFromNow}
                  onChange={(e) => setProgDaysFromNow(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                  Capacity limit
                </label>
                <input
                  type="number"
                  min={0}
                  value={progLimit}
                  onChange={(e) => setProgLimit(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#334155] dark:text-[#CBD5E1]">
                Description & Agenda
              </label>
              <textarea
                rows={3}
                value={progDesc}
                onChange={(e) => setProgDesc(e.target.value)}
                placeholder="Programme schedule, dress code, or special prayer focus..."
                className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={creatingProg}
              className="w-full min-h-[46px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-sm font-bold transition-colors"
            >
              {creatingProg ? 'Publishing...' : 'Publish Programme'}
            </button>
          </form>
        </div>
      )}

      {/* Programme Detail Modal */}
      {detailProg && (() => {
        const regs = getProgrammeRegistrations(detailProg);
        const regCount = getProgrammeRegisteredCount(detailProg, regs);
        const limit = getProgrammeLimit(detailProg);
        const startMillis = getProgrammeStartMillis(detailProg);
        const speaker = getProgrammeSpeaker(detailProg);
        const desc = getProgrammeDescription(detailProg);
        const isRegistered = isUserRegisteredForProgramme(detailProg, account);
        const { fiveDaysBefore, oneDayBefore } = buildReminderSchedule(startMillis);
        const passCode = generateOfficialPassCode(detailProg.id, resolvedUserId);
        const isFull = limit > 0 && regCount >= limit;
        const regEnabled = detailProg.isRegistrationEnabled !== false;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="programme-detail-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          >
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] dark:text-[#FB7185] text-[11px] font-bold">
                    {getEventCategoryLabel(detailProg.category)}
                  </span>
                  <h3 id="programme-detail-title" className="font-display text-lg font-extrabold text-[#0F172A] dark:text-white">
                    {getProgrammeTitle(detailProg)}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close programme details"
                  onClick={() => setDetailProgId(null)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#64748B]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-[#334155] dark:text-[#CBD5E1]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#E11D48] shrink-0" />
                  <span className="font-semibold">{formatProgrammeFullDateTime(startMillis)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  <span>{detailProg.venue}</span>
                </div>
                {speaker && (
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span>
                      <strong>Speaker/Minister:</strong> {speaker}
                    </span>
                  </div>
                )}
              </div>

              {desc && (
                <div className="space-y-1 pt-2 border-t border-[#E2E8F0] dark:border-[#374151]">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                    About this Programme:
                  </p>
                  <p className="text-xs text-[#475569] dark:text-[#CBD5E1] whitespace-pre-wrap leading-relaxed">
                    {desc}
                  </p>
                </div>
              )}

              {/* Registered Participants */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0] dark:border-[#374151]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Users className="w-4 h-4 text-[#E11D48]" />
                  <span>
                    Registered Participants ({limit > 0 ? `${regCount} / ${limit}` : regCount})
                  </span>
                </div>
                {regs.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Be the first to RSVP for this upcoming youth gathering.
                  </p>
                ) : (
                  <ol className="space-y-1 max-h-36 overflow-y-auto rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] p-3 text-xs">
                    {regs.map((r, idx) => (
                      <li key={r.id || `${r.userId}-${idx}`} className="flex items-center justify-between gap-2">
                        <span className="text-[#0F172A] dark:text-white font-medium">
                          {idx + 1}. {getRegistrationAttendeeName(r)}
                        </span>
                        <span className="text-[#16A34A] font-bold">✓</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Confirmation & Reminder Schedule Box */}
              <div className="rounded-xl bg-[#FEF3C7]/45 dark:bg-[#F59E0B]/10 border border-[#F59E0B]/40 p-3 space-y-1.5">
                <p className="text-xs font-extrabold text-[#92400E] dark:text-[#FCD34D]">
                  📧 Confirmation & Reminder Schedule
                </p>
                <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                  • 5 Days Before: <strong>{formatReminderDate(fiveDaysBefore)}</strong>
                </p>
                <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                  • 1 Day Before: <strong>{formatReminderDate(oneDayBefore)}</strong>
                </p>
              </div>

              {detailProg.contactPerson && (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Contact Coordinator: <strong className="text-[#0F172A] dark:text-white">{detailProg.contactPerson}</strong>
                </p>
              )}

              {/* Actions */}
              {isRegistered ? (
                <div className="space-y-2.5 pt-1">
                  <div className="w-full min-h-[42px] rounded-xl bg-[#16A34A]/15 border border-[#16A34A]/40 text-[#15803D] dark:text-[#4ADE80] text-xs font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Registered ✓ (Confirmed)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href={buildPassMailtoHref(detailProg, greetingName, account.email, passCode)}
                      className="min-h-[44px] px-3 rounded-xl border border-[#E2E8F0] dark:border-[#374151] text-xs font-bold text-[#0F172A] dark:text-white flex items-center justify-center gap-1.5 hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937]"
                    >
                      <Mail className="w-4 h-4 text-[#E11D48]" />
                      <span>Email My Pass</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(detailProg, passCode)}
                      className="min-h-[44px] px-3 rounded-xl bg-[#0F172A] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#1E293B]"
                    >
                      <CalendarPlus className="w-4 h-4 text-[#F59E0B]" />
                      <span>Add Calendar Alert</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busyProgId === detailProg.id || isFull || !regEnabled}
                  onClick={() => handleConfirmRsvp(detailProg)}
                  className={`w-full min-h-[46px] rounded-xl text-sm font-bold transition-colors ${
                    isFull || !regEnabled
                      ? 'bg-[#F1F5F9] dark:bg-[#1F2937] text-[#64748B] cursor-not-allowed'
                      : 'bg-[#E11D48] hover:bg-[#9F1239] text-white'
                  }`}
                >
                  {busyProgId === detailProg.id
                    ? 'Confirming RSVP...'
                    : isFull
                    ? 'Capacity Reached'
                    : !regEnabled
                    ? 'Registration Closed'
                    : labels.registerNow}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Registration Confirmed Digital Pass Modal */}
      {confirmedPassProg && (() => {
        const startMillis = getProgrammeStartMillis(confirmedPassProg);
        const passCode = generateOfficialPassCode(confirmedPassProg.id, resolvedUserId);

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsvp-confirmed-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          >
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#16A34A]">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 id="rsvp-confirmed-title" className="text-base font-extrabold text-[#0F172A] dark:text-white">
                    Registration Confirmed!
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close pass modal"
                  onClick={() => setConfirmedPassProg(null)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#64748B]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dark #0F172A Digital Pass Ticket */}
              <div className="rounded-2xl bg-[#0F172A] text-white border-2 border-[#F59E0B] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold tracking-wider text-[#F59E0B]">
                    OFFICIAL PROGRAMME PASS
                  </span>
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-[#F59E0B] text-[#0F172A]">
                    {passCode}
                  </span>
                </div>
                <h4 className="font-display text-base font-extrabold text-white">
                  {getProgrammeTitle(confirmedPassProg)}
                </h4>
                <div className="text-xs text-[#CBD5E1] space-y-1">
                  <p>{formatProgrammeFullDateTime(startMillis)}</p>
                  <p>{confirmedPassProg.venue}</p>
                </div>
                <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] text-[#94A3B8] uppercase">Attendee</p>
                    <p className="font-bold text-white">{greetingName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#94A3B8] uppercase">Email</p>
                    <p className="font-medium text-[#E2E8F0]">{account.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <a
                  href={buildPassMailtoHref(confirmedPassProg, greetingName, account.email, passCode)}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-[#F59E0B]" />
                  <span>Send Confirmation Pass</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleDownloadIcs(confirmedPassProg, passCode)}
                  className="w-full min-h-[44px] px-4 rounded-xl border border-[#F59E0B] text-[#92400E] dark:text-[#FCD34D] bg-[#FEF3C7]/40 dark:bg-[#F59E0B]/15 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>Add 5-Day & 1-Day Alerts to Calendar</span>
                </button>

                <a
                  href={buildProgrammeCalendarUrl(confirmedPassProg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[40px] px-4 rounded-xl text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] flex items-center justify-center gap-1.5 hover:underline"
                >
                  <span>Open in Google Calendar</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => setConfirmedPassProg(null)}
                  className="w-full min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
