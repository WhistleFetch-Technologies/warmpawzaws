import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star, Clock, Calendar, Sun, Palmtree, UtensilsCrossed, Waves, Mountain, Users, Shield } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { UniversalVendorCard } from './UniversalVendorCard';

interface PetHolidayServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function PetHolidayServicesLanding({ phone, onBack, onNavigate }: PetHolidayServicesLandingProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, avgRating: 0 });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_holiday`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
        setStats({
          total: data.vendors?.length || 0,
          avgRating: data.vendors?.length > 0 
            ? data.vendors.reduce((sum: number, v: any) => sum + (v.rating || 4.5), 0) / data.vendors.length 
            : 4.5
        });
      }
    } catch (error) {
      console.error('Error loading pet holiday vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const holidayFeatures = [
    { icon: Palmtree, label: 'Beach Getaways', color: 'text-blue-500' },
    { icon: Mountain, label: 'Hill Stations', color: 'text-green-500' },
    { icon: UtensilsCrossed, label: 'Pet-Friendly Dining', color: 'text-orange-500' },
    { icon: Waves, label: 'Pool Access', color: 'text-cyan-500' },
    { icon: Shield, label: 'Pet Safety', color: 'text-purple-500' },
    { icon: Users, label: 'Family Packages', color: 'text-pink-500' },
  ];

  const packageTypes = [
    { 
      name: 'Weekend Escape', 
      icon: '🏖️', 
      duration: '2-3 Days',
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      name: 'Week-Long Adventure', 
      icon: '🌄', 
      duration: '5-7 Days',
      color: 'from-green-500 to-emerald-500'
    },
    { 
      name: 'Luxury Retreat', 
      icon: '✨', 
      duration: 'Customizable',
      color: 'from-purple-500 to-pink-500'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-6 py-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="hover:bg-white/20 p-2 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Pet Holiday Services</h1>
            <p className="text-sm text-white/90">Vacation packages with your furry friend</p>
          </div>
          <div className="text-center">
            <div className="text-3xl">🏝️</div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-white/80">Destinations</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
              {stats.avgRating.toFixed(1)}
            </div>
            <div className="text-xs text-white/80">Avg Rating</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">24/7</div>
            <div className="text-xs text-white/80">Support</div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="px-6 py-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sun className="w-5 h-5 text-yellow-500" />
          Holiday Features
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {holidayFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100"
            >
              <feature.icon className={`w-8 h-8 mx-auto mb-2 ${feature.color}`} />
              <p className="text-xs text-gray-700">{feature.label}</p>
            </div>
          ))}
        </div>

        {/* Package Types */}
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Popular Packages
        </h2>
        <div className="grid gap-3 mb-6">
          {packageTypes.map((pkg, index) => (
            <div
              key={index}
              className={`bg-gradient-to-r ${pkg.color} rounded-xl p-4 text-white shadow-lg`}
            >
              <div className="flex items-center gap-3">
                <div className="text-4xl">{pkg.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{pkg.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <Clock className="w-4 h-4" />
                    <span>{pkg.duration}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Vendor Listings */}
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Available Destinations ({stats.total})
        </h2>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : vendors.length > 0 ? (
          <div className="space-y-4 pb-6">
            {vendors.map((vendor) => (
              <UniversalVendorCard
                key={vendor.id}
                vendor={vendor}
                colorScheme={{
                  primary: '#0891b2',
                  secondary: '#06b6d4',
                  accent: '#22d3ee',
                  background: 'from-cyan-500 to-blue-500'
                }}
                icon="🏝️"
                onSelect={() => {
                  // Navigate to holiday booking flow when implemented
                  onNavigate('holiday_booking', { vendorId: vendor.id, vendor });
                }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="text-6xl mb-4">🏖️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Holiday Packages Yet
            </h3>
            <p className="text-gray-600 text-sm">
              Pet-friendly holiday destinations are coming soon to your area!
            </p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="text-3xl">📞</div>
            <div className="flex-1">
              <p className="font-semibold">Need Help Planning?</p>
              <p className="text-xs text-white/90">Our travel experts are here to assist</p>
            </div>
            <button className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors">
              Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
