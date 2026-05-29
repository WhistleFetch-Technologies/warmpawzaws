'use client';

import { memo, type ReactNode } from 'react';

/** Tailwind classes for the white sheet that curves over the orange home header. */
export const HOME_CONTENT_SHELL_CLASS =
  'relative z-10 -mt-6 rounded-t-[32px] bg-white pt-1 shadow-[0_-6px_24px_-8px_rgba(0,0,0,0.1)] sm:-mt-7 sm:rounded-t-[36px]';

/** White body shell with pronounced top curve overlapping the orange home header. */
function HomeContentShellComponent({ children }: { children: ReactNode }) {
  return <div className={HOME_CONTENT_SHELL_CLASS}>{children}</div>;
}

export const HomeContentShell = memo(HomeContentShellComponent);
