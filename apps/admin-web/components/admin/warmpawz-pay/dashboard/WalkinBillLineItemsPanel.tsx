'use client';

import { useEffect, useState } from 'react';
import {
  formatWpayInr,
  saveWarmpawzPayPaymentBillLineItems,
  type WpayAdminBillLineItem,
} from '@/lib/warmpawz-pay-payments-admin';

type DraftRow = {
  key: string;
  item: string;
  quantity: string;
  total: string;
};

function toDraft(items: readonly WpayAdminBillLineItem[]): DraftRow[] {
  return items.map((row, index) => ({
    key: `${index}-${row.item}`,
    item: row.item,
    quantity: String(row.quantity),
    total: String(row.total),
  }));
}

function parseDraft(rows: readonly DraftRow[]): WpayAdminBillLineItem[] {
  return rows
    .map((row) => ({
      item: row.item.trim(),
      quantity: Number(row.quantity),
      total: Number(row.total),
    }))
    .filter(
      (row) =>
        row.item.length > 0 &&
        Number.isFinite(row.quantity) &&
        row.quantity > 0 &&
        Number.isFinite(row.total) &&
        row.total >= 0,
    );
}

export function WalkinBillLineItemsPanel({
  paymentId,
  initialItems,
  canEdit,
}: {
  paymentId: string;
  initialItems: readonly WpayAdminBillLineItem[];
  canEdit?: boolean;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => toDraft(initialItems));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRows(toDraft(initialItems));
    setSaved(false);
    setError(null);
  }, [paymentId, initialItems]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${prev.length}`, item: '', quantity: '1', total: '' },
    ]);
    setSaved(false);
  };

  const updateRow = (key: string, field: keyof Omit<DraftRow, 'key'>, value: string) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    setSaved(false);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
    setSaved(false);
  };

  const handleSave = async () => {
    const items = parseDraft(rows);
    if (rows.some((row) => row.item.trim() || row.total.trim()) && items.length !== rows.filter((r) => r.item.trim() || r.total.trim()).length) {
      setError('Each line needs item, quantity, and total');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await saveWarmpawzPayPaymentBillLineItems(paymentId, items);
      setRows(toDraft(next.billLineItems));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save line items');
    } finally {
      setSaving(false);
    }
  };

  const lineTotal = parseDraft(rows).reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Bill line items</p>
        {canEdit ? (
          <button
            type="button"
            onClick={addRow}
            className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-800"
          >
            Add line item
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No line items saved yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_4.5rem_6rem_auto] items-center gap-2">
              <input
                aria-label="Item"
                value={row.item}
                disabled={!canEdit}
                onChange={(e) => updateRow(row.key, 'item', e.target.value)}
                placeholder="Item"
                className="rounded-md border border-gray-200 px-2 py-1 text-sm"
              />
              <input
                aria-label="Quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={row.quantity}
                disabled={!canEdit}
                onChange={(e) => updateRow(row.key, 'quantity', e.target.value)}
                placeholder="Qty"
                className="rounded-md border border-gray-200 px-2 py-1 text-sm"
              />
              <input
                aria-label="Total"
                type="number"
                min="0"
                step="0.01"
                value={row.total}
                disabled={!canEdit}
                onChange={(e) => updateRow(row.key, 'total', e.target.value)}
                placeholder="Total"
                className="rounded-md border border-gray-200 px-2 py-1 text-sm"
              />
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <p className="text-right text-xs text-gray-600">
            Lines total {formatWpayInr(lineTotal)}
          </p>
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm font-medium text-green-700">Saved</p> : null}
      {canEdit ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="mt-3 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save line items'}
        </button>
      ) : null}
    </div>
  );
}
