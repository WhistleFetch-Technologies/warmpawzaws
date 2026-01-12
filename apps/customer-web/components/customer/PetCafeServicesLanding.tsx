'use client';

/**
 * Pet Cafe Services Landing Page
 * Copied from Figma Design System
 * Source: Warmpawz Ecosystem Development/src/components/customer/PetCafeServicesLanding.tsx
 */

import { useState, useEffect } from 'react';
import { Coffee, ArrowLeft, Info, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { UniversalVendorCard } from './UniversalVendorCard';

interface PetCafeServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PetCafeServicesLanding({ phone, onBack, onNavigate }: PetCafeServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [cafes, setCafes] = useState<any[]>([]);

  useEffect(() => {
    loadCafes();
  }, []);

  const loadCafes = async () => {
    try {
      setLoading(true);
      // Append params to URL query string
      const params = new URLSearchParams({ roleId: 'pet_cafe' });
      const endpoint = `/customer/services${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get<{ data?: { services?: any[] } }>(endpoint);

      if (response?.data?.services) {
        // Deduplicate vendors
        const uniqueVendors = new Map();
        (response.data.services || []).forEach((s: any) => {
          if (!uniqueVendors.has(s.vendorId)) {
            uniqueVendors.set(s.vendorId, {
              id: s.vendorId,
              vendorId: s.vendorId,
              vendorName: s.vendorName,
              vendorLocation: s.vendorLocation?.address || 'Location unavailable',
              vendorRating: s.vendorRating || 4.5,
              vendorReviewCount: s.vendorReviewCount || 0,
              vendorProfileImage: s.vendorProfileImage || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000',
              price: s.price,
              serviceName: s.serviceName,
              description: s.description
            });
          }
        });
        setCafes(Array.from(uniqueVendors.values()));
      }
    } catch (error) {
      console.error('Error loading cafes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Pet Cafes</h1>
            <p className="text-xs text-white/80">Dine & Play with Your Pet</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pet-Friendly Dining</h2>
              <p className="text-gray-700 mb-4">Special menus for pets & humans alike</p>
              <Button 
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => onNavigate?.('cafe_reservation')}
              >
                Book a Table
              </Button>
            </div>
            <div className="text-5xl">☕</div>
          </div>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Top Rated Cafes</h2>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-3"></div>
              <p className="text-gray-600">Loading cafes...</p>
            </Card>
          ) : cafes.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">☕</div>
              <p className="text-gray-600 mb-2">No pet cafes available yet</p>
              <p className="text-gray-500 text-sm">Check back soon!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {cafes.map((cafe, index) => (
                <UniversalVendorCard
                  key={cafe.id || index}
                  vendor={cafe}
                  icon="☕"
                  colorClass="from-orange-100 to-amber-100"
                  onViewDetails={(vendorId) => {
                    onNavigate?.('cafe_detail', { vendorId });
                  }}
                  onBook={(vendorId) => {
                    onNavigate?.('cafe_detail', { vendorId });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
