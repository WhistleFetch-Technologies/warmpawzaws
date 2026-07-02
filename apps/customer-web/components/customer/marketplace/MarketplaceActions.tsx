'use client';

import type { ReactNode } from 'react';
import type { MarketplaceAction } from '@/lib/marketplace/types';
import { Button } from '@/components/ui/button';

export function MarketplaceActions({ actions }: { actions: MarketplaceAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant={action.variant === 'outline' ? 'outline' : action.variant === 'secondary' ? 'secondary' : 'default'}
          className={`min-h-11 rounded-xl ${
            action.variant === 'primary' || !action.variant
              ? 'bg-[#FF8C42] hover:bg-[#FF7A35] text-white'
              : ''
          }`}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function MarketplaceActionsRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
