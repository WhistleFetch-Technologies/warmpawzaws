'use client';

import { AlertCircle } from 'lucide-react';
import {
  CUSTOM_CARRIER_ID,
  VENDOR_CARRIER_OPTIONS,
  validateShipmentForm,
} from '@/lib/carrier-registry';

export interface VendorShipmentFormValues {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  trackingUrl: string;
}

interface VendorShipmentDetailsFormProps {
  values: VendorShipmentFormValues;
  onChange: (values: VendorShipmentFormValues) => void;
  disabled?: boolean;
  /** When set, show field-level errors (e.g. after submit attempt). */
  showErrors?: boolean;
}

export function VendorShipmentDetailsForm({
  values,
  onChange,
  disabled = false,
  showErrors = false,
}: VendorShipmentDetailsFormProps) {
  const errors = showErrors ? validateShipmentForm(values) : {};
  const selectedCarrier = VENDOR_CARRIER_OPTIONS.find((c) => c.id === values.carrierId);

  const setField = <K extends keyof VendorShipmentFormValues>(key: K, value: VendorShipmentFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Courier Partner *
        </label>
        <select
          value={values.carrierId}
          onChange={(e) => {
            const carrierId = e.target.value;
            const option = VENDOR_CARRIER_OPTIONS.find((c) => c.id === carrierId);
            onChange({
              ...values,
              carrierId,
              carrierName: carrierId === CUSTOM_CARRIER_ID ? values.carrierName : option?.name || '',
            });
          }}
          disabled={disabled}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-60"
        >
          <option value="">Select courier</option>
          {VENDOR_CARRIER_OPTIONS.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
        {errors.carrierId && (
          <p className="mt-1 text-sm text-red-600">{errors.carrierId}</p>
        )}
      </div>

      {values.carrierId === CUSTOM_CARRIER_ID && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Carrier name *
          </label>
          <input
            type="text"
            value={values.carrierName}
            onChange={(e) => setField('carrierName', e.target.value)}
            placeholder="e.g. Fast Cargo Logistics"
            disabled={disabled}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-60"
          />
          {errors.carrierName && (
            <p className="mt-1 text-sm text-red-600">{errors.carrierName}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tracking Number / AWB / Consignment No. *
        </label>
        <input
          type="text"
          value={values.trackingNumber}
          onChange={(e) => setField('trackingNumber', e.target.value)}
          placeholder="e.g. AWB123456789"
          disabled={disabled}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-60"
        />
        {errors.trackingNumber && (
          <p className="mt-1 text-sm text-red-600">{errors.trackingNumber}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Tracking URL <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          value={values.trackingUrl}
          onChange={(e) => setField('trackingUrl', e.target.value)}
          placeholder={
            selectedCarrier?.supportsAutoTrackingUrl
              ? 'Auto-filled from carrier portal + AWB if left blank'
              : 'Paste carrier tracking page URL'
          }
          disabled={disabled}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-60"
        />
        {errors.trackingUrl && (
          <p className="mt-1 text-sm text-red-600">{errors.trackingUrl}</p>
        )}
      </div>

      {showErrors && Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Please fix the errors above before submitting</span>
        </div>
      )}
    </div>
  );
}

export function isShipmentFormValid(values: VendorShipmentFormValues): boolean {
  return Object.keys(validateShipmentForm(values)).length === 0;
}
