import { Image as ImageIcon } from 'lucide-react';

export function BannerAdmin() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-black text-xl font-semibold">Banner Management</h2>
        <p className="text-gray-500 text-sm mt-1">Manage marketplace banners</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Banner management coming soon</p>
      </div>
    </div>
  );
}
