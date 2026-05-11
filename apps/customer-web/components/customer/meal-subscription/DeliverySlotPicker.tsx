'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function DeliverySlotPicker({
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs font-medium text-slate-600">Slot start</Label>
        <Input type="time" value={start} onChange={(e) => onStartChange(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs font-medium text-slate-600">Slot end</Label>
        <Input type="time" value={end} onChange={(e) => onEndChange(e.target.value)} className="mt-1" />
      </div>
    </div>
  );
}
