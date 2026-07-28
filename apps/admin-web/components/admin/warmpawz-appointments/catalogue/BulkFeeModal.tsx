'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@warmpawz/ui';
import { isValidAppointmentFee } from '@/lib/warmpawz-appointments-catalogue-admin';

export interface BulkFeeModalProps {
  readonly open: boolean;
  readonly selectedCount: number;
  readonly loading?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (appointmentFee: number) => void;
}

export function BulkFeeModal({
  open,
  selectedCount,
  loading = false,
  onOpenChange,
  onConfirm,
}: BulkFeeModalProps) {
  const [feeInput, setFeeInput] = useState('');

  useEffect(() => {
    if (!open) {
      setFeeInput('');
    }
  }, [open]);

  const feeValid = isValidAppointmentFee(feeInput);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set appointment fee</DialogTitle>
          <DialogDescription>
            Apply the same appointment fee (₹) to {selectedCount} selected catalogue{' '}
            {selectedCount === 1 ? 'entry' : 'entries'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bulk-appointment-fee">Appointment fee (₹)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              ₹
            </span>
            <Input
              id="bulk-appointment-fee"
              type="number"
              min={0}
              step={0.01}
              value={feeInput}
              disabled={loading}
              placeholder="499"
              className="bg-white pl-8"
              onChange={(event) => setFeeInput(event.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500">Enter a non-negative amount with up to 2 decimal places.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || !feeValid}
            onClick={() => onConfirm(Number(feeInput))}
          >
            {loading ? 'Updating…' : 'Apply fee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
