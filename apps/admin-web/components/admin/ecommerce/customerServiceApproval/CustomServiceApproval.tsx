'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle, XCircle, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export function CustomServiceApproval() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPendingServices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/services?status=pending_approval');
      const rawServices = (data as any).data?.services || (data as any).services || [];
      
      // Map API response (snake_case) to component format (camelCase)
      const mappedServices = rawServices.map((s: any) => ({
        id: s.id,
        serviceName: s.service_name || s.name || 'Unnamed Service',
        categoryName: s.category || s.category_name || 'Uncategorized',
        vendorName: s.vendor_name || s.business_name || 'Unknown Vendor',
        price: parseFloat(s.price || s.base_price || 0),
        serviceId: s.service_id,
        vendorId: s.vendor_id,
        description: s.description || s.custom_description,
        serviceStyle: s.service_style,
        duration: s.duration_minutes,
        publishStatus: s.publish_status,
      }));
      
      setServices(mappedServices);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingServices();
  }, [loadPendingServices]);

  const handleApprove = async (serviceId: string) => {
    try {
      await apiClient.put(`/admin/ecommerce/service/${serviceId}`, { status: 'active' });
      toast.success('Service approved');
      loadPendingServices();
    } catch (error) {
      toast.error('Failed to approve service');
    }
  };

  const handleReject = async (serviceId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await apiClient.put(`/admin/ecommerce/service/${serviceId}`, {
        status: 'rejected',
        rejectionReason: reason,
      });
      toast.success('Service rejected');
      loadPendingServices();
    } catch (error) {
      toast.error('Error rejecting service');
    }
  };

  return (
    <div className="relative">
      {/* Loading overlay - only show when actively loading */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading services...</p>
          </div>
        </div>
      )}
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-black text-xl font-semibold">Service Approval</h2>
        <p className="text-gray-500 text-sm mt-1">
          Review and approve pending custom services
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No pending services</p>
                  </td>
                </tr>
              ) : (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-black">{service.serviceName || 'Unnamed Service'}</p>
                        <p className="text-xs text-gray-500">{service.categoryName || 'Uncategorized'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{service.vendorName || 'Unknown Vendor'}</td>
                    <td className="px-6 py-4 text-gray-600">₹{service.price || 0}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(service.id)}
                          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReject(service.id)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
}

