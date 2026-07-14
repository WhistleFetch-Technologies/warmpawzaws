'use client';

import { Badge } from '@warmpawz/ui';
import { AlertCircle, CloudOff } from 'lucide-react';

export function ApiPendingBanner({
  message = 'Policy runtime API is unreachable. Showing local defaults until the backend is available.',
}: {
  message?: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      role="status"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">Configuration draft mode</p>
        <p className="mt-1 text-amber-800">{message}</p>
      </div>
    </div>
  );
}

export function ComingSoonPanel({
  title,
  description,
  apiPath,
}: {
  title: string;
  description: string;
  apiPath?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <CloudOff className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden />
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">{description}</p>
      {apiPath ? (
        <Badge variant="outline" className="mt-4 font-mono text-xs">
          {apiPath}
        </Badge>
      ) : null}
    </div>
  );
}
