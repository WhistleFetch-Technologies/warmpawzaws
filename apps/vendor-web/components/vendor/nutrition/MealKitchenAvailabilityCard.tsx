'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type OffReason = 'closed_today' | 'holiday' | 'kitchen_maintenance' | 'custom';

const REASON_CHIPS: { id: OffReason; label: string }[] = [
  { id: 'closed_today', label: 'Closed today' },
  { id: 'holiday', label: 'Holiday' },
  { id: 'kitchen_maintenance', label: 'Kitchen maintenance' },
  { id: 'custom', label: 'Custom note' },
];

interface AvailabilityState {
  acceptingOrders: boolean;
  reasonCode: OffReason | null;
  customerMessage: string | null;
}

interface MealKitchenAvailabilityCardProps {
  vendorId: string;
}

export function MealKitchenAvailabilityCard({ vendorId }: MealKitchenAvailabilityCardProps) {
  const [state, setState] = useState<AvailabilityState>({
    acceptingOrders: true,
    reasonCode: null,
    customerMessage: null,
  });
  const [customNote, setCustomNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{
        success?: boolean;
        availability?: AvailabilityState;
      }>(`/vendor/${vendorId}/meal-kitchen-availability`);
      if (res?.availability) {
        setState({
          acceptingOrders: res.availability.acceptingOrders !== false,
          reasonCode: (res.availability.reasonCode as OffReason) || null,
          customerMessage: res.availability.customerMessage ?? null,
        });
        if (res.availability.reasonCode === 'custom' && res.availability.customerMessage) {
          setCustomNote(res.availability.customerMessage);
        } else {
          setCustomNote('');
        }
      }
    } catch {
      toast.error('Could not load kitchen status');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = async (next: AvailabilityState, noteOverride?: string) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        acceptingOrders: next.acceptingOrders,
        reasonCode: next.acceptingOrders ? null : next.reasonCode,
        customerMessage: next.acceptingOrders
          ? null
          : next.reasonCode === 'custom'
            ? (noteOverride ?? customNote).trim() || null
            : next.customerMessage,
      };
      const res = await apiClient.put<{ success?: boolean; availability?: AvailabilityState }>(
        `/vendor/${vendorId}/meal-kitchen-availability`,
        payload,
      );
      if (res?.availability) {
        setState({
          acceptingOrders: res.availability.acceptingOrders !== false,
          reasonCode: (res.availability.reasonCode as OffReason) || null,
          customerMessage: res.availability.customerMessage ?? null,
        });
      }
      toast.success(next.acceptingOrders ? 'Accepting new meal orders' : 'New orders paused');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update';
      toast.error(msg);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async () => {
    const nextAccepting = !state.acceptingOrders;
    if (nextAccepting) {
      await persist({ acceptingOrders: true, reasonCode: null, customerMessage: null });
      setCustomNote('');
      return;
    }
    const reason: OffReason = state.reasonCode || 'closed_today';
    await persist({
      acceptingOrders: false,
      reasonCode: reason,
      customerMessage: reason === 'custom' ? customNote.trim() || null : null,
    });
  };

  const onSelectReason = async (reason: OffReason) => {
    setState((s) => ({ ...s, reasonCode: reason, acceptingOrders: false }));
    if (reason !== 'custom') {
      setCustomNote('');
      await persist({ acceptingOrders: false, reasonCode: reason, customerMessage: null });
    }
  };

  const onSaveCustomNote = async () => {
    if (!customNote.trim()) {
      toast.error('Enter a short customer-facing note');
      return;
    }
    await persist(
      { acceptingOrders: false, reasonCode: 'custom', customerMessage: customNote.trim() },
      customNote.trim(),
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
        <div className="h-5 bg-slate-100 rounded w-48 mb-2" />
        <div className="h-10 bg-slate-50 rounded" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        state.acceptingOrders
          ? 'bg-white border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Accepting meal orders</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {state.acceptingOrders
              ? 'Customers can place new orders. Existing deliveries are unchanged.'
              : 'New customer orders are blocked until you turn this back on.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.acceptingOrders}
          disabled={saving}
          onClick={onToggle}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
            state.acceptingOrders ? 'bg-emerald-500' : 'bg-slate-300'
          } ${saving ? 'opacity-60' : ''}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              state.acceptingOrders ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {!state.acceptingOrders && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-medium text-slate-600">Why are you closed? (shown to customers)</p>
          <div className="flex flex-wrap gap-2">
            {REASON_CHIPS.map((chip) => {
              const on = state.reasonCode === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  disabled={saving}
                  onClick={() => onSelectReason(chip.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    on
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {state.reasonCode === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="kitchen-custom-note">
                Customer-facing note (one line)
              </label>
              <div className="flex gap-2">
                <input
                  id="kitchen-custom-note"
                  type="text"
                  maxLength={120}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Closed for inventory restock until tomorrow"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveCustomNote}
                  className="px-3 py-2 text-sm font-medium bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {state.reasonCode && state.reasonCode !== 'custom' && state.customerMessage && (
            <p className="text-xs text-amber-800 bg-amber-100/80 rounded-lg px-3 py-2">
              Customers see: &ldquo;{state.customerMessage}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
