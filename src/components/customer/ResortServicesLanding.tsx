import { useState, useEffect } from 'react';
import { Palmtree, Waves, Sparkles, ArrowLeft, Star, MapPin, Camera, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { UniversalVendorCard } from './UniversalVendorCard';

interface ResortServicesLandingProps {
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  phone?: string;
}

export function ResortServicesLanding({ onBack, onNavigate, phone }: ResortServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [resorts, setResorts] = useState<any[]>([]);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadResorts();
  }, []);

  const loadResorts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_resort`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setResorts(data.services || []);
      }
    } catch (error) {
      console.error('Error loading resorts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50">
      <div className="bg-[#FF8C42] gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#FF8C42] white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Resorts</h1>
            <p className="text-white/90 text-sm">Luxury vacation for your pets</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-[#FF8C42] gradient-to-br from-teal-50 to-cyan-50 border-teal-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">5-Star Pet Experience</h2>
              <p className="text-gray-700 mb-4">Spa, pool, gourmet meals & more</p>
              <Button className="bg-teal-600 hover:bg-[#FF8C42] teal-700">Explore Resorts</Button>
            </div>
            <div className="text-5xl">🏝️</div>
          </div>
        </Card>

        <div>
          <h2 className="font-bold text-gray-900 mb-4">Resort Packages</h2>
          <div className="space-y-3">
            {[
              { icon: '🌊', title: 'Weekend Getaway', price: '₹3,999/day', features: ['Pool access', 'Spa session'] },
              { icon: '💎', title: 'Luxury Suite', price: '₹7,999/day', features: ['Private suite', 'Gourmet meals', '24/7 care'] },
              { icon: '🎉', title: 'Birthday Package', price: '₹12,999', features: ['Party setup', 'Cake', 'Photoshoot'] }
            ].map((pkg, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-[#FF8C42] gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center text-2xl">
                    {pkg.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{pkg.title}</h3>
                    <p className="text-teal-600 font-bold mb-2">{pkg.price}</p>
                    {pkg.features.map((f, i) => (
                      <div key={i} className="text-sm text-gray-600">• {f}</div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Luxury Pet Resorts</h2>
            <button className="text-teal-600 text-sm font-medium flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {resorts.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🏝️</div>
              <p className="text-gray-600 mb-2">No pet resorts available yet</p>
              <p className="text-gray-500 text-sm">Check back soon for luxury pet resort experiences!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {resorts.map((resort, index) => (
                <UniversalVendorCard
                  key={resort.id || index}
                  vendor={resort}
                  icon="🏝️"
                  colorClass="from-teal-100 to-cyan-100"
                  onViewDetails={(vendorId) => {
                    console.log('View resort details:', vendorId);
                    // TODO: Navigate to resort profile with gallery
                  }}
                  onBook={(vendorId) => {
                    console.log('Book resort:', vendorId);
                    // TODO: Navigate to resort booking/reservation
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Resort Features Section */}
        <Card className="p-6 bg-[#FF8C42] gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Resort Amenities</h3>
          <div className="space-y-3">
            {[
              { icon: '🏊', title: 'Swimming Pools', desc: 'Temperature-controlled pet pools' },
              { icon: '💆', title: 'Spa & Grooming', desc: 'Professional pampering services' },
              { icon: '🍽️', title: 'Gourmet Meals', desc: 'Chef-prepared pet cuisine' },
              { icon: '📸', title: 'Daily Updates', desc: 'Photos & videos of your pet' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#FF8C42] white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
