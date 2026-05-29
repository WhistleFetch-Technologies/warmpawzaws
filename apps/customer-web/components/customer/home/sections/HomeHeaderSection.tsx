'use client';

import React, { memo, useEffect, useState } from 'react';
import { Bell, Heart, MapPin, MessageSquare } from 'lucide-react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { resolveCustomerLocation } from '@/lib/customer-location';
import { WalletIcon } from '../../WalletIcon';
import { IconBadgeButton } from '../shared/IconBadgeButton';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface HomeHeaderSectionProps {
  userName: string;
  userProfilePhoto?: string;
  phone: string;
  onProfileClick?: () => void;
  onNavigate: HomeNavigateFn;
  onOpenNotifications: () => void;
  notificationUnreadCount: number;
  combinedMessageUnreadCount: number;
}

function HomeHeaderSectionComponent({
  userName,
  userProfilePhoto,
  phone,
  onProfileClick,
  onNavigate,
  onOpenNotifications,
  notificationUnreadCount,
  combinedMessageUnreadCount,
}: HomeHeaderSectionProps) {
  const initial = userName.charAt(0).toUpperCase();
  const [locationLabel, setLocationLabel] = useState('');

  useEffect(() => {
    if (!phone) {
      setLocationLabel('');
      return;
    }
    let cancelled = false;
    void resolveCustomerLocation(phone).then((loc) => {
      if (cancelled) return;
      const { city, state } = loc;
      if (city && state) setLocationLabel(`${city}, ${state}`);
      else if (city) setLocationLabel(city);
      else if (state) setLocationLabel(state);
      else setLocationLabel('Set your location');
    });
    return () => {
      cancelled = true;
    };
  }, [phone]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => onProfileClick?.()}
            className="w-12 h-12 shrink-0 bg-white rounded-2xl flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/60 transition-all shadow-md"
            aria-label="Open profile"
          >
            {userProfilePhoto ? (
              <PresignableImage
                src={userProfilePhoto}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-bold">
                {initial}
              </div>
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="min-w-0 truncate text-white text-xl font-bold tracking-tight">
                Hi, {userName}!
              </h1>
              <span className="shrink-0 text-lg" role="img" aria-label="wave">
                👋
              </span>
            </div>
            <p className="truncate text-white/70 text-xs font-medium tracking-wide">
              Everything your pet needs, in one place
            </p>
            {locationLabel ? (
              <button
                type="button"
                onClick={() => onProfileClick?.()}
                className="mt-0.5 flex min-w-0 max-w-full items-center gap-1 text-left active:opacity-80"
                aria-label={`Location: ${locationLabel}. Open profile to update.`}
              >
                <MapPin className="h-3 w-3 shrink-0 text-white/75" aria-hidden />
                <span className="truncate text-[11px] font-medium text-white/80">{locationLabel}</span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <WalletIcon
            customerPhone={phone}
            onClick={() => onNavigate('wallet')}
            size="sm"
            showBalance={true}
          />
          <IconBadgeButton
            icon={MessageSquare}
            onClick={() => onNavigate('booking-messages')}
            ariaLabel="Messages"
            badgeCount={combinedMessageUnreadCount}
          />
          <IconBadgeButton
            icon={Bell}
            onClick={onOpenNotifications}
            ariaLabel="Notifications"
            badgeCount={notificationUnreadCount}
          />
          <IconBadgeButton
            icon={Heart}
            onClick={() => onNavigate('wishlist')}
            ariaLabel="Wishlist"
            iconStrokeWidth={1.75}
          />
        </div>
      </div>
    </div>
  );
}

/** Top home header: profile greeting, wallet, messages, notifications, wishlist. */
export const HomeHeaderSection = memo(HomeHeaderSectionComponent);
