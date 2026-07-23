'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useVendorCandidates } from '@/hooks/warmpawz-pay/useCatalogue';
import type {
  PricingDetail,
  PricingDiscountType,
  PricingStatus,
} from '@/lib/warmpawz-pay-pricing-admin';
import { validatePricingForm } from '@/lib/warmpawz-pay-pricing-admin';

export type PricingFormMode = 'create' | 'edit' | 'view';

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
  initial = null,
  loading = false,
  onOpenChange,
  onSubmit,
}: PricingFormDialogProps) {
  const readOnly = mode === 'view';
  const [vendorId, setVendorId] = useState('');
  const [discountType, setDiscountType] = useState<PricingDiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [status, setStatus] = useState<PricingStatus>('active');
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom());
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [merchantSearch, setMerchantSearch] = useState('');

  const candidateParams = useMemo(
    () => ({
      page: 1,
      pageSize: 20,
      q: merchantSearch || undefined,
    }),
    [merchantSearch],
  );

  const { data: candidatesData } = useVendorCandidates(candidateParams);
  const candidates = candidatesData?.items ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initial) {
      setVendorId(initial.vendorId);
      setDiscountType(initial.discountType);
      setDiscountValue(String(initial.discountValue));
      setStatus(initial.status);
      setEffectiveFrom(toDateInputValue(initial.effectiveFrom));
      setEffectiveUntil(toDateInputValue(initial.effectiveUntil));
    } else if (mode === 'create') {
      setVendorId('');
      setDiscountType('percentage');
      setDiscountValue('10');
      setStatus('active');
      setEffectiveFrom(defaultEffectiveFrom());
      setEffectiveUntil('');
    }

    setValidationError(null);
  }, [open, initial, mode]);

  const title =
    mode === 'create'
      ? 'Create Pricing'
      : mode === 'edit'
        ? 'Edit Pricing'
        : 'View Pricing';

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

    if (mode === 'create' && !vendorId) {
      setValidationError('Select a merchant.');
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
            Configure commercial discount terms for Quote Engine consumption.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'create' ? (
            <div className="space-y-2">
              <Label htmlFor="pricing-merchant-search">Search merchant</Label>
              <Input
                id="pricing-merchant-search"
                value={merchantSearch}
                onChange={(event) => setMerchantSearch(event.target.value)}
                placeholder="Search catalogue merchants..."
                disabled={readOnly || loading}
              />
              <Label htmlFor="pricing-merchant">Merchant</Label>
              <Select value={vendorId} onValueChange={setVendorId} disabled={readOnly || loading}>
                <SelectTrigger id="pricing-merchant">
                  <SelectValue placeholder="Select merchant" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.vendorId} value={candidate.vendorId}>
                      {candidate.businessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Merchant</Label>
              <p className="text-sm text-gray-900">
                {initial?.businessName ?? '—'} ({initial?.merchantName ?? '—'})
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pricing-discount-type">Discount Type</Label>
              <Select
                value={discountType}
                onValueChange={(value) => setDiscountType(value as PricingDiscountType)}
                disabled={readOnly || loading}
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
                disabled={readOnly || loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricing-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as PricingStatus)}
              disabled={readOnly || loading}
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
                disabled={readOnly || loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-effective-until">Effective Until</Label>
              <Input
                id="pricing-effective-until"
                type="date"
                value={effectiveUntil}
                onChange={(event) => setEffectiveUntil(event.target.value)}
                disabled={readOnly || loading}
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
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly ? (
            <Button type="button" disabled={loading} onClick={handleSubmit}>
              {loading ? 'Saving…' : mode === 'create' ? 'Create Pricing' : 'Save Changes'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
