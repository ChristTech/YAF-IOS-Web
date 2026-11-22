import React, { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ForumWorkspace } from './community/ForumWorkspace';
import { ExecutiveContactWorkspace } from './community/ExecutiveContactWorkspace';
import { UnitsWorkspace } from './community/UnitsWorkspace';
import {
  canManageFellowship,
  filterAndSortForumPosts,
  normalizeInquiryStatus,
} from '../utils/fellowshipLogic';
import type { TranslationStrings } from '../data/translations';
import type {
  AttendanceRecord,
  CommunityPost,
  ExecutiveInquiry,
  FellowshipAccount,
  WeeklyReport,
} from '../types/fellowship';

interface CommunityTabProps {
  account: FellowshipAccount;
  accounts: FellowshipAccount[];
  posts: CommunityPost[];
  inquiries: ExecutiveInquiry[];
  attendanceRecords: AttendanceRecord[];
  weeklyReports: WeeklyReport[];
  labels: TranslationStrings;
  onAccountUpdated: (updated: FellowshipAccount) => void;
  onMemberDepartmentAssigned?: (accountId: string, department: string) => void;
}

export const CommunityTab: React.FC<CommunityTabProps> = ({
  account,
  accounts,
  posts,
  inquiries,
  attendanceRecords,
  weeklyReports,
  labels,
  onMemberDepartmentAssigned,
}) => {
  const [secondaryTab, setSecondaryTab] = useState<'forum' | 'units'>('forum');
  const [forumInnerTab, setForumInnerTab] = useState<'youth_forum' | 'executive_contact'>('youth_forum');
  const [communityError, setCommunityError] = useState<string | null>(null);

  const isLeadership = canManageFellowship(account.role);

  const flaggedPostsCount = useMemo(() => {
    const active = filterAndSortForumPosts(posts, {
      filterChip: 'All',
      isLeadership,
    });
    return active.filter((p) => p.isFlagged === true).length;
  }, [posts, isLeadership]);

  const pendingInquiriesCount = useMemo(
    () =>
      inquiries.filter((inq) => {
        const s = normalizeInquiryStatus(inq.status);
        return s === 'PENDING' || s === 'IN_PROGRESS';
      }).length,
    [inquiries]
  );

  return (
    <div className="space-y-4 pb-28">
      {/* Sticky Top-Level Secondary Tab Bar: Forum / Units */}
      <div
        role="tablist"
        aria-label="Community hub sections"
        className="sticky top-[60px] z-20 -mx-3 sm:-mx-4 -mt-4 px-3 sm:px-4 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#374151]"
      >
        <div className="grid grid-cols-2">
          <button
            type="button"
            role="tab"
            aria-selected={secondaryTab === 'forum'}
            onClick={() => setSecondaryTab('forum')}
            className={`min-h-[46px] text-xs sm:text-sm font-extrabold border-b-2 ${
              secondaryTab === 'forum'
                ? 'border-[#E11D48] text-[#E11D48]'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {labels.subTabs.communityForum}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={secondaryTab === 'units'}
            onClick={() => setSecondaryTab('units')}
            className={`min-h-[46px] text-xs sm:text-sm font-extrabold border-b-2 ${
              secondaryTab === 'units'
                ? 'border-[#E11D48] text-[#E11D48]'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {labels.subTabs.communityUnits}
          </button>
        </div>
      </div>

      {communityError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-4 py-3 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#E11D48]" />
            <span>{communityError}</span>
          </span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setCommunityError(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sub-Tab 0: Forum Workspace */}
      {secondaryTab === 'forum' ? (
        <div className="space-y-4">
          {/* Primary Inner Tab Bar: Youth Forum / Executive Contact */}
          <div
            role="tablist"
            aria-label="Forum workspace tabs"
            className="grid grid-cols-2 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] rounded-2xl p-1.5 gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={forumInnerTab === 'youth_forum'}
              onClick={() => setForumInnerTab('youth_forum')}
              className={`min-h-[42px] px-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 ${
                forumInnerTab === 'youth_forum'
                  ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              <span>Youth Forum</span>
              {isLeadership && flaggedPostsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#E11D48] text-white text-[10px] font-extrabold tabular-nums">
                  {flaggedPostsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={forumInnerTab === 'executive_contact'}
              onClick={() => setForumInnerTab('executive_contact')}
              className={`min-h-[42px] px-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 ${
                forumInnerTab === 'executive_contact'
                  ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              <span>Executive Contact</span>
              {isLeadership && pendingInquiriesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-[#0F172A] text-[10px] font-extrabold tabular-nums">
                  {pendingInquiriesCount}
                </span>
              )}
            </button>
          </div>

          {forumInnerTab === 'youth_forum' ? (
            <ForumWorkspace
              account={account}
              posts={posts}
              isLeadership={isLeadership}
              onError={setCommunityError}
            />
          ) : (
            <ExecutiveContactWorkspace
              account={account}
              inquiries={inquiries}
              isLeadership={isLeadership}
              onError={setCommunityError}
            />
          )}
        </div>
      ) : (
        /* Sub-Tab 1: Units Workspace */
        <UnitsWorkspace
          account={account}
          accounts={accounts}
          attendanceRecords={attendanceRecords}
          weeklyReports={weeklyReports}
          labels={labels}
          onMemberDepartmentAssigned={onMemberDepartmentAssigned}
          onError={setCommunityError}
        />
      )}
    </div>
  );
};
