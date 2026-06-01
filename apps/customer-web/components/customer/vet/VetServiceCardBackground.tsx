'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Video,
  Building2,
  Home as HomeIcon,
  FlaskConical,
  Pill,
  Activity,
  Stethoscope,
  Heart,
  MapPin,
  PawPrint,
  Syringe,
  Microscope,
  Phone,
  Clock,
  Navigation,
  TestTube,
  Sparkles,
} from 'lucide-react';

const BG_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none [&>line]:fill-none';

type BgIconSpec = {
  Icon: LucideIcon;
  className: string;
};

const VET_SERVICE_CARD_BACKGROUNDS: Record<
  string,
  { tint: string; icons: BgIconSpec[] }
> = {
  tele: {
    tint: 'text-orange-400',
    icons: [
      { Icon: Video, className: 'absolute -left-0.5 top-10 h-11 w-11 rotate-[14deg] opacity-[0.22]' },
      { Icon: Stethoscope, className: 'absolute left-[28%] top-1 h-8 w-8 -rotate-12 opacity-[0.16]' },
      { Icon: Phone, className: 'absolute left-[8%] bottom-3 h-9 w-9 rotate-[28deg] opacity-[0.18]' },
      { Icon: Clock, className: 'absolute left-[38%] bottom-6 h-7 w-7 -rotate-6 opacity-[0.14]' },
    ],
  },
  clinic: {
    tint: 'text-green-400',
    icons: [
      { Icon: Building2, className: 'absolute -left-1 top-12 h-12 w-12 rotate-6 opacity-[0.2]' },
      { Icon: Stethoscope, className: 'absolute left-[32%] top-2 h-8 w-8 -rotate-[18deg] opacity-[0.16]' },
      { Icon: Heart, className: 'absolute left-[10%] bottom-4 h-8 w-8 rotate-12 opacity-[0.18]' },
      { Icon: PawPrint, className: 'absolute left-[42%] bottom-8 h-6 w-6 -rotate-[24deg] opacity-[0.14]' },
    ],
  },
  home: {
    tint: 'text-orange-400',
    icons: [
      { Icon: HomeIcon, className: 'absolute -left-0.5 top-11 h-11 w-11 -rotate-[8deg] opacity-[0.2]' },
      { Icon: MapPin, className: 'absolute left-[30%] top-3 h-8 w-8 rotate-[16deg] opacity-[0.17]' },
      { Icon: Navigation, className: 'absolute left-[6%] bottom-5 h-9 w-9 -rotate-[20deg] opacity-[0.16]' },
      { Icon: PawPrint, className: 'absolute left-[36%] bottom-2 h-7 w-7 rotate-12 opacity-[0.14]' },
    ],
  },
  lab: {
    tint: 'text-purple-400',
    icons: [
      { Icon: FlaskConical, className: 'absolute -left-0.5 top-10 h-11 w-11 rotate-[10deg] opacity-[0.22]' },
      { Icon: Microscope, className: 'absolute left-[28%] top-2 h-8 w-8 -rotate-12 opacity-[0.16]' },
      { Icon: TestTube, className: 'absolute left-[8%] bottom-4 h-9 w-9 rotate-[22deg] opacity-[0.18]' },
      { Icon: Sparkles, className: 'absolute left-[40%] bottom-7 h-6 w-6 -rotate-6 opacity-[0.14]' },
    ],
  },
  medicine: {
    tint: 'text-pink-400',
    icons: [
      { Icon: Pill, className: 'absolute -left-0.5 top-11 h-11 w-11 rotate-[18deg] opacity-[0.22]' },
      { Icon: Syringe, className: 'absolute left-[30%] top-2 h-8 w-8 -rotate-[14deg] opacity-[0.16]' },
      { Icon: Heart, className: 'absolute left-[10%] bottom-5 h-8 w-8 rotate-8 opacity-[0.17]' },
      { Icon: Sparkles, className: 'absolute left-[38%] bottom-9 h-6 w-6 -rotate-[20deg] opacity-[0.14]' },
    ],
  },
  physiotherapy: {
    tint: 'text-teal-400',
    icons: [
      { Icon: Activity, className: 'absolute -left-0.5 top-10 h-11 w-11 -rotate-[6deg] opacity-[0.22]' },
      { Icon: Heart, className: 'absolute left-[28%] top-3 h-8 w-8 rotate-[14deg] opacity-[0.16]' },
      { Icon: PawPrint, className: 'absolute left-[8%] bottom-4 h-9 w-9 -rotate-[18deg] opacity-[0.17]' },
      { Icon: Stethoscope, className: 'absolute left-[36%] bottom-7 h-7 w-7 rotate-12 opacity-[0.14]' },
    ],
  },
};

interface VetServiceCardBackgroundProps {
  serviceId: string;
}

export function VetServiceCardBackground({ serviceId }: VetServiceCardBackgroundProps) {
  const config = VET_SERVICE_CARD_BACKGROUNDS[serviceId];
  if (!config) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${config.tint}`}
      aria-hidden
    >
      {config.icons.map(({ Icon, className }, i) => (
        <Icon
          key={`${serviceId}-${i}`}
          className={`${BG_ICON} ${className}`}
          strokeWidth={1.25}
        />
      ))}
    </div>
  );
}
