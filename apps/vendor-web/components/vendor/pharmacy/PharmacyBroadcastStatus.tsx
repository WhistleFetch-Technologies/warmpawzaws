'use client';

/**
 * ============================================================================
 * PHARMACY BROADCAST STATUS COMPONENT
 * ============================================================================
 * 
 * Displays radius expansion status for pharmacy order broadcasts
 * - Shows current radius (5km/10km/20km)
 * - Timer countdown for next expansion
 * - Status indicators
 * 
 * Phase: Phase 4 - Pharmacy & Delivery Flow
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Radio, Clock, MapPin, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PharmacyBroadcastStatusProps {
  orderId: string;
  onRadiusExpanded?: (newRadius: number) => void;
}

export function PharmacyBroadcastStatus({ orderId, onRadiusExpanded }: PharmacyBroadcastStatusProps) {
  const [loading, setLoading] = useState(true);
  const [broadcastStatus, setBroadcastStatus] = useState<{
    currentRadius: number;
    expandedAt: string | null;
    totalBroadcasts: number;
    accepted: number;
    pending: number;
    rejected: number;
  } | null>(null);
  const [timeUntilExpansion, setTimeUntilExpansion] = useState<number | null>(null);

  useEffect(() => {
    loadBroadcastStatus();
    const interval = setInterval(loadBroadcastStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  useEffect(() => {
    if (broadcastStatus?.expandedAt) {
      const expansionTime = new Date(broadcastStatus.expandedAt).getTime();
      const nextExpansionTime = expansionTime + 2 * 60 * 1000; // 2 minutes after last expansion
      const now = Date.now();
      
      if (nextExpansionTime > now && broadcastStatus.currentRadius < 20) {
        const timer = setInterval(() => {
          const remaining = Math.max(0, Math.floor((nextExpansionTime - Date.now()) / 1000));
          setTimeUntilExpansion(remaining);
          
          if (remaining === 0 && broadcastStatus.currentRadius < 20) {
            // Auto-expand radius
            expandRadius();
          }
        }, 1000);
        
        return () => clearInterval(timer);
      }
    }
  }, [broadcastStatus]);

  const loadBroadcastStatus = async () => {
    try {
      const response = await apiClient.get(`/pharmacy/orders/${orderId}/broadcast-status`) as any;
      if (response.success) {
        setBroadcastStatus(response.broadcastStatus);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error loading broadcast status:', error);
      setLoading(false);
    }
  };

  const expandRadius = async () => {
    try {
      const response = await apiClient.post(`/pharmacy/orders/${orderId}/expand-radius`, {}) as any;
      if (response.success) {
        toast.success(`Broadcast radius expanded to ${response.newRadius}km`);
        await loadBroadcastStatus();
        if (onRadiusExpanded) {
          onRadiusExpanded(response.newRadius);
        }
      }
    } catch (error: any) {
      console.error('Error expanding radius:', error);
      toast.error('Failed to expand broadcast radius');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#FF8C42] animate-spin" />
        </div>
      </div>
    );
  }

  if (!broadcastStatus) {
    return null;
  }

  const radiusSteps = [
    { km: 5, label: '5km', color: 'bg-green-500' },
    { km: 10, label: '10km', color: 'bg-yellow-500' },
    { km: 20, label: '20km', color: 'bg-orange-500' },
  ];

  const currentStepIndex = radiusSteps.findIndex(s => s.km === broadcastStatus.currentRadius);
  const canExpand = broadcastStatus.currentRadius < 20;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Radio className="w-5 h-5 text-[#FF8C42]" />
          Broadcast Status
        </h3>
        <div className="text-sm text-gray-600">
          {broadcastStatus.totalBroadcasts} pharmacies notified
        </div>
      </div>

      {/* Radius Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {radiusSteps.map((step, index) => (
            <div key={step.km} className="flex-1 flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                  index <= currentStepIndex ? step.color : 'bg-gray-300'
                }`}
              >
                {step.km}
              </div>
              <div className="text-xs text-gray-600 mt-1">{step.label}</div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              currentStepIndex === 0 ? 'bg-green-500' :
              currentStepIndex === 1 ? 'bg-yellow-500' :
              'bg-orange-500'
            }`}
            style={{ width: `${((currentStepIndex + 1) / radiusSteps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Timer */}
      {timeUntilExpansion !== null && canExpand && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <div>
              <div className="text-sm font-medium text-orange-900">
                Next expansion in {Math.floor(timeUntilExpansion / 60)}:{(timeUntilExpansion % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-xs text-orange-600">
                Will expand to {broadcastStatus.currentRadius === 5 ? '10km' : '20km'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{broadcastStatus.accepted}</div>
          <div className="text-xs text-gray-600">Accepted</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{broadcastStatus.pending}</div>
          <div className="text-xs text-gray-600">Pending</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{broadcastStatus.rejected}</div>
          <div className="text-xs text-gray-600">Rejected</div>
        </div>
      </div>
    </div>
  );
}
