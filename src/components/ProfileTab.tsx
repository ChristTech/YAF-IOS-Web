import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Edit3,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { UserAvatar } from './ChurchLogoBadge';
import { CommandCentre } from './CommandCentre';
import { EditProfileDialog } from './profile/EditProfileDialog';
import { GivingWorkspace } from './profile/GivingWorkspace';
import { IOSInstallBanner, PWAInstallButton } from './PWAInstallUI';
import {
  logAuditTrail,
  setExecutiveAccountStatus,
  signOutAccount,
  upgradeGuestToMember,
} from '../services/fellowshipService';
import {
  canManageFellowship,
  formatActionErrorMessage,
  getDepartmentDisplayName,
  getDisplayNameForAccount,
  getRoleLabel,
  isAdministratorRole,
  isPendingApprovalStatus,
} from '../utils/fellowshipLogic';
import type { TranslationStrings } from '../data/translations';
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

interface ProfileTabProps {
  account: FellowshipAccount;
  accounts: FellowshipAccount[];
  programmes: Programme[];
  posts: CommunityPost[];
  spiritualResources: SpiritualResource[];
  uploadedBibles: UploadedBibleDoc[];
  givingRecords: GivingRecord[];
  attendanceRecords: AttendanceRecord[];
  auditLogs: AuditLogEntry[];
  isDark: boolean;
  onToggleTheme: () => void;
  labels: TranslationStrings;
  onSignedOut: () => void;
  onAccountUpdated: (updated: FellowshipAccount) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  account,
  accounts,
  programmes,
  posts,
  spiritualResources,
  uploadedBibles,
  givingRecords,
  attendanceRecords,
  auditLogs,
  isDark,
  onToggleTheme,
  labels,
  onSignedOut,
  onAccountUpdated,
}) => {
  const isManager = canManageFellowship(account.role);
  const isAdmin = account.id === 'user-admin-01' || isAdministratorRole(account.role);
  const isGuest = String(account.role || '').toUpperCase() === 'GUEST';
  const displayName = getDisplayNameForAccount(account);

  const [subTab, setSubTab] = useState<'profile' | 'giving' | 'command'>('profile');
  const [showEditModal, setShowEditModal] = useState(false);
  const [upgradingGuest, setUpgradingGuest] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Auto-reset guard: if role changes to non-leadership while on Command Centre, reset to My Profile
  useEffect(() => {
    if (!isManager && subTab === 'command') {
      setSubTab('profile');
    }
  }, [isManager, subTab]);

  const pendingExecutives = useMemo(
    () =>
      accounts.filter(
        (a) =>
          (a.role === 'EXECUTIVE' || a.role === 'YOUTH_EXECUTIVE') &&
          isPendingApprovalStatus(a.status)
      ),
    [accounts]
  );

  const handleUpgradeGuest = async () => {
    setProfileError(null);
    setUpgradingGuest(true);
    try {
      const updated = await upgradeGuestToMember(account);
      await logAuditTrail({
        actorName: displayName,
        actorRole: 'YOUTH_MEMBER',
        action: 'GUEST_UPGRADE_TO_MEMBER',
        actionType: 'GUEST_UPGRADE_TO_MEMBER',
        target: account.email,
        targetEntity: account.id,
        details: `${displayName} upgraded from Guest to Youth Member`,
      });
      onAccountUpdated(updated);
      showToast('Switched persona to Member');
    } catch (err) {
      setProfileError(formatActionErrorMessage(err, 'Unable to upgrade guest membership.'));
    } finally {
      setUpgradingGuest(false);
    }
  };

  const handleExecutiveApproval = async (
    exec: FellowshipAccount,
    decision: 'APPROVED' | 'SUSPENDED'
  ) => {
    setProfileError(null);
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
      showToast(
        decision === 'APPROVED'
          ? 'Executive registration approved by Admin.'
          : 'Executive registration declined.'
      );
    } catch (err) {
      setProfileError(formatActionErrorMessage(err, 'Unable to update executive registration.'));
    }
  };

  const handleSignOut = async () => {
    await logAuditTrail({
      actorName: displayName,
      actorRole: account.role,
      action: 'USER_LOGOUT',
      actionType: 'USER_LOGOUT',
      target: account.email,
      targetEntity: account.id,
      details: `${displayName} signed out`,
    }).catch(() => {});
    await signOutAccount();
    onSignedOut();
  };

  const getRoleBadgeClasses = () => {
    if (isAdmin) return 'bg-[#F59E0B] text-[#0F172A]';
    if (isManager) return 'bg-[#E11D48] text-white';
    if (isGuest) return 'bg-[#64748B] text-white';
    return 'bg-[#D1FAE5] text-[#065F46] dark:bg-[#10B981]/20 dark:text-[#34D399]';
  };

  const resolvedPhone = (account.phone || account.phoneNumber || '').trim();
  const resolvedDepartment = getDepartmentDisplayName(account.department);
  const resolvedAddress = (account.address || '').trim();

  return (
    <div className="space-y-5 pb-28">
      {/* Sticky Localized Secondary Tab Bar */}
      <div
        role="tablist"
        aria-label="Profile hub sections"
        className="sticky top-[60px] z-20 -mx-3 sm:-mx-4 -mt-4 px-3 sm:px-4 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#374151]"
      >
        <div className={`grid ${isManager ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'profile'}
            onClick={() => setSubTab('profile')}
            className={`min-h-[46px] px-2 text-xs sm:text-sm font-extrabold border-b-2 whitespace-nowrap ${
              subTab === 'profile'
                ? 'border-[#E11D48] text-[#E11D48]'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {labels.subTabs.myProfile}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'giving'}
            onClick={() => setSubTab('giving')}
            className={`min-h-[46px] px-2 text-xs sm:text-sm font-extrabold border-b-2 whitespace-nowrap ${
              subTab === 'giving'
                ? 'border-[#E11D48] text-[#E11D48]'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {labels.subTabs.givingPledges}
          </button>
          {isManager && (
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'command'}
              onClick={() => setSubTab('command')}
              className={`min-h-[46px] px-2 text-xs sm:text-sm font-extrabold border-b-2 whitespace-nowrap ${
                subTab === 'command'
                  ? 'border-[#E11D48] text-[#E11D48]'
                  : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {labels.subTabs.commandCentre}
            </button>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)] rounded-2xl bg-[#0F172A] text-white border border-[#F59E0B] px-4 py-3 text-xs font-bold shadow-2xl flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </span>
          <button
            type="button"
            aria-label="Dismiss notification toast"
            onClick={() => setToastMessage(null)}
            className="p-1 text-[#94A3B8] hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {profileError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-4 py-3 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center justify-between gap-3"
        >
          <span>{profileError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setProfileError(null)}
            className="p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SUB-TAB 0: MY PROFILE */}
      {subTab === 'profile' && (
        <div className="space-y-4">
          {/* 1. Profile Header Card */}
          <section className="rounded-3xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col items-center text-center space-y-2.5">
              <UserAvatar account={account} size={80} />
              <div className="space-y-1">
                <h2 className="font-display text-xl font-extrabold text-[#0F172A] dark:text-white">
                  {displayName}
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
                  {account.email}
                </p>
                <div className="pt-0.5">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${getRoleBadgeClasses()}`}
                  >
                    {getRoleLabel(account.role)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="min-h-[44px] px-4 rounded-xl border border-[#CBD5E1] dark:border-[#374151] bg-white dark:bg-[#1F2937] hover:border-[#0F172A] dark:hover:border-[#94A3B8] text-[#0F172A] dark:text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>{isAdmin ? 'Edit Admin Info' : 'Edit Profile'}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>{labels.signOut || 'Sign Out'}</span>
              </button>
            </div>
          </section>

          {/* 2. Guest Membership Upgrade Card (GUEST ONLY) */}
          {isGuest && (
            <section className="rounded-2xl bg-[#FFFBEB] dark:bg-[#111827] border-2 border-[#F59E0B] p-5 space-y-3 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B] text-[#0F172A] flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                    Become a Kingdom Giant!
                  </h3>
                  <p className="text-xs font-bold text-[#D97706] dark:text-[#F59E0B]">
                    Step into active youth fellowship &amp; ministry
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                Upgrade your guest access to full Member status to join service units, attend cell fellowships, track Bible quiz XP leaderboards, and build lasting Kingdom friendships.
              </p>
              <button
                type="button"
                disabled={upgradingGuest}
                onClick={handleUpgradeGuest}
                className="w-full min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs sm:text-sm font-bold disabled:opacity-60"
              >
                {upgradingGuest ? 'Upgrading Membership...' : 'Upgrade to Full Member'}
              </button>
            </section>
          )}

          {/* 3. Account / Unit Details Card */}
          <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3.5">
            <div className="flex items-center gap-2.5">
              {isAdmin ? (
                <Shield className="w-5 h-5 text-[#F59E0B]" />
              ) : (
                <Users className="w-5 h-5 text-[#E11D48]" />
              )}
              <h3 className="font-display text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                {isAdmin ? 'System Administration Account' : 'Fellowship & Ministry Unit Details'}
              </h3>
            </div>

            {isAdmin ? (
              <dl className="divide-y divide-[#F1F5F9] dark:divide-[#1F2937] text-xs sm:text-sm">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Account Identity</dt>
                  <dd className="font-bold text-right text-[#0F172A] dark:text-white">
                    Official Fellowship System Account
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Access Scope</dt>
                  <dd className="font-bold text-right text-[#10B981]">
                    Full Platform &amp; Cloud Oversight
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Official Contact Line</dt>
                  <dd className="font-bold text-right text-[#0F172A] dark:text-white">
                    {resolvedPhone || '+2348011223344'}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Secretariat / Office</dt>
                  <dd className="font-bold text-right text-[#0F172A] dark:text-white">
                    {resolvedAddress || 'Living Faith Church Youth Alive Fellowship Secretariat'}
                  </dd>
                </div>
              </dl>
            ) : (
              <dl className="divide-y divide-[#F1F5F9] dark:divide-[#1F2937] text-xs sm:text-sm">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Phone Number</dt>
                  <dd className="font-bold text-right text-[#0F172A] dark:text-white">
                    {resolvedPhone || 'Not specified'}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Department / Unit</dt>
                  <dd className="font-bold text-right text-[#0F172A] dark:text-white">
                    {resolvedDepartment || 'General Youth Fellowship'}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#64748B] dark:text-[#94A3B8]">Residential Address</dt>
                  <dd className="font-bold text-right text-[#0F172A] dark:text-white">
                    {resolvedAddress || 'Not specified'}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {/* 4. Admin Executive Approval Console (ADMINISTRATOR ONLY) */}
          {isAdmin && (
            <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#F59E0B]" />
                <h3 className="font-display text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                  Admin Executive Approval Console ({pendingExecutives.length} Pending)
                </h3>
              </div>

              {pendingExecutives.length === 0 ? (
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] py-2">
                  All Executive registrations have been reviewed.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {pendingExecutives.map((exec) => (
                    <div
                      key={exec.id}
                      className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar account={exec} size={46} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                            {exec.fullName}
                          </p>
                          <p className="text-xs font-semibold text-[#E11D48] dark:text-[#FB7185] truncate">
                            {getRoleLabel(exec.role)} &bull; {getDepartmentDisplayName(exec.department)}
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                            {exec.email} &bull; {exec.phone || exec.phoneNumber || 'No phone'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={`Decline ${exec.fullName}`}
                          onClick={() => handleExecutiveApproval(exec, 'SUSPENDED')}
                          className="min-h-[38px] px-3 rounded-lg border border-[#E11D48] text-[#E11D48] hover:bg-[#FFF1F2] dark:hover:bg-[#9F1239]/25 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          <span>Decline</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecutiveApproval(exec, 'APPROVED')}
                          className="min-h-[38px] px-3.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 5. Appearance Theme Card */}
          <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] flex items-center justify-center shrink-0">
                  {isDark ? (
                    <Moon className="w-5 h-5 text-[#F59E0B]" />
                  ) : (
                    <Sun className="w-5 h-5 text-[#F59E0B]" />
                  )}
                </div>
                <div>
                  <h3 className="font-display text-sm sm:text-base font-bold text-[#0F172A] dark:text-white">
                    Appearance Theme
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {isDark ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                aria-label="Toggle appearance theme"
                onClick={onToggleTheme}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                  isDark ? 'bg-[#E11D48]' : 'bg-[#CBD5E1]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                    isDark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="pt-2 border-t border-[#F1F5F9] dark:border-[#1F2937] flex items-center justify-between gap-2">
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Install Fellowship App on Home Screen
              </span>
              <PWAInstallButton />
            </div>
          </section>

          <IOSInstallBanner />
        </div>
      )}

      {/* SUB-TAB 1: GIVING & PLEDGES */}
      {subTab === 'giving' && (
        <GivingWorkspace
          account={account}
          givingRecords={givingRecords}
          onToast={showToast}
        />
      )}

      {/* SUB-TAB 2: COMMAND CENTRE (ADMINISTRATOR OR EXECUTIVE ONLY) */}
      {subTab === 'command' && isManager && (
        <CommandCentre
          account={account}
          accounts={accounts}
          programmes={programmes}
          posts={posts}
          spiritualResources={spiritualResources}
          uploadedBibles={uploadedBibles}
          givingRecords={givingRecords}
          attendanceRecords={attendanceRecords}
          auditLogs={auditLogs}
        />
      )}

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        isOpen={showEditModal}
        account={account}
        onClose={() => setShowEditModal(false)}
        onSaved={(updated) => {
          onAccountUpdated(updated);
          void logAuditTrail({
            actorName: displayName,
            actorRole: updated.role,
            action: 'PROFILE_UPDATED',
            actionType: 'PROFILE_UPDATED',
            target: updated.email,
            targetEntity: updated.id,
            details: `Updated profile details (${updated.fullName})`,
          });
        }}
        onToast={showToast}
      />
    </div>
  );
};
