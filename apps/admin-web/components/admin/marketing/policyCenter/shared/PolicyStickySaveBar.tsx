'use client';

import { Button } from '@warmpawz/ui';
import { Download, RotateCcw, Save } from 'lucide-react';

export function PolicyStickySaveBar({
  isDirty,
  saving,
  onSave,
  onReset,
  onExport,
}: {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
}) {
  if (!isDirty) return null;

  return (
    <div
      className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
      role="region"
      aria-label="Unsaved policy changes"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          You have unsaved configuration changes. Save draft before leaving this page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
            Export
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
            Reset
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" aria-hidden />
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
        </div>
      </div>
    </div>
  );
}
