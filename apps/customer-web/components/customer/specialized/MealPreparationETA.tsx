'use client';

/**
 * ============================================================================
 * MEAL PREPARATION ETA COMPONENT
 * ============================================================================
 * 
 * Displays meal preparation ETA with real-time countdown
 * - Shows "Preparing your meal... ETA: X minutes"
 * - Real-time countdown updates
 * - Updates when vendor changes ETA
 * 
 * Fixes GAP-9.3: Preparation ETA Updates
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Clock, Utensils } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface MealPreparationETAProps {
  orderId: string;
  initialETA?: number; // minutes
  onETAClick?: () => void;
}

export function MealPreparationETA({
  orderId,
  initialETA,
  onETAClick,
}: MealPreparationETAProps) {
  const [eta, setEta] = useState<number | null>(initialETA || null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadETA();
    // Poll for ETA updates every 30 seconds
    const interval = setInterval(loadETA, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  useEffect(() => {
    if (eta !== null) {
      setCountdown(eta);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 0) return 0;
          return prev - 1;
        });
      }, 60000); // Update every minute
      return () => clearInterval(countdownInterval);
    }
  }, [eta]);

  const loadETA = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(
        `/nutrition/orders/${orderId}/preparation-eta`
      );
      
      if (response.success && response.eta !== undefined) {
        setEta(response.eta);
      }
    } catch (error: any) {
      console.error('Error loading preparation ETA:', error);
      // Keep current ETA if update fails
    } finally {
      setLoading(false);
    }
  };

  if (eta === null) {
    return null; // Don't show if no ETA
  }

  return (
    <div
      className={`bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200 ${
        onETAClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
      onClick={onETAClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
          <Utensils className="w-6 h-6 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">Preparing your meal...</p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            <span className="text-2xl font-bold text-orange-600">
              {countdown !== null && countdown > 0 ? `${countdown} min` : 'Ready soon!'}
            </span>
          </div>
        </div>
        {loading && (
          <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}

export default MealPreparationETA;
