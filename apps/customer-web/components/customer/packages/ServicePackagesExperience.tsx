'use client';

import React from 'react';
import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Dog,
  Footprints,
  Heart,
  Info,
  Layers,
  LayoutGrid,
  PawPrint,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import type { PetUi } from '@/lib/extract-pets-from-api';
import {
  isPackageCountedActive,
  packageCardStatus,
  packageProgressPercent,
} from './service-package-progress';

const ORANGE = '#FF6B0B';
const NAVY = '#101B35';
const PAGE = '#FFF9F3';
const PEACH = '#FFF1E5';
const HERO_DOG = '/images/home/Walking/ChatGPT_Image_May_30__2026__01_19_16_PM-removebg-preview.webp';

const fieldClass =
  'w-full min-w-0 rounded-2xl border border-[#F0E2D6] bg-white px-3 py-3 text-sm text-[#101B35] focus:border-[#FF6B0B] focus:outline-none focus:ring-2 focus:ring-[#FF6B0B]/30';

export type ServicePackageView = 'browse' | 'schedule' | 'review' | 'my-packages';

export type BrowsePackageCard = {
  id: string;
  name: string;
  description: string;
  vendorName: string;
  totalSessions: number;
  pricePerSession: number;
  totalPrice: number;
  duration: number;
  category: string;
  popular?: boolean;
};

export type OwnedPackageCard = {
  id: string;
  packageName: string;
  serviceLabel: string;
  petName?: string;
  petPhoto?: string;
  purchasedAt?: string;
  expiresAt?: string;
  status: string;
  totalSessions: number;
  completedSessions: number;
  remainingSessions: number;
  unlimited?: boolean;
};

function inr(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function looksLikeWalk(pkg: { name?: string; category?: string; serviceLabel?: string }): boolean {
  const blob = `${pkg.name || ''} ${pkg.category || ''} ${pkg.serviceLabel || ''}`.toLowerCase();
  return blob.includes('walk');
}

function formatLongDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ServicePackagesShell({
  onBack,
  view,
  packageCount,
  onBrowse,
  onMyPackages,
  error,
  children,
}: {
  onBack?: () => void;
  view: ServicePackageView;
  packageCount: number;
  onBrowse: () => void;
  onMyPackages: () => void;
  error?: string | null;
  children: React.ReactNode;
}) {
  const myActive = view === 'my-packages';
  return (
    <div
      className="mx-auto min-h-screen min-h-[100dvh] w-full max-w-customer overflow-x-hidden cw-header-safe-top cw-header-safe-x pb-28 md:max-w-3xl"
      style={{ background: PAGE, color: NAVY }}
    >
      <div className="px-4 pt-3">
        <header className="relative overflow-hidden rounded-[28px] border border-[#F3E6DC] bg-white px-4 pb-4 pt-3 shadow-[0_8px_24px_rgba(16,27,53,0.04)]">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-1 text-sm font-medium text-[#5C6578] hover:bg-[#FFF1E5]"
              aria-label="Go back"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              Back
            </button>
          ) : null}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 pb-1">
              <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight" style={{ color: NAVY }}>
                Service Packages
              </h1>
              <p className="mt-1 text-sm text-[#7A8496]">
                Save more with multi-session packages{' '}
                <span aria-hidden className="text-[#FF6B0B]">
                  ♥
                </span>
              </p>
            </div>
            <div className="relative h-[92px] w-[132px] shrink-0">
              <div
                className="absolute inset-x-2 bottom-0 top-2 rounded-[40%_45%_42%_48%] opacity-90"
                style={{ background: PEACH }}
                aria-hidden
              />
              <PawPrint className="absolute right-1 top-1 h-3.5 w-3.5 text-[#FF6B0B]/50" aria-hidden />
              <Heart className="absolute left-1 top-4 h-3 w-3 fill-[#FFB088] text-[#FFB088]" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_DOG}
                alt=""
                className="absolute bottom-0 right-0 h-[88px] w-auto object-contain"
              />
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-3" role="tablist" aria-label="Package views">
          <button
            type="button"
            role="tab"
            aria-selected={!myActive}
            onClick={onBrowse}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors ${
              !myActive ? 'text-white shadow-[0_8px_18px_rgba(255,107,11,0.28)]' : 'border border-[#F0E2D6] bg-white text-[#5C6578]'
            }`}
            style={!myActive ? { background: ORANGE } : undefined}
          >
            <LayoutGrid className="h-4 w-4" />
            Browse Packages
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={myActive}
            onClick={onMyPackages}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors ${
              myActive ? 'text-white shadow-[0_8px_18px_rgba(255,107,11,0.28)]' : 'border border-[#F0E2D6] bg-white text-[#5C6578]'
            }`}
            style={myActive ? { background: ORANGE } : undefined}
          >
            <ShoppingBag className="h-4 w-4" />
            My Packages ({packageCount})
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function WalkerSketch() {
  return (
    <svg viewBox="0 0 120 80" className="h-16 w-24" aria-hidden>
      <path d="M18 28c18-16 48-8 62 6" fill="none" stroke="#FF6B0B" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="78" cy="38" r="14" fill="none" stroke="#101B35" strokeWidth="2" />
      <path d="M70 36c2 2 6 2 8 0" fill="none" stroke="#101B35" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M74 50c-8 10-6 18 2 22M86 50c6 8 14 10 18 6" fill="none" stroke="#101B35" strokeWidth="2" strokeLinecap="round" />
      <path d="M62 46c-10 2-16 10-14 16" fill="none" stroke="#101B35" strokeWidth="2" strokeLinecap="round" />
      <circle cx="92" cy="34" r="2" fill="#101B35" />
    </svg>
  );
}

