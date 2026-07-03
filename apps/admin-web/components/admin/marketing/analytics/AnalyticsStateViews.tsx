'use client';

import { Loader2, AlertCircle, BarChart3 } from 'lucide-react';
import { Button } from '@warmpawz/ui';

export function AnalyticsLoadingState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-slate-500" role="status">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
      Loading analytics…
    </div>
  );
}

export function AnalyticsErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-amber-600" aria-hidden />
      <p className="max-w-lg text-sm text-amber-900">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function AnalyticsEmptyState({ title = 'No analytics data' }: { title?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-slate-500">
      <BarChart3 className="h-8 w-8 text-slate-300" aria-hidden />
      <p className="font-medium text-slate-700">{title}</p>
      <p className="text-sm">Try widening the date range or changing filters.</p>
    </div>
  );
}
