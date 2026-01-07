'use client';

import { useState } from 'react';
import { Briefcase, TrendingUp, Package, Settings, ArrowLeft, Stethoscope, Ambulance, Microscope } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorBusinessHubProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

export function VendorBusinessHub({ vendorId, vendorData, onBack }: VendorBusinessHubProps) {
  const isVet = vendorData?.roleId?.includes('vet') || vendorData?.serviceCategory === 'veterinary';
  const [activeTab, setActiveTab] = useState(isVet ? 'vet-services' : 'inventory');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-0 text-white">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-0 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-bold">Business Hub</h2>
            <p className="text-white/70 text-sm">
              {isVet ? 'Manage vet services & equipment' : 'Manage inventory & store settings'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-0 mb-4">
          {isVet && (
            <button
              onClick={() => setActiveTab('vet-services')}
              className={`flex-1 px-4 py-0 rounded-lg font-medium flex items-center justify-center gap-0 ${
                activeTab === 'vet-services'
                  ? 'bg-[primary] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Services
            </button>
          )}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 px-4 py-0 rounded-lg font-medium flex items-center justify-center gap-0 ${
              activeTab === 'inventory'
                ? 'bg-[primary] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Package className="w-4 h-4" />
            {isVet ? 'Pharmacy' : 'Inventory'}
          </button>
        </div>

        {activeTab === 'vet-services' && isVet && (
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-0 mb-0">
                <Stethoscope className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Consultation Services</h3>
                  <p className="text-sm text-gray-600">Manage consultation services</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-0 mb-0">
                <Ambulance className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Ambulance Services</h3>
                  <p className="text-sm text-gray-600">Manage ambulance fleet</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-0 mb-0">
                <Microscope className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Diagnostics</h3>
                  <p className="text-sm text-gray-600">Manage diagnostic services</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-0 mb-0">
              <Package className="w-6 h-6 text-orange-600" />
              <div>
                <h3 className="font-semibold text-gray-900">{isVet ? 'Pharmacy' : 'Inventory'}</h3>
                <p className="text-sm text-gray-600">Manage products and stock</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Inventory management interface coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

