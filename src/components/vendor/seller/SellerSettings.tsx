import { useState } from 'react';
import { Store, MapPin, Phone, Mail, FileText, CreditCard } from 'lucide-react';

interface SellerSettingsProps {
  sellerId: string;
  sellerData: any;
}

export function SellerSettings({ sellerId, sellerData }: SellerSettingsProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-black">Store Settings</h1>
        <p className="text-gray-500 mt-1">Manage your store information and preferences</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Business Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="font-semibold text-black">Business Information</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
              <input
                type="text"
                defaultValue={sellerData.businessName || sellerData.fullName}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
              <input
                type="text"
                defaultValue={sellerData.gstNumber || 'Not provided'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="text"
                defaultValue={sellerData.phone}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Store Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="font-semibold text-black">Store Details</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Store Address</label>
              <textarea
                defaultValue={sellerData.address || 'Not provided'}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                defaultValue={sellerData.email || 'Not provided'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                readOnly
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> To update your business information, please contact support.
        </p>
      </div>
    </div>
  );
}
