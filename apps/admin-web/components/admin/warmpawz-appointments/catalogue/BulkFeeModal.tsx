'use client';

import React, { useEffect, useState } from 'react';
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

export interface BulkFeeConfirmValues {
  readonly appointmentFee: number;
  readonly appointmentFeeHome: number;
}

export interface BulkFeeModalProps {
  readonly open: boolean;
  readonly selectedCount: number;
  readonly loading?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (fees: BulkFeeConfirmValues) => void;
}

export function BulkFeeModal({
  open,
  selectedCount,
  loading = false,
  onOpenChange,
  onConfirm,
}: BulkFeeModalProps) {
  const [centreFee, setCentreFee] = useState('');
  const [homeFee, setHomeFee] = useState('');

  useEffect(() => {
    if (!open) {
      setCentreFee('');
      setHomeFee('');
    }
  }, [open]);

  const centreValid = isValidAppointmentFee(centreFee);
  const homeValid = homeFee.trim() === '' || isValidAppointmentFee(homeFee);
  const feeValid = centreValid && homeValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set appointment fees</DialogTitle>
          <DialogDescription>
            Apply fees to {selectedCount} selected catalogue{' '}
            {selectedCount === 1 ? 'entry' : 'entries'}. Leave home blank to use the
            centre fee for home bookings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-appointment-fee-centre">Centre fee (₹)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                ₹
              </span>
              <Input
                id="bulk-appointment-fee-centre"
                type="number"
                min={0}
                step={0.01}
                value={centreFee}
                disabled={loading}
                placeholder="499"
                className="bg-white pl-8"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setCentreFee(event.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-appointment-fee-home">Home fee (₹)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                ₹
              </span>
              <Input
                id="bulk-appointment-fee-home"
                type="number"
                min={0}
                step={0.01}
                value={homeFee}
                disabled={loading}
                placeholder="Same as centre"
                className="bg-white pl-8"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setHomeFee(event.target.value)
                }
              />
            </div>
            <p className="text-xs text-gray-500">
              Optional. Non-negative amounts with up to 2 decimal places.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || !feeValid}
            onClick={() => {
              const centre = Number(centreFee);
              onConfirm({
                appointmentFee: centre,
                appointmentFeeHome: homeFee.trim() === '' ? centre : Number(homeFee),
              });
            }}
          >
            {loading ? 'Updating…' : 'Apply fees'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
