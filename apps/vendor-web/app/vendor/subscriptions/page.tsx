'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { fetchVendorMealSubscriptionsOverview } from '@/lib/meal-subscription-vendor-api';
import { Loader2 } from 'lucide-react';

export default function VendorMealSubscriptionsOverviewPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const vid = localStorage.getItem('vendorId');
    if (!vid) {
      router.push('/auth');
      return;
    }
    setVendorId(vid);
  }, [router]);

  useEffect(() => {
    if (!vendorId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await fetchVendorMealSubscriptionsOverview(vendorId);
        setRows(res.subscriptions || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId]);

  if (!vendorId || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <VendorHeader title="Subscription overview" subtitle="Canonical meal_subscriptions" />
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-center text-slate-500 py-12">No recurring meal subscriptions for this vendor.</p>
        ) : (
          rows.map((s) => (
            <button
              key={String(s.id)}
              type="button"
              onClick={() => router.push('/vendor/deliveries')}
              className="w-full text-left rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-orange-200 transition"
            >
              <p className="font-bold text-slate-900">{String(s.meal_plan_name || 'Plan')}</p>
              <p className="text-xs text-slate-500 mt-1">
                {String(s.lifecycle_status || s.status)} · Next {String(s.next_delivery_date || '—')}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
