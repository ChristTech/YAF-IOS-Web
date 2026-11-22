import React from 'react';
import { BookOpen, Gamepad2, Home, User, Users } from 'lucide-react';
import type { MainTab } from '../types/fellowship';
import type { TranslationStrings } from '../data/translations';

interface BottomNavProps {
  activeTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
  labels: TranslationStrings['tabs'];
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, labels }) => {
  const items: { id: MainTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: labels.home, icon: Home },
    { id: 'community', label: labels.community, icon: Users },
    { id: 'games', label: labels.games, icon: Gamepad2 },
    { id: 'spiritual', label: labels.spiritual, icon: BookOpen },
    { id: 'profile', label: labels.profile, icon: User },
  ];

  return (
    <nav
      aria-label="Primary bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-[#E2E8F0] dark:border-[#374151] pb-safe"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-5 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-1 transition-colors ${
                isActive
                  ? 'text-[#E11D48]'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#E11D48]"
                />
              )}
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
