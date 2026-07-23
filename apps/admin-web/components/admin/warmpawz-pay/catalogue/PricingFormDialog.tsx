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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import type {
  PricingDetail,
  PricingDiscountType,
  PricingStatus,
} from '@/lib/warmpawz-pay-pricing-admin';
import { validatePricingForm } from '@/lib/warmpawz-pay-pricing-admin';

export type PricingFormMode = 'create' | 'edit';

export interface PricingFormValues {
  readonly vendorId: string;
  readonly discountType: PricingDiscountType;
  readonly discountValue: number;
  readonly status: PricingStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
}

export interface PricingFormDialogProps {
  readonly open: boolean;
  readonly mode: PricingFormMode;
  readonly vendorId: string;
  readonly businessName: string;
  readonly initial?: PricingDetail | null;
  readonly loading?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: PricingFormValues) => void;
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function defaultEffectiveFrom(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PricingFormDialog({
  open,
  mode,
  vendorId,
  businessName,
  initial = null,
  loading = false,
  onOpenChange,
  onSubmit,
}: PricingFormDialogProps) {
  const [discountType, setDiscountType] = useState<PricingDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [status, setStatus] = useState<PricingStatus>('active');
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom());
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initial) {
      setDiscountType(initial.discountType);
      setDiscountValue(String(initial.discountValue));
      setStatus(initial.status);
      setEffectiveFrom(toDateInputValue(initial.effectiveFrom));
      setEffectiveUntil(toDateInputValue(initial.effectiveUntil));
    } else if (mode === 'create') {
      setDiscountType('percentage');
      setDiscountValue('10');
      setStatus('active');
      setEffectiveFrom(defaultEffectiveFrom());
      setEffectiveUntil('');
    }

    setValidationError(null);
  }, [open, initial, mode]);

  const title = mode === 'create' ? 'Configure Pricing' : 'Edit Pricing';

  const handleSubmit = () => {
    const parsedValue = Number(discountValue);
    const error = validatePricingForm({
      discountValue: parsedValue,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`).toISOString(),
      effectiveUntil: effectiveUntil
        ? new Date(`${effectiveUntil}T23:59:59.999Z`).toISOString()
        : null,
    });

    if (error) {
      setValidationError(error);
      return;
    }

    onSubmit({
      vendorId,
      discountType,
      discountValue: parsedValue,
      status,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`).toISOString(),
      effectiveUntil: effectiveUntil
        ? new Date(`${effectiveUntil}T23:59:59.999Z`).toISOString()
        : '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Set commercial discount terms for {businessName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Vendor</Label>
            <p className="text-sm text-gray-900">{businessName}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pricing-discount-type">Discount Type</Label>
              <Select
                value={discountType}
                onValueChange={(value) => setDiscountType(value as PricingDiscountType)}
                disabled={loading}
              >
                <SelectTrigger id="pricing-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-discount-value">Discount Value (%)</Label>
              <Input
                id="pricing-discount-value"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as PricingStatus)}
              disabled={loading}
            >
              <SelectTrigger id="pricing-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pricing-effective-from">Effective From</Label>
              <Input
                id="pricing-effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-effective-until">Effective Until</Label>
              <Input
                id="pricing-effective-until"
                type="date"
                value={effectiveUntil}
                onChange={(event) => setEffectiveUntil(event.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {validationError ? (
            <p className="text-sm text-red-600" role="alert">
              {validationError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={handleSubmit}>
            {loading ? 'Saving…' : mode === 'create' ? 'Save Pricing' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
