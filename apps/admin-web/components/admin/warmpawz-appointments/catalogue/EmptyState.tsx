'use client';

import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-gray-100 p-4">
        <Inbox className="h-8 w-8 text-gray-400" />
      </div>
      <div>
        <p className="text-base font-medium text-gray-900">{title}</p>
        {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
      </div>
    </div>
  );
}
