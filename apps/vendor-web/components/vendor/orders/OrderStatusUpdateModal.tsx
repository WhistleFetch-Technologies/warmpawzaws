'use client';

import { X, Package } from 'lucide-react';
import { useState, useEffect } from 'react';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { buildMarkShippedPayload } from '@/lib/carrier-registry';
import {
  VendorShipmentDetailsForm,
  isShipmentFormValid,
  type VendorShipmentFormValues,
} from '@/components/vendor/orders/VendorShipmentDetailsForm';

interface Order {
  id: string;
  order_number: string;
  order_status: string;
  tracking_number?: string;
}

interface OrderStatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  vendorId?: string;
  onSuccess?: () => void;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['processing', 'cancelled'],
  'processing': ['shipped', 'cancelled'],
  'shipped': ['delivered', 'returned'],
  'delivered': ['returned'],
  'cancelled': [],
  'returned': ['refunded'],
  'refunded': [],
};

const EMPTY_SHIPMENT_FORM: VendorShipmentFormValues = {
  carrierId: '',
  carrierName: '',
  trackingNumber: '',
  trackingUrl: '',
};

export function OrderStatusUpdateModal({
  isOpen,
  onClose,
  order,
  vendorId,
  onSuccess
}: OrderStatusUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [shipmentForm, setShipmentForm] = useState<VendorShipmentFormValues>(EMPTY_SHIPMENT_FORM);
  const [shipmentFormShowErrors, setShipmentFormShowErrors] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [cancellationReason, setCancellationReason] = useState<string>('');

  const availableStatuses = order ? STATUS_TRANSITIONS[order.order_status] || [] : [];

  useEffect(() => {
    if (isOpen && availableStatuses.length > 0) {
      setNewStatus(availableStatuses[0]);
    }
    if (!isOpen) {
      setCancellationReason('');
      setShipmentForm(EMPTY_SHIPMENT_FORM);
      setShipmentFormShowErrors(false);
    }
  }, [isOpen, availableStatuses]);

  const resolveVendorId = (): string | null => {
    if (vendorId) return vendorId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vendorId');
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!order || !newStatus) {
      alert('Please select a status');
      return;
    }

    try {
      setLoading(true);

      if (newStatus === 'shipped') {
        if (order.tracking_number) {
          alert('Tracking already submitted and cannot be changed');
          return;
        }

        if (!isShipmentFormValid(shipmentForm)) {
          setShipmentFormShowErrors(true);
          return;
        }

        const resolvedVendorId = resolveVendorId();
        if (!resolvedVendorId) {
          alert('Vendor session not found');
          return;
        }

        const payload = buildMarkShippedPayload({ ...shipmentForm, notes: notes || undefined });

        const result = await apiClient.post<{ success?: boolean; error?: string }>(
          `/vendor/${resolvedVendorId}/orders/${order.id}/mark-shipped`,
          payload
        );

        if (result?.error || result?.success === false) {
          alert(result?.error || 'Failed to mark order as shipped');
          return;
        }
      } else {
        if (newStatus === 'cancelled' && !cancellationReason.trim()) {
          alert('Please provide a reason for cancellation. The customer will see this message.');
          return;
        }

        const updateData: Record<string, string> = { status: newStatus };
        if (notes) updateData.notes = notes;
        if (newStatus === 'cancelled') {
          updateData.cancellation_reason = cancellationReason.trim();
        }

        const resolvedVendorId = resolveVendorId();
        if (resolvedVendorId) {
          await apiClient.put(`/vendor/${resolvedVendorId}/orders/${order.id}`, updateData);
        } else {
          await apiClient.put(`/orders/${order.id}/status`, updateData);
        }
      }

      alert('Order status updated successfully!');
      onSuccess?.();
      onClose();
      setNewStatus('');
      setShipmentForm(EMPTY_SHIPMENT_FORM);
      setNotes('');
      setCancellationReason('');
    } catch (error: any) {
      console.error('Error updating order status:', error);
      alert(error.message || 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Update Order Status</h3>
              <p className="text-sm text-gray-500">Order #{order.order_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Status
            </label>
            <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 capitalize">
              {order.order_status}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
            >
              <option value="">Select status</option>
              {availableStatuses.map(status => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {newStatus === 'shipped' && order.order_status === 'processing' && !order.tracking_number && (
            <VendorShipmentDetailsForm
              values={shipmentForm}
              onChange={setShipmentForm}
              disabled={loading}
              showErrors={shipmentFormShowErrors}
            />
          )}

          {newStatus === 'cancelled' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Tell the customer why this order is being cancelled..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">This message will be shown to the customer.</p>
            </div>
          ) : (
            newStatus !== 'shipped' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this status update..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                />
              </div>
            )
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              !newStatus ||
              (newStatus === 'cancelled' && !cancellationReason.trim())
            }
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : newStatus === 'cancelled' ? 'Cancel Order' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
