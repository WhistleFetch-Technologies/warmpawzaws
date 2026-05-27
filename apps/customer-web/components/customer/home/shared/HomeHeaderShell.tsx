'use client';

import { memo, type ReactNode } from 'react';
import { PawPrint } from 'lucide-react';

const PAW_MARKS = [
  { className: 'right-[3%] top-[4%] h-14 w-14 rotate-[18deg]', opacity: 'opacity-[0.14]' },
  { className: 'right-[22%] top-[18%] h-9 w-9 -rotate-[10deg]', opacity: 'opacity-[0.10]' },
  { className: 'right-[8%] top-[42%] h-[4.5rem] w-[4.5rem] rotate-[22deg]', opacity: 'opacity-[0.12]' },
  { className: 'left-[38%] top-[52%] h-11 w-11 rotate-[-18deg]', opacity: 'opacity-[0.10]' },
  { className: 'right-[48%] top-[68%] h-8 w-8 rotate-[6deg]', opacity: 'opacity-[0.08]' },
  { className: 'right-[1%] top-[74%] h-12 w-12 rotate-[-14deg]', opacity: 'opacity-[0.11]' },
  { className: 'left-[6%] top-[70%] h-14 w-14 rotate-[28deg]', opacity: 'opacity-[0.09]' },
  { className: 'left-[58%] top-[82%] h-10 w-10 -rotate-[6deg]', opacity: 'opacity-[0.10]' },
  { className: 'right-[32%] top-[88%] h-7 w-7 rotate-[15deg]', opacity: 'opacity-[0.08]' },
] as const;

function HomeHeaderShellComponent({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-[#FF8C42] cw-header-safe-top cw-header-safe-x pb-3 sm:pb-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {PAW_MARKS.map((mark, index) => (
          <PawPrint
            key={index}
            className={`absolute text-white ${mark.className} ${mark.opacity}`}
            strokeWidth={1.25}
          />
        ))}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Unified orange home header background with faded paw decoration. */
export const HomeHeaderShell = memo(HomeHeaderShellComponent);
