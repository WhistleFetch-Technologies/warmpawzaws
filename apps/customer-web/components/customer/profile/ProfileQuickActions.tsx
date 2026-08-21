'use client';

import {
  Heart,
  LogOut,
  MapPin,
  Pencil,
  type LucideIcon,
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}

interface ProfileQuickActionsProps {
  onEditProfile: () => void;
  onManageAddress: () => void;
  onFavouritePets: () => void;
  onLogout: () => void;
}

export function ProfileQuickActions({
  onEditProfile,
  onManageAddress,
  onFavouritePets,
  onLogout,
}: ProfileQuickActionsProps) {
  const actions: QuickAction[] = [
    {
      id: 'edit',
      label: 'Edit Profile',
      icon: Pencil,
      iconBg: 'bg-orange-50',
      iconColor: 'text-[#FF8C42]',
      onClick: onEditProfile,
    },
    {
      id: 'address',
      label: 'Manage Address',
      icon: MapPin,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      onClick: onManageAddress,
    },
    {
      id: 'favourites',
      label: 'Favourite Pets',
      icon: Heart,
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-600',
      onClick: onFavouritePets,
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: LogOut,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      onClick: onLogout,
    },
  ];

  return (
    <div className="px-4 sm:px-5">
      <h2 className="mb-3 text-base font-bold text-gray-900">Quick Actions</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {actions.map(({ id, label, icon: Icon, iconBg, iconColor, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="flex min-w-[72px] shrink-0 flex-col items-center gap-2 active:scale-95"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg} shadow-sm`}
            >
              <Icon className={`h-6 w-6 ${iconColor}`} strokeWidth={2} />
            </span>
            <span className="max-w-[76px] text-center text-[10px] font-medium leading-tight text-gray-600">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
