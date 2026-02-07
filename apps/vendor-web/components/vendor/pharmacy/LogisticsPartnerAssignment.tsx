'use client';

/**
 * ============================================================================
 * LOGISTICS PARTNER ASSIGNMENT COMPONENT
 * ============================================================================
 * 
 * Displays and manages logistics partner assignment for pharmacy orders
 * - Shows assigned partner information
 * - Allows manual partner selection
 * - Tracks partner status updates
 * 
 * Fixes GAP-8.3: Logistics Partner Integration
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Truck, Phone, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface LogisticsPartnerAssignmentProps {
  orderId: string;
  pickupAddress: {
    addressLine1: string;
    city: string;
    pincode: string;
    latitude: number;
    longitude: number;
  };
  deliveryAddress: {
    addressLine1: string;
    city: string;
    pincode: string;
    latitude: number;
    longitude: number;
  };
  items: Array<{
    name: string;
    quantity: number;
  }>;
  onPartnerAssigned?: (partnerId: string) => void;
}

interface LogisticsPartner {
  id: string;
  name: string;
  vehicleNumber: string;
  phone: string;
  status: 'available' | 'busy' | 'offline';
  estimatedArrival?: number; // minutes
  rating?: number;
}

export function LogisticsPartnerAssignment({
  orderId,
  pickupAddress,
  deliveryAddress,
  items,
  onPartnerAssigned,
}: LogisticsPartnerAssignmentProps) {
  const [assignedPartner, setAssignedPartner] = useState<LogisticsPartner | null>(null);
  const [availablePartners, setAvailablePartners] = useState<LogisticsPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [showPartnerList, setShowPartnerList] = useState(false);

  useEffect(() => {
    loadPartnerInfo();
  }, [orderId]);

  const loadPartnerInfo = async () => {
    try {
      setLoading(true);
      
      // Get assigned partner
      const assignedRes = await apiClient.get<any>(
        `/pharmacy/orders/${orderId}/logistics-partner`
      );
      
      if (assignedRes.success && assignedRes.partner) {
        setAssignedPartner(assignedRes.partner);
      } else {
        // Load available partners if none assigned
        await loadAvailablePartners();
      }
    } catch (error: any) {
      console.error('Error loading partner info:', error);
      // Try to load available partners
      await loadAvailablePartners();
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePartners = async () => {
    try {
      const lat = pickupAddress.latitude;
      const lng = pickupAddress.longitude;
      
      const response = await apiClient.get<any>(
        `/logistics/partners/available?lat=${lat}&lng=${lng}`
      );
      
      if (response.success && response.partners) {
        setAvailablePartners(response.partners);
      }
    } catch (error: any) {
      console.error('Error loading available partners:', error);
      toast.error('Failed to load available partners');
    }
  };

  const handleAssignPartner = async (partnerId: string) => {
    try {
      setAssigning(true);
      
      const response = await apiClient.post<any>(
        `/pharmacy/orders/${orderId}/assign-logistics`,
        {
          partnerId,
          estimatedPickupTime: new Date(Date.now() + 15 * 60000).toISOString(), // 15 minutes from now
        }
      );
      
      if (response.success) {
        const partner = availablePartners.find(p => p.id === partnerId);
        if (partner) {
          setAssignedPartner(partner);
          setShowPartnerList(false);
          
          // Notify partner
          await apiClient.post(`/logistics/partners/${partnerId}/notify`, {
            orderId,
            pickupAddress,
            deliveryAddress,
            items,
          });
          
          toast.success(`Partner ${partner.name} assigned successfully`);
          onPartnerAssigned?.(partnerId);
        }
      } else {
        throw new Error(response.error || 'Failed to assign partner');
      }
    } catch (error: any) {
      console.error('Error assigning partner:', error);
      toast.error(error.message || 'Failed to assign logistics partner');
    } finally {
      setAssigning(false);
    }
  };

  const handleCallPartner = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Badge className="bg-blue-100 text-blue-700">Assigned</Badge>;
      case 'picked_up':
        return <Badge className="bg-green-100 text-green-700">Picked Up</Badge>;
      case 'on_the_way':
        return <Badge className="bg-amber-100 text-amber-700">On The Way</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-700">Delivered</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-4 border border-gray-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-gray-100 rounded w-32 mb-2 animate-pulse" />
            <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#FF8C42]" />
          Logistics Partner
        </h3>
        {!assignedPartner && (
          <Button
            onClick={() => {
              setShowPartnerList(true);
              loadAvailablePartners();
            }}
            size="sm"
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
          >
            Assign Partner
          </Button>
        )}
      </div>

      {assignedPartner ? (
        <div className="space-y-3">
          {/* Partner Info Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{assignedPartner.name}</h4>
                  <p className="text-sm text-gray-600">Vehicle: {assignedPartner.vehicleNumber}</p>
                  {assignedPartner.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="text-sm text-gray-600">{assignedPartner.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
              {getStatusBadge(assignedPartner.status)}
            </div>

            {/* Contact Actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200">
              <Button
                onClick={() => handleCallPartner(assignedPartner.phone)}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
              <Button
                onClick={() => {
                  // Navigate to tracking
                  window.location.href = `/track/${orderId}`;
                }}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Track
              </Button>
            </div>
          </div>

          {/* Address Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Pickup</div>
              <div className="text-gray-900 font-medium">
                {pickupAddress.addressLine1}, {pickupAddress.city}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">Delivery</div>
              <div className="text-gray-900 font-medium">
                {deliveryAddress.addressLine1}, {deliveryAddress.city}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4">No partner assigned yet</p>
          <Button
            onClick={() => {
              setShowPartnerList(true);
              loadAvailablePartners();
            }}
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
          >
            Assign Partner
          </Button>
        </div>
      )}

      {/* Partner Selection Modal */}
      {showPartnerList && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Select Logistics Partner</h3>
              <button
                onClick={() => setShowPartnerList(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {availablePartners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No available partners at the moment
                </div>
              ) : (
                <div className="space-y-3">
                  {availablePartners.map((partner) => (
                    <div
                      key={partner.id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-[#FF8C42] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#FF8C42] rounded-full flex items-center justify-center">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{partner.name}</h4>
                            <p className="text-sm text-gray-600">{partner.vehicleNumber}</p>
                          </div>
                        </div>
                        <Badge
                          className={
                            partner.status === 'available'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }
                        >
                          {partner.status}
                        </Badge>
                      </div>
                      {partner.estimatedArrival && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <Clock className="w-4 h-4" />
                          ETA: {partner.estimatedArrival} minutes
                        </div>
                      )}
                      <Button
                        onClick={() => handleAssignPartner(partner.id)}
                        disabled={assigning || partner.status !== 'available'}
                        className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
                      >
                        {assigning ? 'Assigning...' : 'Assign Partner'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LogisticsPartnerAssignment;

