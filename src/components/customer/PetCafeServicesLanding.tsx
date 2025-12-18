import { useState, useEffect } from 'react';
import { Coffee, ArrowLeft, Info, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { UniversalVendorCard } from './UniversalVendorCard';
// Brand color: #FF8C42

interface PetCafeServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  phone?: string;
}

export function PetCafeServicesLanding({ onBack, onNavigate, phone }: PetCafeServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [cafes, setCafes] = useState<any[]>([]);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCafes();
  }, []);

  const loadCafes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_cafe`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        // Deduplicate vendors
        const uniqueVendors = new Map();
        (data.services || []).forEach((s: any) => {
            if (!uniqueVendors.has(s.vendorId)) {
                uniqueVendors.set(s.vendorId, {
                    id: s.vendorId,
                    name: s.vendorName,
                    address: s.vendorLocation?.address || 'Location unavailable',
                    rating: 4.5,
                    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000'
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
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Cafes</h1>
            <p className="text-white/90 text-sm">Dine with your furry friends</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Pet-Friendly Dining</h2>
              <p className="text-gray-700 mb-4">Special menus for pets & humans alike</p>
              <Button 
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => onNavigate('cafe_reservation')}
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

          {cafes.length === 0 ? (
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
                      onNavigate('cafe_detail', { vendorId });
                  }}
                  onBook={(vendorId) => {
                      onNavigate('cafe_detail', { vendorId });
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
