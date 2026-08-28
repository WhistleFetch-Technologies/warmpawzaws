'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ChevronDown, Loader2, MapPin, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { resolveCustomerLocation } from '@/lib/customer-location';
import { useLocationContextOptional } from '@/context/LocationContext';
import { ManualLocationSheet } from '@/components/customer/ManualLocationSheet';
import { WalkInLocationSheet } from '@/components/customer/walk-in/WalkInLocationSheet';
import { useWalkInDiscoveryLocation } from '@/hooks/useWalkInDiscoveryLocation';
import { IconBadgeButton } from '../shared/IconBadgeButton';
import type { HomeNavigateFn } from '../hooks/useHomeNavigation';

export interface HomeHeaderSectionProps {
  userName: string;
  userProfilePhoto?: string;
  phone: string;
  isGuest?: boolean;
  onProfileClick?: () => void;
  /** Optional override; default opens detect/manual location. */
  onLocationClick?: () => void;
  onNavigate: HomeNavigateFn;
  onOpenNotifications: () => void;
  notificationUnreadCount: number;
  combinedMessageUnreadCount: number;
}

function formatLocationLabel(parts: {
  locality?: string;
  city?: string;
  pincode?: string;
  state?: string;
}): string {
  const locality = (parts.locality || '').trim();
  const city = (parts.city || '').trim();
  const pincode = (parts.pincode || '').trim();
  const state = (parts.state || '').trim();
  if (city && pincode) return `${city} ${pincode}`;
  if (locality && city) return `${locality}, ${city}`;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (pincode) return pincode;
  if (locality) return locality;
  if (state) return state;
  return '';
}

function HomeHeaderSectionComponent({
  userName,
  userProfilePhoto,
  phone,
  isGuest = false,
  onProfileClick,
  onLocationClick,
  onNavigate,
  onOpenNotifications,
  notificationUnreadCount,
  combinedMessageUnreadCount,
}: HomeHeaderSectionProps) {
  const greetingName = isGuest ? 'there' : userName;
  const initial = (greetingName || 'G').charAt(0).toUpperCase();
  const locationCtx = useLocationContextOptional();
  const [accountLocationLabel, setAccountLocationLabel] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sheetsMounted, setSheetsMounted] = useState(false);
  const walkInLocation = useWalkInDiscoveryLocation({ phone, isGuest });

  useEffect(() => {
    setSheetsMounted(true);
  }, []);

  const contextLocationLabel = useMemo(() => {
    if (!locationCtx) return '';
    return formatLocationLabel({
      locality: locationCtx.locality,
      city: locationCtx.city,
      pincode: locationCtx.pincode,
      state: locationCtx.state,
    });
  }, [
    locationCtx?.locality,
    locationCtx?.city,
    locationCtx?.pincode,
    locationCtx?.state,
  ]);

  useEffect(() => {
    if (isGuest || contextLocationLabel) {
      setAccountLocationLabel('');
      return;
    }
    if (!phone) {
      setAccountLocationLabel('');
      return;
    }
    let cancelled = false;
    void resolveCustomerLocation(phone).then((loc) => {
      if (cancelled) return;
      setAccountLocationLabel(formatLocationLabel(loc) || 'Set your location');
    });
    return () => {
      cancelled = true;
    };
  }, [phone, isGuest, contextLocationLabel]);

  const hasCoords =
    locationCtx?.latitude != null && locationCtx?.longitude != null;
  const locationLabel =
    walkInLocation.label ||
    contextLocationLabel ||
    accountLocationLabel ||
    (locationCtx
      ? detecting
        ? 'Detecting…'
        : hasCoords
          ? 'Current location'
          : 'Set location'
      : '');

  const handleDetectCurrent = useCallback(async () => {
    if (onLocationClick) {
      onLocationClick();
      return;
    }
    if (!locationCtx) {
      if (!isGuest) onProfileClick?.();
      return;
    }
    setDetecting(true);
    try {
      const ok = await walkInLocation.selectCurrentLocation();
      if (ok) {
        toast.success('Location updated');
        return;
      }
      if (isGuest) setManualOpen(true);
      else setAddressOpen(true);
    } finally {
      setDetecting(false);
    }
  }, [onLocationClick, locationCtx, isGuest, onProfileClick, walkInLocation.selectCurrentLocation]);

  const handleOpenSavedAddresses = useCallback(() => {
    if (!locationCtx) {
      if (!isGuest) onProfileClick?.();
      return;
    }
    if (isGuest) {
      setManualOpen(true);
      return;
    }
    setAddressOpen(true);
  }, [locationCtx, isGuest, onProfileClick]);

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
            {userProfilePhoto && !isGuest ? (
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
                Hi, {greetingName}!
              </h1>
              <span className="shrink-0 text-lg" role="img" aria-label="wave">
                👋
              </span>
            </div>
            <p className="truncate text-white/70 text-xs font-medium tracking-wide">
              Everything your pet needs, in one place
            </p>
            {locationLabel || locationCtx || !isGuest ? (
              <div className="mt-0.5 flex min-w-0 max-w-full items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => void handleDetectCurrent()}
                  disabled={detecting}
                  className="flex min-w-0 items-center gap-1 text-left active:opacity-80 disabled:opacity-70"
                  aria-label={`Location: ${locationLabel || 'Set location'}. Tap to update current location.`}
                >
                  {detecting ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-white/75" aria-hidden />
                  ) : (
                    <MapPin className="h-3 w-3 shrink-0 text-white/75" aria-hidden />
                  )}
                  <span className="truncate text-[11px] font-medium text-white/80">
                    {locationLabel || 'Set location'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenSavedAddresses}
                  className="shrink-0 rounded-full p-0.5 active:opacity-80"
                  aria-label="Choose a saved address"
                  aria-expanded={addressOpen}
                >
                  <ChevronDown className="h-3 w-3 text-white/70" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!isGuest ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>
      {sheetsMounted
        ? createPortal(
            <>
              <ManualLocationSheet open={manualOpen} onClose={() => setManualOpen(false)} />
              <WalkInLocationSheet
                open={addressOpen}
                onClose={() => setAddressOpen(false)}
                addresses={walkInLocation.addresses}
                selectedAddressId={walkInLocation.addressId}
                onSelectAddress={walkInLocation.selectAddress}
                onSelectCurrent={async () => {
                  const ok = await walkInLocation.selectCurrentLocation();
                  if (ok) toast.success('Location updated');
                  return ok;
                }}
              />
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Top home header: profile greeting, messages, notifications. */
export const HomeHeaderSection = memo(HomeHeaderSectionComponent);
