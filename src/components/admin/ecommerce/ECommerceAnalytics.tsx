import { BarChart3 } from 'lucide-react';

export function ECommerceAnalytics() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-black text-xl font-semibold">E-Commerce Analytics</h2>
        <p className="text-gray-500 text-sm mt-1">Platform performance and insights</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Analytics dashboard coming soon</p>
      </div>
    </div>
  );
}
