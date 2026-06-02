'use client';

import { type ReactNode } from 'react';

interface ProfileMenuFloatingSheetProps {
  children: ReactNode;
}

/**
 * Menu content wrapper that sits in the header sheet overlap zone (home-style rounded shell).
 */
export function ProfileMenuFloatingSheet({ children }: ProfileMenuFloatingSheetProps) {
  return (
    <div className="relative bg-[#F5F5F5] px-3 pb-3 pt-2">
      {children}
    </div>
  );
}
