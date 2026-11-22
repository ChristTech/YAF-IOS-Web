import React from 'react';
import type { FellowshipAccount } from '../types/fellowship';

export const CHURCH_LOGO_PATH = '/assets/aistudio/image_fe132291.png';

interface ChurchLogoBadgeProps {
  size?: number;
  variant?: 'circle' | 'rounded-square';
  className?: string;
}

export const ChurchLogoBadge: React.FC<ChurchLogoBadgeProps> = ({
  size = 40,
  variant = 'circle',
  className = '',
}) => {
  const radiusClass = variant === 'circle' ? 'rounded-full' : 'rounded-[10px]';

  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 bg-white border border-[#F59E0B] ${radiusClass} flex items-center justify-center overflow-hidden p-1 shadow-xs ${className}`}
    >
      <img
        src={CHURCH_LOGO_PATH}
        alt="The Gideonites Church Logo"
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain"
      />
    </div>
  );
};

interface UserAvatarProps {
  account: Pick<FellowshipAccount, 'id' | 'role' | 'fullName' | 'avatarUrl' | 'profilePhotoUri'>;
  size?: number;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ account, size = 40, className = '' }) => {
  const isAdmin = account.id === 'user-admin-01' || account.role === 'ADMINISTRATOR';
  const photoUri = account.profilePhotoUri || account.avatarUrl;

  if (photoUri) {
    return (
      <img
        src={photoUri}
        alt={account.fullName || (isAdmin ? 'Admin' : 'Member')}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover border ${
          isAdmin ? 'border-[#F59E0B]' : 'border-[#E2E8F0] dark:border-[#374151]'
        } ${className}`}
      />
    );
  }

  if (isAdmin) {
    return <ChurchLogoBadge size={size} variant="circle" className={className} />;
  }

  const initials = (account.fullName || 'M')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full bg-[#0F172A] text-white border border-[#F59E0B]/60 flex items-center justify-center font-display font-bold text-xs ${className}`}
    >
      {initials || 'G'}
    </div>
  );
};
