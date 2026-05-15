'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface DetailVendorShape {
  id: string;
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  /** Full line aligned with customer profile address */
  location?: string;
  status?: string;
}

interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

export function CustomerDetailsModal({ isOpen, onClose, customerId }: CustomerDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<DetailVendorShape | null>(null);

  useEffect(() => {
    if (!isOpen || !customerId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<any>(`/admin/customers/${customerId}/details`);
        const v = res?.vendor ?? res?.data?.vendor;
        if (!cancelled && v) setVendor(v);
        else if (!cancelled) setVendor(null);
      } catch {
        if (!cancelled) setVendor(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Customer details</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : vendor ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{vendor.businessName || vendor.ownerName || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{vendor.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{vendor.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium text-gray-900 whitespace-pre-wrap break-words">
                  {vendor.location || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">City</dt>
                <dd className="font-medium text-gray-900">{vendor.city || '—'}</dd>
              </div>
              {(vendor.state || vendor.pincode) && (
                <div>
                  <dt className="text-gray-500">State / PIN</dt>
                  <dd className="font-medium text-gray-900">
                    {[vendor.state, vendor.pincode].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900 capitalize">{vendor.status || '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-red-600">Could not load customer.</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
