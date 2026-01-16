'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface BookingRules {
  general: {
    maxAdvanceBookingDays: number;
    minAdvanceBookingHours: number;
    maxConcurrentBookings: number;
    allowSameDayBooking: boolean;
  };
  cancellation: {
    allowCancellation: boolean;
    cancellationWindowHours: number;
    refundPercentage: number;
    penaltyAmount: number;
  };
  modification: {
    allowModification: boolean;
    modificationWindowHours: number;
    maxModificationsAllowed: number;
  };
  payment: {
    requireFullPayment: boolean;
    advancePaymentPercentage: number;
    paymentDueHours: number;
  };
}

export function BookingRulesManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<BookingRules>({
    general: {
      maxAdvanceBookingDays: 90,
      minAdvanceBookingHours: 2,
      maxConcurrentBookings: 5,
      allowSameDayBooking: true,
    },
    cancellation: {
      allowCancellation: true,
      cancellationWindowHours: 24,
      refundPercentage: 80,
      penaltyAmount: 0,
    },
    modification: {
      allowModification: true,
      modificationWindowHours: 12,
      maxModificationsAllowed: 2,
    },
    payment: {
      requireFullPayment: false,
      advancePaymentPercentage: 50,
      paymentDueHours: 24,
    },
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/settings/booking-rules');
      if (data.success && data.rules) {
        setRules(data.rules);
      }
    } catch (error) {
      console.error('Error loading booking rules:', error);
      alert('Failed to load booking rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = await apiClient.put<any>('/admin/settings/booking-rules', { rules });
      
      if (data.success) {
        alert('Booking rules saved successfully');
      } else {
        alert(data.error || 'Failed to save rules');
      }
    } catch (error) {
      console.error('Error saving rules:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (section: keyof BookingRules, field: string, value: any) => {
    setRules(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-0 bg-blue-100 rounded-xl">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Booking Rules Management</h1>
            <p className="text-sm text-gray-600">Configure booking policies and rules</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">General Rules</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Max Advance Booking (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={rules.general.maxAdvanceBookingDays}
                  onChange={(e) => updateRule('general', 'maxAdvanceBookingDays', parseInt(e.target.value))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Min Advance Booking (Hours)</label>
                <input
                  type="number"
                  min="0"
                  value={rules.general.minAdvanceBookingHours}
                  onChange={(e) => updateRule('general', 'minAdvanceBookingHours', parseInt(e.target.value))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Max Concurrent Bookings</label>
              <input
                type="number"
                min="1"
                value={rules.general.maxConcurrentBookings}
                onChange={(e) => updateRule('general', 'maxConcurrentBookings', parseInt(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rules.general.allowSameDayBooking}
                onChange={(e) => updateRule('general', 'allowSameDayBooking', e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Allow Same-Day Booking</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Cancellation Rules</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rules.cancellation.allowCancellation}
                onChange={(e) => updateRule('cancellation', 'allowCancellation', e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Allow Cancellation</span>
            </label>
            {rules.cancellation.allowCancellation && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Cancellation Window (Hours)</label>
                    <input
                      type="number"
                      min="0"
                      value={rules.cancellation.cancellationWindowHours}
                      onChange={(e) => updateRule('cancellation', 'cancellationWindowHours', parseInt(e.target.value))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Refund Percentage (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={rules.cancellation.refundPercentage}
                      onChange={(e) => updateRule('cancellation', 'refundPercentage', parseInt(e.target.value))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Penalty Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={rules.cancellation.penaltyAmount}
                      onChange={(e) => updateRule('cancellation', 'penaltyAmount', parseInt(e.target.value))}
                      className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Modification Rules</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rules.modification.allowModification}
                onChange={(e) => updateRule('modification', 'allowModification', e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Allow Modification</span>
            </label>
            {rules.modification.allowModification && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Modification Window (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={rules.modification.modificationWindowHours}
                    onChange={(e) => updateRule('modification', 'modificationWindowHours', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Max Modifications Allowed</label>
                  <input
                    type="number"
                    min="1"
                    value={rules.modification.maxModificationsAllowed}
                    onChange={(e) => updateRule('modification', 'maxModificationsAllowed', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Payment Rules</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rules.payment.requireFullPayment}
                onChange={(e) => updateRule('payment', 'requireFullPayment', e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Require Full Payment Upfront</span>
            </label>
            {!rules.payment.requireFullPayment && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Advance Payment (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={rules.payment.advancePaymentPercentage}
                    onChange={(e) => updateRule('payment', 'advancePaymentPercentage', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Payment Due (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={rules.payment.paymentDueHours}
                    onChange={(e) => updateRule('payment', 'paymentDueHours', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
