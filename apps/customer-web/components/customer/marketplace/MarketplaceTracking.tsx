'use client';

import type { ReactNode } from 'react';
import { MARKETPLACE_SHELL_CLASS } from '@/lib/marketplace/types';

export function MarketplaceTracking({
  header,
  statusHero,
  timeline,
  children,
  footer,
}: {
  header: ReactNode;
  statusHero: ReactNode;
  timeline?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`${MARKETPLACE_SHELL_CLASS} flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))]`}>
      {header}
      <main className="flex-1 space-y-4 px-4 pt-4">
        {statusHero}
        {timeline}
        {children}
      </main>
      {footer ? <div className="px-4 pb-4">{footer}</div> : null}
    </div>
  );
}
