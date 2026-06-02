'use client';

import { Button } from '@/components/ui/button';

interface ProfileDangerZoneProps {
  title?: string;
  warningText: string;
  onDelete: () => void;
  deleting?: boolean;
  deleteLabel: string;
}

export function ProfileDangerZone({
  title = 'Danger Zone',
  warningText,
  onDelete,
  deleting = false,
  deleteLabel,
}: ProfileDangerZoneProps) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-5">
      <h3 className="mb-3 text-[15px] font-bold text-red-600">{title}</h3>
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="mb-3 text-sm text-gray-700">{warningText}</p>
        <Button
          onClick={onDelete}
          disabled={deleting}
          className="h-11 w-full rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : deleteLabel}
        </Button>
      </div>
    </div>
  );
}
