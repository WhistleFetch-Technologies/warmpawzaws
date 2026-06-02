'use client';

import { Button } from '@/components/ui/button';

interface ProfileStickySaveBarProps {
  onSave: () => void;
  saving?: boolean;
  label?: string;
}

export function ProfileStickySaveBar({
  onSave,
  saving = false,
  label = 'Save changes',
}: ProfileStickySaveBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center">
      <div className="pointer-events-auto w-full max-w-customer border-t border-slate-200 bg-white px-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5">
        <Button
          onClick={onSave}
          disabled={saving}
          className="h-12 w-full rounded-xl bg-[#FF8C42] text-white hover:bg-[#FF7A2E] disabled:opacity-50"
        >
          {saving ? 'Saving...' : label}
        </Button>
      </div>
    </div>
  );
}
