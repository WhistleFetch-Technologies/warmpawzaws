import { useState, useEffect } from 'react';
import { Camera, ArrowLeft, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { UniversalVendorCard } from './UniversalVendorCard';

interface PhotographyServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  phone?: string;
}

export function PhotographyServicesLanding({ onBack, onNavigate, phone }: PhotographyServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [photographers, setPhotographers] = useState<any[]>([]);
  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPhotographers();
  }, []);

  const loadPhotographers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_photographer`,
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
                    address: s.vendorLocation?.address || 'Studio / Mobile',
                    rating: 4.9,
                    image: 'https://images.unsplash.com/photo-1551796880-17e3e8c180a4?auto=format&fit=crop&q=80&w=1000'
                });
            }
        });
        setPhotographers(Array.from(uniqueVendors.values()));
      }
    } catch (error) {
      console.error('Error loading photographers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Photography</h1>
            <p className="text-white/90 text-sm">Capture beautiful memories</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Professional Shoots</h2>
              <p className="text-gray-700 mb-4">Studio sessions & outdoor portraits</p>
              <Button className="bg-pink-600 hover:bg-pink-700">Find Photographers</Button>
            </div>
            <div className="text-5xl">📸</div>
          </div>
        </Card>

        <div>
           <h2 className="font-bold text-gray-900 mb-4">Featured Photographers</h2>
           {photographers.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-4xl mb-3">📸</div>
                <p className="text-gray-600 mb-2">No photographers available yet</p>
                <p className="text-gray-500 text-sm">Check back soon!</p>
              </Card>
           ) : (
              <div className="space-y-3">
                  {photographers.map((p, idx) => (
                      <UniversalVendorCard 
                        key={idx}
                        vendor={p}
                        icon="📸"
                        colorClass="from-pink-100 to-rose-100"
                        onViewDetails={() => {}}
                        onBook={() => {
                             // Since photography doesn't have a specialized flow yet, 
                             // maybe just show "Book" which could lead to a generic booking or contact
                             toast.info('Booking flow for photography is generic for now.');
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
