'use client';

import type { LucideIcon } from 'lucide-react';
import {
  UtensilsCrossed,
  Leaf,
  Carrot,
  Apple,
  PawPrint,
  Salad,
  Calendar,
  Clock,
  CheckSquare,
  ListChecks,
  CalendarDays,
  Sparkles,
  Timer,
  CircleDot,
} from 'lucide-react';

const BG_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none [&>line]:fill-none';

type BgIconSpec = {
  Icon: LucideIcon;
  className: string;
  strokeWidth?: number;
};

type ServiceCardBgConfig = {
  tint: string;
  gradient: string;
  watermark: BgIconSpec;
  icons: BgIconSpec[];
  Pattern: () => JSX.Element;
};

/** Simple outline wheat stalk for diet-themed decoration */
function WheatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22V8" />
      <path d="M12 8c-2-3-5-3.5-6-2s-1 4 2 5.5" />
      <path d="M12 8c2-3 5-3.5 6-2s1 4-2 5.5" />
      <path d="M12 13c-1.5-2.5-4-3-5-1.5s0 3.5 2.5 4.5" />
      <path d="M12 13c1.5-2.5 4-3 5-1.5s0 3.5-2.5 4.5" />
      <path d="M12 18c-1-2-2.5-2.5-3.5-1.5s-.5 2.5 1 3.5" />
      <path d="M12 18c1-2 2.5-2.5 3.5-1.5s.5 2.5-1 3.5" />
    </svg>
  );
}

/** Outline-only corner arcs and dots — diet consultation card frame */
function DietConsultationPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full text-emerald-400"
      viewBox="0 0 200 132"
      preserveAspectRatio="none"
      aria-hidden
    >
      <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.12" />
      <circle cx="18" cy="18" r="22" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.08" />
      <path
        d="M4 48 Q4 4 48 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.1"
      />
      <circle cx="172" cy="112" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <circle cx="185" cy="98" r="4" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.08" />
      <path
        d="M196 80 Q196 128 148 128"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.09"
      />
      <circle cx="95" cy="28" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <circle cx="62" cy="98" r="1.5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
    </svg>
  );
}

/** Sparkles, schedule lines, and outline accents — meal plans card frame */
function MealPlansPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full text-amber-400"
      viewBox="0 0 200 132"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line x1="12" y1="108" x2="52" y2="108" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <line x1="12" y1="114" x2="42" y2="114" stroke="currentColor" strokeWidth="0.4" opacity="0.08" />
      <line x1="148" y1="16" x2="188" y2="16" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <circle cx="184" cy="116" r="14" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.09" />
      <path
        d="M4 36 Q4 4 36 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.08"
      />
      <path
        d="M4 4 L12 4 M4 4 L4 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.1"
      />
      <path
        d="M188 128 L180 128 M188 128 L188 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.1"
      />
      <path
        d="M78 22 L82 14 L86 22 L94 22 L88 28 L90 36 L82 32 L74 36 L76 28 L70 22 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.45"
        opacity="0.1"
      />
      <path
        d="M118 88 L120 84 L122 88 L126 88 L123 91 L124 95 L120 93 L116 95 L117 91 L114 88 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.09"
      />
    </svg>
  );
}

