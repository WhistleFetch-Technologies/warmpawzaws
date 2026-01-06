'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Package } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { VendorServiceCatalogView } from './VendorServiceCatalogView';
import { VendorCustomServiceCreation } from './VendorCustomServiceCreation';

interface VendorServiceManagementCompleteProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
  fromStaffManagement?: boolean;
}

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

export function VendorServiceManagementComplete({ 
  vendorId, 
  vendorData, 
  onBack,
  fromStaffManagement
}: VendorServiceManagementCompleteProps) {
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<ServiceStyle[]>([]);
  const [loadingRoleConfig, setLoadingRoleConfig] = useState(true);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(null);
  const [roleConfig, setRoleConfig] = useState<any>(null);
  const [showCustomServices, setShowCustomServices] = useState(false);
  const [showCatalogView, setShowCatalogView] = useState(false);

  useEffect(() => {
    loadRoleConfiguration();
  }, [vendorId]);

  const loadRoleConfiguration = async () => {
    try {
      setLoadingRoleConfig(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/allowed-service-styles`);
      if (response.success && Array.isArray(response.allowedStyles)) {
        setAllowedServiceStyles(response.allowedStyles);
        setRoleConfig(response.roleConfig);
      } else {
        setAllowedServiceStyles([]);
      }
    } catch (error) {
      console.error('Error loading role configuration:', error);
      setAllowedServiceStyles([]);
    } finally {
      setLoadingRoleConfig(false);
    }
  };

  const getStyleIcon = (style: ServiceStyle) => {
    switch (style) {
      case 'at_home': return '🏠';
      case 'at_center': return '🏥';
      case 'tele': return '📱';
    }
  };

  const getStyleName = (style: ServiceStyle) => {
    switch (style) {
      case 'at_home': return 'Home Services';
      case 'at_center': return 'Book at Clinic';
      case 'tele': return 'Tele Consultation';
    }
  };

  const getStyleDescription = (style: ServiceStyle) => {
    switch (style) {
      case 'at_home': return 'Services delivered at customer\'s home';
      case 'at_center': return 'Services at your clinic/center';
      case 'tele': return 'Online consultation services';
    }
  };

  if (showCustomServices) {
    return (
      <VendorCustomServiceCreation
        vendorId={vendorId}
        vendorData={vendorData}
        serviceStyle={vendorData?.serviceStyle}
        onClose={() => setShowCustomServices(false)}
        onServiceCreated={() => {
          alert('✅ Custom service created!');
        }}
      />
    );
  }

  if (showCatalogView) {
    return (
      <VendorServiceCatalogView
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => setShowCatalogView(false)}
        mode="multi-select"
        onSelectService={(service) => {
          setSelectedServiceStyle(service.serviceStyle);
          setShowCatalogView(false);
        }}
      />
    );
  }

  if (loadingRoleConfig) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  const canCreateCustomServices = vendorData?.serviceStyle === 'at_center' || vendorData?.serviceStyle === 'both';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        <div className="p-4 bg-white border-b sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">Service Management</h1>
              <p className="text-xs text-gray-500">{vendorData?.business_name || vendorData?.fullName}</p>
            </div>
          </div>
        </div>

        {fromStaffManagement && (
          <div className="mx-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm">ℹ️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Enable Services First</h3>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Select a service type below and enable the services you want to offer. After enabling services, click the back button to return to Staff Management and assign them to your team members.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Select Service Type</h2>
            <p className="text-sm text-gray-600 mb-4">Choose how you want to deliver services</p>
          </div>

          {allowedServiceStyles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No service styles available for your role</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allowedServiceStyles.map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedServiceStyle(style)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-[#FF8C42] transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{getStyleIcon(style)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{getStyleName(style)}</h3>
                      <p className="text-sm text-gray-600 mt-1">{getStyleDescription(style)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowCatalogView(true)}
              className="w-full p-4 bg-[#FF8C42] text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Browse Service Catalog
            </button>
          </div>

          {canCreateCustomServices && (
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowCustomServices(true)}
                className="w-full p-4 border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Package className="w-5 h-5" />
                Create Custom Service
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

