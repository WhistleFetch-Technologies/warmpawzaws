'use client';

import type { ReactNode } from 'react';
import {
  BadgeCheck,
  Calendar,
  Camera,
  ChevronLeft,
  Edit2,
  Loader2,
  Phone,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import {
  isCapacitorNativePlatform,
  isNarrowMobileViewport,
  resolveServiceHeaderTopPad,
  subscribeToNarrowMobileViewport,
} from '@/lib/service-header-safe-area';
import {
  ProfileHeaderBackground,
  PROFILE_HEADER_GRADIENT,
  PROFILE_HEADER_RADIAL_LIGHT,
} from './ProfileHeaderBackground';

interface ProfileAccountHeroProps {
  displayName: string;
  phone?: string;
  photoUrl?: string;
  loading?: boolean;
  memberSinceLabel?: string;
  onCloseToHome: () => void;
  onSettings?: () => void;
  /** Back chevron (profile page); shown on the right when set. */
  onBack?: () => void;
  /** Pet profile: glass Edit button top-right */
  onEdit?: () => void;
  /** When set, toggles edit icon vs X in top-right (pet edit mode) */
  editModeActive?: boolean;
  /** Edit mode: tap avatar to change photo */
  editMode?: boolean;
  onPhotoClick?: () => void;
  uploadingPhoto?: boolean;
  uploadProgress?: number;
  /** Replaces verified badge (e.g. gender symbol) */
  badge?: ReactNode;
  /** Replaces phone line (e.g. type | breed chips) */
  subtitle?: ReactNode;
  /** Second row of chips below subtitle (e.g. age + weight) */
  metaChips?: ReactNode;
  /** Avatar fallback when no photo (e.g. pet emoji) */
  fallbackAvatar?: ReactNode;
  /** Hide default verified user chips (pet profile) */
  hideDefaultChips?: boolean;
}

const glassBtn =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.20)] bg-[rgba(255,255,255,0.15)] shadow-[0_2px_10px_rgba(0,0,0,0.10)] backdrop-blur-[12px] transition active:scale-95';

const infoChip =
  'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.20)] bg-[rgba(255,255,255,0.15)] px-3 text-xs font-medium text-white backdrop-blur-[10px]';

export function ProfileAccountHero({
  displayName,
  phone = '',
  photoUrl,
  loading = false,
  memberSinceLabel,
  onCloseToHome,
  onSettings,
  onBack,
  onEdit,
  editModeActive = false,
  editMode = false,
  onPhotoClick,
  uploadingPhoto = false,
  uploadProgress = 0,
  badge,
  subtitle,
  metaChips,
  fallbackAvatar,
  hideDefaultChips = false,
}: ProfileAccountHeroProps) {
  const isCapacitorNative = useSyncExternalStore(
    () => () => {},
    isCapacitorNativePlatform,
    () => false
  );
  const isNarrowMobile = useSyncExternalStore(
    subscribeToNarrowMobileViewport,
    isNarrowMobileViewport,
    () => true
  );
  const topPadStyle = resolveServiceHeaderTopPad(false, isCapacitorNative, isNarrowMobile);

  const avatarInteractive = editMode && onPhotoClick && !uploadingPhoto;

  return (
    <div className="relative z-10 isolate mx-auto w-full max-w-customer shrink-0">
      <header className="relative overflow-hidden text-white pb-0" style={topPadStyle}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: PROFILE_HEADER_GRADIENT }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: PROFILE_HEADER_RADIAL_LIGHT }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <ProfileHeaderBackground />
        </div>

        <div className="relative z-10 flex flex-col px-4 pb-5 pt-1 sm:px-5 md:pb-6">
          <div className="flex shrink-0 items-center justify-between">
            <button type="button" onClick={onCloseToHome} className={glassBtn} aria-label="Close to home">
              <X className="h-5 w-5 text-white" strokeWidth={2.25} />
            </button>
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className={glassBtn}
                aria-label={editModeActive ? 'Close edit' : 'Edit profile'}
              >
                {editModeActive ? (
                  <X className="h-5 w-5 text-white" strokeWidth={2.25} />
                ) : (
                  <Edit2 className="h-5 w-5 text-white" strokeWidth={2} />
                )}
              </button>
            ) : onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-[44px] items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-white active:opacity-90"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                Back
              </button>
            ) : onSettings ? (
              <button type="button" onClick={onSettings} className={glassBtn} aria-label="Settings">
                <Settings className="h-5 w-5 text-white" strokeWidth={2} />
              </button>
            ) : (
              <span className="h-12 w-12 shrink-0" aria-hidden />
            )}
          </div>

          <div className="mt-4 flex items-center">
            <div className="flex w-full items-start gap-3.5">
              <div className="relative shrink-0">
                <button
                  type="button"
                  disabled={!avatarInteractive}
                  onClick={avatarInteractive ? onPhotoClick : undefined}
                  className={`relative flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-full border-[5px] border-white bg-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] ${
                    avatarInteractive ? 'cursor-pointer active:scale-[0.98]' : ''
                  } ${uploadingPhoto ? 'opacity-80' : ''}`}
                  aria-label={avatarInteractive ? 'Change profile photo' : undefined}
                >
                  {loading ? (
                    <span className="h-full w-full animate-pulse bg-orange-100" aria-hidden />
                  ) : photoUrl ? (
                    <PresignableImage src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : fallbackAvatar ? (
                    fallbackAvatar
                  ) : (
                    <User className="h-11 w-11 text-[#FF8C42]" strokeWidth={1.5} />
                  )}
                  {uploadingPhoto && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                      <Loader2 className="mb-1 h-7 w-7 animate-spin text-white" />
                      <span className="text-xs text-white">{uploadProgress}%</span>
                    </span>
                  )}
                </button>
                {editMode && !uploadingPhoto && !loading && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#FF8C42] shadow-md"
                    aria-hidden
                  >
                    <Camera className="h-4 w-4 text-white" strokeWidth={2} />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5 text-left">
                <div className="mb-1 flex items-center gap-1.5">
                  <h1 className="truncate text-[30px] font-bold leading-[1.1] text-white">
                    {loading ? 'Account' : displayName}
                  </h1>
                  {!loading && badge != null ? (
                    badge
                  ) : !loading ? (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
                      aria-label="Verified"
                    >
                      <BadgeCheck className="h-3.5 w-3.5 text-[#FF7A3D]" strokeWidth={2.75} />
                    </span>
                  ) : null}
                </div>

                {!loading && subtitle != null ? (
                  <div className="mb-2">{subtitle}</div>
                ) : !loading && phone ? (
                  <p className="mb-2 flex items-center gap-1.5 text-[15px] text-white">
                    <Phone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="truncate">{phone}</span>
                  </p>
                ) : null}

                {!loading && metaChips != null ? (
                  <div className="flex flex-wrap items-center gap-2">{metaChips}</div>
                ) : !loading && !hideDefaultChips ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={infoChip}>
                      <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                      Verified User
                    </span>
                    {memberSinceLabel && (
                      <span className={infoChip}>
                        <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                        Member since {memberSinceLabel}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="pointer-events-none relative z-[21] -mt-3 w-full" aria-hidden>
        <div className="pointer-events-none h-8 rounded-t-[1.75rem] bg-[#F5F5F5] shadow-[0_-10px_36px_-8px_rgba(0,0,0,0.12)] sm:h-9 sm:rounded-t-[2rem]" />
      </div>
    </div>
  );
}