const NUTRITION_SERVICE_CARD_BACKGROUNDS: Record<string, ServiceCardBgConfig> = {
  diet_consultation: {
    tint: 'text-emerald-500',
    gradient: 'from-emerald-100/20 via-transparent to-green-50/10',
    watermark: {
      Icon: UtensilsCrossed,
      className:
        'absolute left-[18%] top-[22%] h-[4.5rem] w-[4.5rem] -rotate-[18deg] opacity-[0.10] sm:h-20 sm:w-20',
      strokeWidth: 1,
    },
    icons: [
      { Icon: Leaf, className: 'absolute left-[6%] top-[8%] h-5 w-5 rotate-[24deg] opacity-[0.10]' },
      { Icon: Carrot, className: 'absolute left-[42%] top-[6%] h-4 w-4 -rotate-12 opacity-[0.09]' },
      { Icon: Apple, className: 'absolute left-[2%] bottom-[28%] h-5 w-5 rotate-[16deg] opacity-[0.10]' },
      { Icon: PawPrint, className: 'absolute left-[34%] bottom-[18%] h-4 w-4 -rotate-[20deg] opacity-[0.09]' },
      { Icon: Salad, className: 'absolute left-[48%] top-[38%] h-4 w-4 rotate-6 opacity-[0.08]' },
      {
        Icon: Leaf,
        className: 'absolute left-[52%] bottom-[32%] h-3.5 w-3.5 -rotate-[32deg] opacity-[0.08]',
      },
      { Icon: PawPrint, className: 'absolute left-[8%] top-[42%] h-3 w-3 rotate-12 opacity-[0.08]' },
    ],
    Pattern: DietConsultationPattern,
  },
  meal_plans: {
    tint: 'text-amber-500',
    gradient: 'from-amber-100/25 via-transparent to-orange-50/10',
    watermark: {
      Icon: Calendar,
      className:
        'absolute left-[16%] top-[20%] h-[4.5rem] w-[4.5rem] -rotate-[12deg] opacity-[0.10] sm:h-20 sm:w-20',
      strokeWidth: 1,
    },
    icons: [
      { Icon: CheckSquare, className: 'absolute left-[5%] top-[10%] h-4 w-4 rotate-6 opacity-[0.10]' },
      { Icon: Clock, className: 'absolute left-[44%] top-[8%] h-4 w-4 -rotate-[14deg] opacity-[0.09]' },
      { Icon: ListChecks, className: 'absolute left-[2%] bottom-[30%] h-5 w-5 rotate-[10deg] opacity-[0.10]' },
      { Icon: CalendarDays, className: 'absolute left-[38%] bottom-[22%] h-4 w-4 -rotate-6 opacity-[0.09]' },
      { Icon: Timer, className: 'absolute left-[50%] top-[36%] h-3.5 w-3.5 rotate-[18deg] opacity-[0.08]' },
      { Icon: CircleDot, className: 'absolute left-[10%] top-[44%] h-3 w-3 opacity-[0.08]' },
      { Icon: Sparkles, className: 'absolute left-[28%] top-[14%] h-3.5 w-3.5 -rotate-12 opacity-[0.09]' },
      { Icon: Sparkles, className: 'absolute left-[46%] bottom-[38%] h-3 w-3 rotate-[22deg] opacity-[0.08]' },
    ],
    Pattern: MealPlansPattern,
  },
};

interface NutritionServiceCardBackgroundProps {
  serviceId: string;
}

export function NutritionServiceCardBackground({ serviceId }: NutritionServiceCardBackgroundProps) {
  const config = NUTRITION_SERVICE_CARD_BACKGROUNDS[serviceId];
  if (!config) return null;

  const { watermark, icons, Pattern } = config;
  const WatermarkIcon = watermark.Icon;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${config.tint}`}
      aria-hidden
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />

      <Pattern />

      <WatermarkIcon
        className={`${BG_ICON} ${watermark.className}`}
        strokeWidth={watermark.strokeWidth ?? 1}
      />

      {serviceId === 'diet_consultation' ? (
        <>
          <WheatIcon className="absolute left-[28%] top-[52%] h-5 w-5 rotate-[8deg] opacity-[0.09]" />
          <WheatIcon className="absolute left-[52%] top-[18%] h-4 w-4 -rotate-[16deg] opacity-[0.08]" />
          <Leaf
            className={`${BG_ICON} absolute left-[22%] bottom-[12%] h-6 w-6 -rotate-[8deg] opacity-[0.09]`}
            strokeWidth={1.25}
          />
        </>
      ) : null}

      {serviceId === 'meal_plans' ? (
        <>
          <svg
            className="absolute left-[24%] bottom-[14%] h-5 w-5 text-amber-500 opacity-[0.09]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 14h16" />
            <path d="M6 18h12" />
            <ellipse cx="12" cy="10" rx="7" ry="3" />
            <path d="M5 10v4" />
            <path d="M19 10v4" />
          </svg>
        </>
      ) : null}

      {icons.map(({ Icon, className, strokeWidth = 1.25 }, i) => (
        <Icon
          key={`${serviceId}-bg-${i}`}
          className={`${BG_ICON} ${className}`}
          strokeWidth={strokeWidth}
        />
      ))}
    </div>
  );
}
