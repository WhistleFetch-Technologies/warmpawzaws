'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { UnifiedAdminRefundHub } from '@/components/admin/refunds/UnifiedAdminRefundHub';

export function RefundsPageContent() {
  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Refund Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Unified hub for booking, meal, and package refunds (excludes shop orders)
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            <UnifiedAdminRefundHub />
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
