import { useState, useEffect } from 'react';
import { Plane, ArrowLeft, Truck, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { UniversalVendorCard } from './UniversalVendorCard';
import { toast } from 'sonner@2.0.3';

interface RelocationServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  phone?: string;
}

export function RelocationServicesLanding({ onBack, onNavigate, phone }: RelocationServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [movers, setMovers] = useState<any[]>([]);
  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadMovers();
  }, []);

  const loadMovers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_relocation`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const uniqueVendors = new Map();
        (data.services || []).forEach((s: any) => {
            if (!uniqueVendors.has(s.vendorId)) {
                uniqueVendors.set(s.vendorId, {
                    id: s.vendorId,
                    name: s.vendorName,
                    address: s.vendorLocation?.address || 'International / Domestic',
                    rating: 4.7,
                    image: 'https://images.unsplash.com/photo-1524511751214-b0a384dd9cfe?auto=format&fit=crop&q=80&w=1000'
                });
            }
        });
        setMovers(Array.from(uniqueVendors.values()));
      }
    } catch (error) {
      console.error('Error loading movers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-sky-600 to-blue-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Relocation</h1>
            <p className="text-white/90 text-sm">Moving your pets safely</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-gradient-to-br from-sky-50 to-blue-50 border-sky-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Safe Travel</h2>
              <p className="text-gray-700 mb-4">Domestic & International pet transport services.</p>
              <Button className="bg-sky-600 hover:bg-sky-700">Get a Quote</Button>
            </div>
            <div className="text-5xl">✈️</div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center hover:bg-sky-50 cursor-pointer">
                <div className="text-3xl mb-2">🚛</div>
                <h3 className="font-bold text-gray-900">Domestic</h3>
                <p className="text-xs text-gray-500">Inter-city by Road/Rail</p>
            </Card>
            <Card className="p-4 text-center hover:bg-sky-50 cursor-pointer">
                <div className="text-3xl mb-2">✈️</div>
                <h3 className="font-bold text-gray-900">International</h3>
                <p className="text-xs text-gray-500">Export & Import</p>
            </Card>
        </div>

        <div>
           <h2 className="font-bold text-gray-900 mb-4">Relocation Specialists</h2>
           {movers.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-4xl mb-3">🌍</div>
                <p className="text-gray-600 mb-2">No relocation services available yet</p>
                <p className="text-gray-500 text-sm">Check back soon!</p>
              </Card>
           ) : (
              <div className="space-y-3">
                  {movers.map((m, idx) => (
                      <UniversalVendorCard 
                        key={idx}
                        vendor={m}
                        icon="🌍"
                        colorClass="from-sky-100 to-blue-100"
                        onViewDetails={() => {}}
                        onBook={() => toast.info('Contact for quote feature coming soon')}
                      />
                  ))}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
