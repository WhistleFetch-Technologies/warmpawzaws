'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ServiceStaffGoLiveManagerProps {
  vendorId: string;
  onBack: () => void;
  onGoLiveComplete?: () => void;
}

interface Service {
  id: string;
  serviceName: string;
  price: number;
  publishStatus: string;
  isEnabled: boolean;
}

interface Staff {
  id: string;
  name: string;
  mobileVerified: boolean;
  isActive: boolean;
}

export function ServiceStaffGoLiveManager({ 
  vendorId, 
  onBack, 
  onGoLiveComplete 
}: ServiceStaffGoLiveManagerProps) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load services
      const servicesResponse = await apiClient.get(`/vendor/${vendorId}/services`) as any;
      if (servicesResponse.success) {
        const allServices: Service[] = [];
        const servicesByStyle = servicesResponse.services || {};
        
        Object.values(servicesByStyle).forEach((styleGroup: any) => {
          if (styleGroup.services && Array.isArray(styleGroup.services)) {
            styleGroup.services.forEach((service: any) => {
              allServices.push({
                id: service.id || service.serviceId,
                serviceName: service.serviceName || service.name,
                price: service.price || service.customPrice || 0,
                publishStatus: service.publishStatus || service.publish_status || 'draft',
                isEnabled: service.isEnabled || service.is_enabled || false,
              });
            });
          }
        });
        
        setServices(allServices);
        // Pre-select draft services
        setSelectedServiceIds(
          allServices
            .filter(s => s.publishStatus === 'draft')
            .map(s => s.id)
        );
      }

      // Load staff
      const staffResponse = await apiClient.get(`/staff/vendor/${vendorId}`) as any;
      if (staffResponse.staff && Array.isArray(staffResponse.staff)) {
        const staffList: Staff[] = staffResponse.staff.map((s: any) => ({
          id: s.id,
          name: s.name || s.fullName,
          mobileVerified: s.mobile_verified || s.mobileVerified || false,
          isActive: s.is_active || s.isActive || false,
        }));
        setStaff(staffList);
        // Pre-select verified but inactive staff
        setSelectedStaffIds(
          staffList
            .filter(s => s.mobileVerified && !s.isActive)
            .map(s => s.id)
        );
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load services and staff');
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };

  const handleBulkPublish = async () => {
    if (selectedServiceIds.length === 0 && selectedStaffIds.length === 0) {
      toast.error('Please select at least one service or staff member');
      return;
    }

    try {
      setPublishing(true);

      // Bulk publish services
      if (selectedServiceIds.length > 0) {
        const publishResponse = await apiClient.post(`/vendor/${vendorId}/services/bulk-publish`, {
          serviceIds: selectedServiceIds,
          publishStatus: 'published',
        }) as any;

        if (!publishResponse.success) {
          throw new Error(publishResponse.error || 'Failed to publish services');
        }
      }

      // Bulk activate staff
      if (selectedStaffIds.length > 0) {
        const activateResponse = await apiClient.post(`/vendor/${vendorId}/staff/bulk-activate`, {
          staffIds: selectedStaffIds,
          activate: true,
        }) as any;

        if (!activateResponse.success) {
          throw new Error(activateResponse.error || 'Failed to activate staff');
        }
      }

      toast.success(`Successfully published ${selectedServiceIds.length} service(s) and activated ${selectedStaffIds.length} staff member(s)`);
      
      // Reload data
      await loadData();
      
      // Clear selections
      setSelectedServiceIds([]);
      setSelectedStaffIds([]);

      if (onGoLiveComplete) {
        onGoLiveComplete();
      }
    } catch (error: any) {
      console.error('Error bulk publishing:', error);
      toast.error(error.message || 'Failed to publish services and activate staff');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FF8C42] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading services and staff...</p>
        </div>
      </div>
    );
  }

  const draftServices = services.filter(s => s.publishStatus === 'draft');
  const publishedServices = services.filter(s => s.publishStatus === 'published');
  const verifiedInactiveStaff = staff.filter(s => s.mobileVerified && !s.isActive);
  const activeStaff = staff.filter(s => s.isActive);

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Go Live Setup</h1>
            <p className="text-sm text-white/90 mt-1">Publish services and activate staff</p>
          </div>
          <button className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Services Status Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            🎯 Services Ready to Publish
          </h2>

          {draftServices.length === 0 && publishedServices.length === 0 ? (
            <p className="text-gray-500 text-sm">No services found. Add services first.</p>
          ) : (
            <div className="space-y-3">
              {/* Published Services */}
              {publishedServices.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{service.serviceName}</div>
                    <div className="text-sm text-gray-600">₹{service.price}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      Published ✓
                    </span>
                  </div>
                </div>
              ))}

              {/* Draft Services */}
              {draftServices.map((service) => (
                <div
                  key={service.id}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                    selectedServiceIds.includes(service.id)
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{service.serviceName}</div>
                    <div className="text-sm text-gray-600">₹{service.price}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                      Draft
                    </span>
                    <button
                      onClick={() => toggleService(service.id)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        selectedServiceIds.includes(service.id)
                          ? 'bg-[#FF8C42]'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          selectedServiceIds.includes(service.id) ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff Status Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            👥 Staff Ready to Activate
          </h2>

          {staff.length === 0 ? (
            <p className="text-gray-500 text-sm">No staff members found. Add staff first.</p>
          ) : (
            <div className="space-y-3">
              {/* Active Staff */}
              {activeStaff.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-600">Mobile Verified ✓</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      Active
                    </span>
                  </div>
                </div>
              ))}

              {/* Verified but Inactive Staff */}
              {verifiedInactiveStaff.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                    selectedStaffIds.includes(member.id)
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-600">Mobile Verified ✓</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStaff(member.id)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        selectedStaffIds.includes(member.id)
                          ? 'bg-[#FF8C42]'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          selectedStaffIds.includes(member.id) ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}

              {/* Unverified Staff */}
              {staff.filter(s => !s.mobileVerified).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-200 opacity-60"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-600">Mobile Pending</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                      Verify →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleBulkPublish}
            disabled={publishing || (selectedServiceIds.length === 0 && selectedStaffIds.length === 0)}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            size="lg"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Publishing...
              </>
            ) : (
              `Publish All & Go Live (${selectedServiceIds.length} services, ${selectedStaffIds.length} staff)`
            )}
          </Button>

          <Button
            onClick={onBack}
            variant="outline"
            className="w-full border-2 border-gray-200 text-gray-700"
          >
            Save as Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
