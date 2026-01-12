'use client';
export const dynamic = 'force-dynamic';

import { AdminRefundsPage } from '@/components/admin/AdminRefundsPage';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

export default function RefundsPage() {
  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            {/* ✅ FIX: Match wireframe - text-2xl font-bold text-gray-900 */}
            <h1 className="text-2xl font-bold text-gray-900">Refund Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage refund requests and processing</p>
          </div>
        </header>

        {/* Main Content - Match wireframe: max-w-7xl mx-auto p-6 or p-8 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            <AdminRefundsPage />
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}

