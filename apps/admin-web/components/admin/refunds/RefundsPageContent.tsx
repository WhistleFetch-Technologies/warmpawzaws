'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminRefundsPage } from '@/components/admin/AdminRefundsPage';
import { MealLogisticsRefundCases } from '@/components/admin/refunds/MealLogisticsRefundCases';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

type RefundsTab = 'requests' | 'meal-logistics';

export function RefundsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState<RefundsTab>(
    tabParam === 'meal-logistics' ? 'meal-logistics' : 'requests',
  );

  useEffect(() => {
    if (tabParam === 'meal-logistics') setTab('meal-logistics');
    else if (tabParam === 'requests' || !tabParam) setTab('requests');
  }, [tabParam]);

  const selectTab = useCallback(
    (next: RefundsTab) => {
      setTab(next);
      const qs = next === 'meal-logistics' ? '?tab=meal-logistics' : '';
      router.replace(`/refunds${qs}`, { scroll: false });
    },
    [router],
  );

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Refund Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Booking and order refund requests · meal logistics review queue
            </p>
            <nav
              className="mt-4 flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto"
              aria-label="Refund sections"
            >
              <button
                type="button"
                onClick={() => selectTab('requests')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  tab === 'requests'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Refund requests
              </button>
              <button
                type="button"
                onClick={() => selectTab('meal-logistics')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  tab === 'meal-logistics'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Meal logistics refund cases
              </button>
            </nav>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            {tab === 'requests' ? <AdminRefundsPage /> : <MealLogisticsRefundCases />}
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
