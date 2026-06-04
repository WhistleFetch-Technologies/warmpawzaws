'use client';

import { ArrowLeft, Calendar, Clock, Lock, PawPrint, Shield, Wallet } from 'lucide-react';
import {
  isCapacitorNativePlatform,
  isNarrowMobileViewport,
  resolveServiceHeaderTopPad,
  subscribeToNarrowMobileViewport,
} from '@/lib/service-header-safe-area';
import { paymentPageBgClass } from './payment-page-styles';
import { useSyncExternalStore } from 'react';

export type PaymentHeaderStat = {
  value: string;
  label: string;
  icon: 'wallet' | 'clock' | 'calendar';
};

export type PaymentPageHeaderProps = {
  onBack?: () => void;
  stats: PaymentHeaderStat[];
  className?: string;
};

function StatIcon({ type }: { type: PaymentHeaderStat['icon'] }) {
  const cls = 'h-[18px] w-[18px] text-[#FF8C42]';
  if (type === 'wallet') return <Wallet className={cls} aria-hidden />;
  if (type === 'clock') return <Clock className={cls} aria-hidden />;
  return <Calendar className={cls} aria-hidden />;
}

const PAW_DECO =
  'pointer-events-none fill-none stroke-current text-white [&>circle]:fill-none [&>path]:fill-none [&>polygon]:fill-none [&>rect]:fill-none';

function PaymentHeaderDecorations() {
  return (
    <>
      <div
        className="pointer-events-none absolute right-3 top-3 z-0 h-[5.5rem] w-[5.5rem] opacity-[0.07] sm:right-5 sm:top-4"
        aria-hidden
      >
        <Shield className="h-full w-full text-white" strokeWidth={1.25} />
      </div>
      <PawPrint
        className={`absolute left-4 top-[38%] h-9 w-9 -rotate-12 opacity-[0.06] ${PAW_DECO}`}
        strokeWidth={1.25}
        aria-hidden
      />
      <PawPrint
        className={`absolute right-[28%] top-[22%] h-7 w-7 rotate-12 opacity-[0.05] ${PAW_DECO}`}
        strokeWidth={1.25}
        aria-hidden
      />
      <PawPrint
        className={`absolute bottom-[32%] right-6 h-8 w-8 rotate-[18deg] opacity-[0.06] ${PAW_DECO}`}
        strokeWidth={1.25}
        aria-hidden
      />
      <PawPrint
        className={`absolute bottom-[38%] left-[22%] h-6 w-6 -rotate-6 opacity-[0.05] ${PAW_DECO}`}
        strokeWidth={1.25}
        aria-hidden
      />
    </>
  );
}

/**
 * Payment hero header — same sheet overlap as ServiceDashboardHeader bottomEdge="sheet".
 */
export function PaymentPageHeader({ onBack, stats, className = '' }: PaymentPageHeaderProps) {
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
  const topPadStyle = resolveServiceHeaderTopPad(true, isCapacitorNative, isNarrowMobile);

  const hasStats = stats.length > 0;

  return (
    <header
      className={`relative z-10 w-full shrink-0 overflow-hidden text-white min-h-[260px] sm:min-h-[272px] ${className}`.trim()}
      style={topPadStyle}
    >
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #FF6B1A 0%, #FF7F2A 40%, #FF8C42 75%, #FFA45D 100%)',
        }}
        aria-hidden
      />
      <PaymentHeaderDecorations />

      <div
        className={`relative z-10 flex min-h-[260px] flex-col px-6 pt-7 sm:min-h-[272px] ${
          hasStats ? 'pb-8 sm:pb-9' : 'pb-6 sm:pb-7'
        }`}
      >
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-lg transition active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          ) : null}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.625rem] font-bold leading-tight tracking-tight text-white">Payment</h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm leading-snug text-white/95">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Secure checkout
            </p>
          </div>
        </div>

        {stats.length > 0 ? (
          <div
            className={`mt-6 grid gap-2.5 ${
              stats.length <= 1 ? 'grid-cols-1' : stats.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {stats.map((stat, i) => (
              <div
                key={`${stat.label}-${i}`}
                className="flex min-h-[84px] flex-col items-center justify-center rounded-[20px] border border-white/25 bg-white/20 px-2 py-2.5 text-center shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl"
              >
                <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                  <StatIcon type={stat.icon} />
                </div>
                <p className="w-full truncate text-base font-bold tabular-nums text-white sm:text-lg">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/90">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Cream sheet overlap — curve comes from the sheet, not the orange hero */}
      <div
        className={`pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-10 rounded-t-[32px] shadow-[0_-10px_36px_-8px_rgba(0,0,0,0.12)] ${paymentPageBgClass}`}
        aria-hidden
      />
    </header>
  );
}
