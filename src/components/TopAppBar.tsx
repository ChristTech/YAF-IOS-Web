import React from 'react';
import { Bell, Megaphone, Moon, Sun } from 'lucide-react';
import { ChurchLogoBadge } from './ChurchLogoBadge';
import { PWAInstallButton } from './PWAInstallUI';
import { LANGUAGE_PILL_LABEL } from '../data/translations';
import { getDisplayNameForAccount, getRoleLabel } from '../utils/fellowshipLogic';
import type { FellowshipAccount, LanguageCode } from '../types/fellowship';

interface TopAppBarProps {
  account: FellowshipAccount;
  language: LanguageCode;
  onCycleLanguage: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  unreadNotifications: number;
  onOpenAnnouncements: () => void;
  onOpenNotifications: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  account,
  language,
  onCycleLanguage,
  isDark,
  onToggleTheme,
  unreadNotifications,
  onOpenAnnouncements,
  onOpenNotifications,
}) => {
  const isAdmin = account.id === 'user-admin-01' || account.role === 'ADMINISTRATOR';
  const roleLabel = getRoleLabel(account.role);
  const displayName = getDisplayNameForAccount(account);
  const subtitle = isAdmin ? 'Admin' : `${roleLabel} • ${displayName}`;
  const upperRole = (account.role || '').toUpperCase();

  const roleBadgeClass =
    upperRole === 'ADMINISTRATOR'
      ? 'bg-[#F59E0B] text-[#0F172A]'
      : upperRole.includes('EXECUTIVE')
      ? 'bg-[#E11D48] text-white'
      : upperRole === 'MEMBER'
      ? 'bg-[#1E293B] text-[#F8FAFC] border border-[#334155]'
      : 'bg-[#334155] text-[#CBD5E1]';

  return (
    <header className="sticky top-0 z-30 bg-[#0F172A] text-white border-b border-[#1E293B] pt-safe">
      <div className="max-w-3xl mx-auto px-2.5 sm:px-4 min-h-[60px] flex items-center justify-between gap-2">
        {/* Left: 36x36 white rounded-10px logo badge + stacked title + translucent role/name pill */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ChurchLogoBadge size={36} variant="rounded-square" />
          <div className="min-w-0 flex flex-col items-start gap-0.5">
            <div className="font-display text-[11px] sm:text-xs font-extrabold tracking-tight text-white truncate max-w-full">
              <span className="sm:hidden">THE GIDEONITES</span>
              <span className="hidden sm:inline">THE GIDEONITES - YOUTH ALIVE</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/12 text-[10px] font-semibold text-white/90 truncate max-w-full">
              {subtitle}
            </span>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAnnouncements}
            aria-label="Open Fellowship Announcements"
            className="min-h-[44px] min-w-[40px] sm:min-w-[44px] rounded-xl hover:bg-[#1E293B] flex items-center justify-center text-[#F8FAFC] transition-colors"
          >
            <Megaphone className="w-[17px] h-[17px] text-[#F59E0B]" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={`Open Notification Center (${unreadNotifications} unread)`}
            className="relative min-h-[44px] min-w-[40px] sm:min-w-[44px] rounded-xl hover:bg-[#1E293B] flex items-center justify-center text-[#F8FAFC] transition-colors"
          >
            <Bell className="w-[17px] h-[17px]" />
            {unreadNotifications > 0 && (
              <span className="absolute top-2 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F59E0B] text-[#0F172A] text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onCycleLanguage}
            aria-label="Switch fellowship language"
            className="min-h-[34px] px-2 sm:px-2.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/15 text-[10px] sm:text-[11px] font-bold text-white whitespace-nowrap shrink-0 transition-colors"
          >
            {LANGUAGE_PILL_LABEL[language]}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-h-[44px] min-w-[40px] sm:min-w-[44px] rounded-xl hover:bg-[#1E293B] flex items-center justify-center text-[#F8FAFC] transition-colors"
          >
            {isDark ? <Sun className="w-[17px] h-[17px] text-[#F59E0B]" /> : <Moon className="w-[17px] h-[17px]" />}
          </button>

          <span
            className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${roleBadgeClass}`}
          >
            {roleLabel}
          </span>

          <div className="hidden md:block">
            <PWAInstallButton />
          </div>
        </div>
      </div>
    </header>
  );
};
