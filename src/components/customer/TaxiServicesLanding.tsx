import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  Shield,
  Clock,
  Trophy,
  Car
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface TaxiServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function TaxiServicesLanding({ onBack, onNavigate, customerId, phone }: TaxiServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredTaxis, setFeaturedTaxis] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadTaxiData();
  }, []);

  const loadTaxiData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_taxi`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const taxiServices = data.services || [];
        
        const vendorMap = new Map();
        taxiServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.9,
              completedBookings: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              basePrice: service.price || 200
            });
          }
        });
        
        const allTaxis = Array.from(vendorMap.values());
        setFeaturedTaxis(allTaxis.slice(0, 5));
        
        setStats({
          activeTaxis: allTaxis.length || 65,
          rides: '12K+',
          rating: allTaxis.length > 0 
            ? (allTaxis.reduce((acc: number, t: any) => acc + (t.rating || 4.9), 0) / allTaxis.length).toFixed(1) 
            : '4.9'
        });
      } else {
        setStats({ activeTaxis: 65, rides: '12K+', rating: '4.9' });
      }
    } catch (error) {
      console.error('❌ [TAXI] Error loading taxi data:', error);
      setStats({ activeTaxis: 65, rides: '12K+', rating: '4.9' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-600 max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Pet Taxi</h1>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.activeTaxis}+</div>
              <div className="text-xs text-white/80">Drivers</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.rides}</div>
              <div className="text-xs text-white/80">Rides</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="flex items-center gap-1 text-2xl font-bold text-white">
                {stats.rating} <Star className="w-4 h-4 fill-white" />
              </div>
              <div className="text-xs text-white/80">Rating</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-8">
          
          {/* Spotlight Offers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold text-slate-900">Spotlight Offers</h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">New Customer</div>
                    <div className="text-2xl font-bold text-slate-900">20% OFF</div>
                    <div className="text-slate-500 text-xs">First Ride</div>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                    <Car className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹200</span>
                    <span className="ml-2 font-bold text-slate-900">₹160</span>
                  </div>
                  <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('taxi_service')}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Featured Taxis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Featured Drivers</h2>
              <button 
                onClick={() => onNavigate('problem_grid')}
                className="text-sm text-blue-600 font-medium hover:text-blue-700"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {featuredTaxis.map((taxi) => (
                <Card 
                  key={taxi.id}
                  className="p-4 border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer"
                  onClick={() => onNavigate('taxi_service', { vendorId: taxi.id, vendorName: taxi.businessName })}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{taxi.businessName}</h3>
                        <Badge variant="outline" className="text-xs">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                          {taxi.rating}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                        <span>{taxi.completedBookings} rides</span>
                        <span>{taxi.distance.toFixed(1)} km away</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        From ₹{taxi.basePrice}/km
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white h-20 flex-col gap-2"
                onClick={() => onNavigate('problem_grid')}
              >
                <Shield className="w-6 h-6" />
                <span className="text-sm">Find by Need</span>
              </Button>
              <Button 
                variant="outline"
                className="border-blue-200 hover:bg-blue-50 h-20 flex-col gap-2"
                onClick={() => onNavigate('taxi_service')}
              >
                <Clock className="w-6 h-6 text-blue-600" />
                <span className="text-sm text-blue-600">Book Now</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

