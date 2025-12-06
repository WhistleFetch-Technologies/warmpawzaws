import { Settings } from 'lucide-react';

export function PolicyManagement() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-black text-xl font-semibold">Policy Management</h2>
        <p className="text-gray-500 text-sm mt-1">Configure marketplace policies and rules</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Policy management coming soon</p>
      </div>
    </div>
  );
}