export function BrowsePackagesPanel({
  packages,
  walkBanner,
  onBook,
}: {
  packages: BrowsePackageCard[];
  walkBanner?: React.ReactNode;
  onBook: (id: string) => void;
}) {
  if (packages.length === 0) {
    return (
      <div className="rounded-[28px] border border-[#F3E6DC] bg-white px-6 py-12 text-center shadow-sm">
        <PawPrint className="mx-auto h-10 w-10 text-[#FFB088]" />
        <p className="mt-3 font-semibold" style={{ color: NAVY }}>
          No packages available
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[#7A8496]">
          This provider has not published any multi-session packages yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {walkBanner}
      {packages.map((pkg) => {
        const walking = looksLikeWalk(pkg);
        return (
          <article
            key={pkg.id}
            className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-[0_10px_28px_rgba(16,27,53,0.05)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {pkg.popular ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#FF6B0B]"
                    style={{ background: PEACH }}
                  >
                    <Star className="h-3 w-3 fill-[#FF6B0B]" />
                    Popular
                  </span>
                ) : null}
                <h2 className="mt-2 text-[1.65rem] font-extrabold leading-tight" style={{ color: NAVY }}>
                  {pkg.name}
                </h2>
                {pkg.description ? (
                  <p className="mt-1 text-sm text-[#7A8496]">{pkg.description}</p>
                ) : null}
              </div>
              {walking ? <WalkerSketch /> : <PawPrint className="h-10 w-10 text-[#FFB088]" />}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-[#5C6578]">
              <span className="inline-flex flex-col items-center gap-1">
                <UserRound className="h-4 w-4 text-[#FF6B0B]" />
                {walking ? 'Private walker' : pkg.vendorName || 'Your provider'}
              </span>
              <span className="inline-flex flex-col items-center gap-1">
                <ShieldCheck className="h-4 w-4 text-[#FF6B0B]" />
                {walking ? 'Trusted & background verified' : 'Warmpawz provider'}
              </span>
              <span className="inline-flex flex-col items-center gap-1">
                <Heart className="h-4 w-4 text-[#FF6B0B]" />
                Personalised care
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#FFFCF9] p-3 text-center">
              <div>
                <Layers className="mx-auto h-4 w-4 text-[#FF6B0B]" />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8B93A7]">Total Sessions</p>
                <p className="text-lg font-extrabold" style={{ color: NAVY }}>
                  {pkg.totalSessions}
                </p>
                <p className="text-[10px] text-[#8B93A7]">{walking ? 'walks' : 'sessions'}</p>
              </div>
              <div>
                <Receipt className="mx-auto h-4 w-4 text-[#FF6B0B]" />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8B93A7]">Per Session</p>
                <p className="text-lg font-extrabold" style={{ color: NAVY }}>
                  {inr(pkg.pricePerSession)}
                </p>
                <p className="text-[10px] text-[#8B93A7]">(Save more)</p>
              </div>
              <div>
                <Clock className="mx-auto h-4 w-4 text-[#FF6B0B]" />
                <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8B93A7]">Duration</p>
                <p className="text-lg font-extrabold" style={{ color: NAVY }}>
                  {pkg.duration} mins
                </p>
                <p className="text-[10px] text-[#8B93A7]">{walking ? 'per walk' : 'per session'}</p>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#F6EBE3] pt-4">
              <div>
                <p className="text-xs text-[#8B93A7]">Total Package Price</p>
                <p className="text-2xl font-extrabold" style={{ color: ORANGE }}>
                  {inr(pkg.totalPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBook(pkg.id)}
                className="inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl px-5 text-sm font-semibold text-white"
                style={{ background: ORANGE }}
              >
                Book Package
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function SchedulePackagePanel({
  name,
  totalSessions,
  totalPrice,
  vendorService,
  sessionsPerDay,
  intervalDays,
  pets,
  petsLoading,
  selectedPetId,
  onSelectPet,
  date,
  minDate,
  onDate,
  times,
  onTime,
  slotHints,
  singleTime,
  onSingleTime,
  onBack,
  onContinue,
  canContinue,
}: {
  name: string;
  totalSessions: number;
  totalPrice: number;
  vendorService: boolean;
  sessionsPerDay: number;
  intervalDays: number;
  pets: PetUi[];
  petsLoading: boolean;
  selectedPetId: string | null;
  onSelectPet: (id: string) => void;
  date: string;
  minDate: string;
  onDate: (value: string) => void;
  times: string[];
  onTime: (index: number, value: string) => void;
  slotHints: Record<number, string>;
  singleTime: string;
  onSingleTime: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
}) {
  const multi = vendorService && sessionsPerDay > 1;
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: PEACH }}>
            <Dog className="h-5 w-5 text-[#FF6B0B]" />
          </span>
          <h2 className="text-lg font-extrabold capitalize" style={{ color: NAVY }}>
            {name}
          </h2>
        </div>
        <div className="mt-3 rounded-2xl px-3 py-3 text-sm" style={{ background: '#FFF6EE' }}>
          <span className="font-semibold text-[#FF6B0B]">You get {totalSessions} sessions</span>
          <span className="text-[#5C6578]"> with this package. You can book each session from your package later.</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-b border-[#F6EBE3] py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-[#5C6578]">
            <Layers className="h-4 w-4 text-[#FF6B0B]" /> Sessions in package
          </span>
          <span className="font-bold">{totalSessions}</span>
        </div>
        <div className="flex items-center justify-between py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-[#5C6578]">
            <Receipt className="h-4 w-4 text-[#FF6B0B]" /> Total Amount
          </span>
          <span className="text-lg font-extrabold" style={{ color: ORANGE }}>
            {inr(totalPrice)}
          </span>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold" style={{ color: NAVY }}>
          <PawPrint className="h-4 w-4 text-[#FF6B0B]" /> Pet for this package
        </h3>
        <p className="mt-1 text-xs text-[#8B93A7]">Choose which pet this purchase is for.</p>
        {petsLoading ? (
          <p className="mt-3 text-sm text-[#5C6578]">Loading your pets…</p>
        ) : pets.length === 0 ? (
          <p className="mt-3 text-sm text-[#5C6578]">
            No pets found on your account. Add a pet from your profile, then return here to book.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {pets.map((pet) => {
              const selected = selectedPetId === pet.id;
              const meta = [pet.breed, pet.species && pet.species !== 'pet' ? pet.species : null]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => onSelectPet(pet.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${
                    selected ? 'border-[#FF6B0B] bg-[#FFF6EE]' : 'border-[#F0E2D6] bg-white'
                  }`}
                >
                  {pet.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pet.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF1E5] text-sm font-bold text-[#FF6B0B]">
                      {pet.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold" style={{ color: NAVY }}>
                      {pet.name}
                    </span>
                    {meta ? <span className="block truncate text-xs text-[#8B93A7]">{meta}</span> : null}
                  </span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-[#FF6B0B] bg-[#FF6B0B] text-white' : 'border-[#E4D5C8]'
                    }`}
                  >
                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4" />
          {vendorService ? 'Session schedule (required)' : 'Starting session'}
        </p>
        <p className="mt-1 leading-relaxed">
          {multi
            ? `Pick the first day and ${sessionsPerDay} time slots on your first day. The next block of sessions uses the next calendar day, then the day after that, and so on — same times each day.`
            : vendorService
              ? `Pick the first day and a time. Later sessions repeat every ${intervalDays} days at that same time.`
              : 'Choose a date for your first session.'}
        </p>
      </section>

      <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold" style={{ color: NAVY }}>
          <Calendar className="h-4 w-4 text-[#FF6B0B]" /> First session date
        </h3>
        <p className="mt-1 text-xs text-[#8B93A7]">
          {multi
            ? 'Required — first calendar day for sessions 1–N; later sessions move forward one day per block with the same daily times.'
            : 'Required — this is the first calendar day for the scheduled sessions.'}
        </p>
        <label className="relative mt-3 block">
          <span className="sr-only">First session date</span>
          <input
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => onDate(e.target.value)}
            className={`${fieldClass} ${date ? '' : 'text-transparent'}`}
          />
          {!date ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#A0A8B8]">
              dd-mm-yyyy
            </span>
          ) : null}
        </label>
      </section>

      {vendorService ? (
        <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold" style={{ color: NAVY }}>
            <Clock className="h-4 w-4 text-[#FF6B0B]" />
            {multi ? `Times on the first day (${sessionsPerDay} slots)` : 'Time for every session'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#8B93A7]">
            {multi
              ? `Each group of ${sessionsPerDay} sessions stays on one calendar day; the next group is the next day, until all ${totalSessions} sessions are scheduled. Each slot on the first day must be a different time.`
              : `Same clock time every ${intervalDays} days for all ${totalSessions} sessions.`}
          </p>
          {multi
            ? times.slice(0, sessionsPerDay).map((value, idx) => (
                <label key={idx} className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-[#5C6578]">Session slot {idx + 1}</span>
                  <input
                    type="time"
                    required
                    value={value}
                    onChange={(e) => onTime(idx, e.target.value)}
                    className={`${fieldClass}${slotHints[idx] ? ' border-red-400' : ''}`}
                  />
                  {slotHints[idx] ? <p className="mt-1 text-xs text-red-600">{slotHints[idx]}</p> : null}
                </label>
              ))
            : (
              <label className="mt-3 block">
                <span className="sr-only">Session time</span>
                <input
                  type="time"
                  required
                  value={singleTime}
                  onChange={(e) => onSingleTime(e.target.value)}
                  className={fieldClass}
                />
              </label>
            )}
        </section>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-2 gap-3 border-t border-[#F3E6DC] bg-[#FFF9F3]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-2xl border border-[#E7D9CE] bg-white font-semibold text-[#5C6578]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: ORANGE }}
        >
          Continue to summary
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ReviewPackagePanel({
  packageName,
  petName,
  petPhoto,
  sessions,
  firstDayLabel,
  slots,
  consecutiveDays,
  quoteLoading,
  lines,
  totalLabel,
  razorpayNote,
  wallet,
  policyText,
  policyRequired,
  policyAccepted,
  onPolicy,
  onBack,
  onPay,
  paying,
  payLabel,
  payDisabled,
}: {
  packageName: string;
  petName: string;
  petPhoto?: string;
  sessions: number;
  firstDayLabel: string;
  slots: Array<{ label: string; time: string }>;
  consecutiveDays: boolean;
  quoteLoading: boolean;
  lines: Array<{ label: string; value: string; emphasize?: boolean }>;
  totalLabel: string;
  razorpayNote: string;
  wallet?: React.ReactNode;
  policyText: string;
  policyRequired: boolean;
  policyAccepted: boolean;
  onPolicy: (accepted: boolean) => void;
  onBack: () => void;
  onPay: () => void;
  paying: boolean;
  payLabel: string;
  payDisabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold" style={{ color: NAVY }}>
          <Receipt className="h-5 w-5 text-[#FF6B0B]" /> Booking summary
        </h2>
        <p className="mt-1 text-sm text-[#8B93A7]">Review your package and charges, then proceed to secure payment.</p>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-[#5C6578]">
              <Dog className="h-4 w-4 text-[#FF6B0B]" /> Package
            </dt>
            <dd className="font-semibold capitalize">{packageName}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-[#5C6578]">
              <PawPrint className="h-4 w-4 text-[#FF6B0B]" /> Pet
            </dt>
            <dd className="inline-flex items-center gap-2 font-semibold">
              {petPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={petPhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : null}
              {petName}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-[#5C6578]">
              <Layers className="h-4 w-4 text-[#FF6B0B]" /> Sessions
            </dt>
            <dd className="font-semibold">{sessions}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-2 text-[#5C6578]">
              <Calendar className="h-4 w-4 text-[#FF6B0B]" /> First day
            </dt>
            <dd className="font-semibold">{firstDayLabel}</dd>
          </div>
        </dl>
        {slots.length > 0 ? (
          <div className="mt-3 rounded-2xl p-3" style={{ background: PEACH }}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#FF6B0B]">Times on first day</p>
            {slots.map((slot) => (
              <div key={slot.label} className="mt-2 flex justify-between text-sm">
                <span className="text-[#5C6578]">{slot.label}</span>
                <span className="font-semibold">{slot.time}</span>
              </div>
            ))}
            {consecutiveDays ? (
              <p className="mt-2 text-xs text-[#8B93A7]">
                Next sessions use consecutive calendar days (same times each day).
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
        <h3 className="font-extrabold" style={{ color: NAVY }}>
          Price breakdown
        </h3>
        {quoteLoading ? (
          <p className="mt-3 text-sm text-[#5C6578]">Calculating taxes…</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-3 text-[#5C6578]">
                <span>{line.label}</span>
                <span className={line.emphasize ? 'font-semibold text-[#101B35]' : ''}>{line.value}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-[#F6EBE3] pt-3">
              <span className="font-bold" style={{ color: NAVY }}>
                Total payable
              </span>
              <span className="text-xl font-extrabold" style={{ color: ORANGE }}>
                {totalLabel}
              </span>
            </div>
          </div>
        )}
        {wallet}
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-[#8B93A7]">
          <Receipt className="h-3.5 w-3.5" /> {razorpayNote}
        </p>
      </section>

      {policyRequired ? (
        <section className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
          <h3 className="flex items-center gap-2 font-extrabold" style={{ color: NAVY }}>
            <ShieldCheck className="h-4 w-4 text-[#FF6B0B]" /> Cancellation & refund policy
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#5C6578]">{policyText}</p>
          <label className="mt-3 flex items-start gap-2 text-sm text-[#101B35]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-[#E4D5C8] text-[#FF6B0B] focus:ring-[#FF6B0B]"
              checked={policyAccepted}
              onChange={(e) => onPolicy(e.target.checked)}
            />
            <span>I have read and agree to the cancellation and refund policy for this package.</span>
          </label>
        </section>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-[0.8fr_1.2fr] gap-3 border-t border-[#F3E6DC] bg-[#FFF9F3]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-2xl border border-[#E7D9CE] bg-white font-semibold text-[#5C6578]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onPay}
          disabled={payDisabled || paying}
          className="inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: ORANGE }}
        >
          {paying ? 'Processing…' : payLabel}
          {paying ? null : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function MyPackagesPanel({
  packages,
  notice,
  onDismissNotice,
  onViewDetails,
}: {
  packages: OwnedPackageCard[];
  notice?: string | null;
  onDismissNotice?: () => void;
  onViewDetails: (id: string) => void;
}) {
  const activeCount = packages.filter((pkg) =>
    isPackageCountedActive({
      totalSessions: pkg.totalSessions,
      completedSessions: pkg.completedSessions,
      remainingSessions: pkg.unlimited ? Number.MAX_SAFE_INTEGER : pkg.remainingSessions,
      unlimited: pkg.unlimited,
      status: pkg.status,
    })
  ).length;
  const sessionsRemaining = packages.reduce((sum, pkg) => {
    if (!isPackageCountedActive({
      totalSessions: pkg.totalSessions,
      completedSessions: pkg.completedSessions,
      remainingSessions: pkg.unlimited ? Number.MAX_SAFE_INTEGER : pkg.remainingSessions,
      unlimited: pkg.unlimited,
      status: pkg.status,
    })) {
      return sum;
    }
    if (pkg.unlimited) return sum;
    return sum + Math.max(0, pkg.remainingSessions);
  }, 0);

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          <p>{notice}</p>
          <button type="button" onClick={onDismissNotice} aria-label="Dismiss purchase confirmation" className="text-green-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 rounded-[28px] p-4" style={{ background: PEACH }}>
        <div>
          <p className="text-xs font-medium text-[#8B93A7]">Active packages</p>
          <p className="text-2xl font-extrabold" style={{ color: NAVY }}>
            {activeCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-[#8B93A7]">Total sessions remaining</p>
          <p className="text-2xl font-extrabold" style={{ color: NAVY }}>
            {sessionsRemaining}
          </p>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-[28px] border border-[#F3E6DC] bg-white px-6 py-12 text-center">
          <p className="font-semibold" style={{ color: NAVY }}>
            No packages yet
          </p>
          <p className="mt-1 text-sm text-[#8B93A7]">Browse packages to purchase a multi-session plan.</p>
        </div>
      ) : (
        packages.map((pkg) => {
          const progress = packageProgressPercent(pkg);
          const status = packageCardStatus({
            ...pkg,
            remainingSessions: pkg.unlimited ? Number.MAX_SAFE_INTEGER : pkg.remainingSessions,
          });
          const statusClass =
            status === 'Expired'
              ? 'bg-amber-100 text-amber-800'
              : status === 'Completed'
                ? 'bg-gray-100 text-gray-700'
                : status === 'Cancelled'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700';
          const remainingLabel = pkg.unlimited
            ? 'Unlimited sessions remaining'
            : `${Math.max(0, pkg.remainingSessions)} sessions remaining`;
          return (
            <article key={pkg.id} className="rounded-[28px] border border-[#F3E6DC] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold" style={{ color: NAVY }}>
                    {pkg.packageName}
                  </h3>
                  <p className="text-sm text-[#8B93A7]">{pkg.serviceLabel}</p>
                  {pkg.petName ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                      {pkg.petPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pkg.petPhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF1E5] text-xs font-bold text-[#FF6B0B]">
                          {pkg.petName.slice(0, 1)}
                        </span>
                      )}
                      {pkg.petName}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[#8B93A7]">
                    Purchased {formatLongDate(pkg.purchasedAt)}
                    {pkg.expiresAt ? ` · Expires ${formatLongDate(pkg.expiresAt)}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>
              </div>
              <p className="mt-4 text-sm text-[#5C6578]">
                {pkg.completedSessions} of {pkg.unlimited ? '∞' : pkg.totalSessions} sessions completed
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3E6DC]">
                <div className="h-2 rounded-full bg-[#FF6B0B]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-[#8B93A7]">
                <span>{progress}% completed</span>
                <span>{remainingLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => onViewDetails(pkg.id)}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border-2 border-[#FF6B0B] bg-white text-sm font-semibold text-[#FF6B0B]"
              >
                View details
              </button>
            </article>
          );
        })
      )}
    </div>
  );
}

export function WalkSessionBanner({
  serviceName,
  price,
  duration,
  onChoose,
}: {
  serviceName: string;
  price: number;
  duration: number;
  onChoose: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-orange-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6B0B]">Dog walking</p>
      <h2 className="mt-1 text-lg font-extrabold" style={{ color: NAVY }}>
        {serviceName}
      </h2>
      <p className="mt-1 text-sm text-[#5C6578]">
        <span className="font-semibold text-[#FF6B0B]">{inr(price)}</span>
        {` / walk · ${duration} minutes`}
      </p>
      <button
        type="button"
        onClick={onChoose}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white"
        style={{ background: ORANGE }}
      >
        <Footprints className="h-4 w-4" />
        Choose a walker
      </button>
    </div>
  );
}
