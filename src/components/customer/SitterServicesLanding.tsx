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
  Home
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SitterServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function SitterServicesLanding({ onBack, onNavigate, customerId, phone }: SitterServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredSitters, setFeaturedSitters] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadSitterData();
  }, []);

  const loadSitterData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_sitter`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const sitterServices = data.services || [];
        
        const vendorMap = new Map();
        sitterServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.8,
              completedBookings: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              basePrice: service.price || 500
            });
          }
        });
        
        const allSitters = Array.from(vendorMap.values());
        setFeaturedSitters(allSitters.slice(0, 5));
        
        setStats({
          activeSitters: allSitters.length || 85,
          sittings: '8K+',
          rating: allSitters.length > 0 
            ? (allSitters.reduce((acc: number, s: any) => acc + (s.rating || 4.8), 0) / allSitters.length).toFixed(1) 
            : '4.8'
        });
      } else {
        setStats({ activeSitters: 85, sittings: '8K+', rating: '4.8' });
      }
    } catch (error) {
      console.error('❌ [SITTER] Error loading sitter data:', error);
      setStats({ activeSitters: 85, sittings: '8K+', rating: '4.8' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-purple-600 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-purple-600 max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Pet Sitting</h1>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.activeSitters}+</div>
              <div className="text-xs text-white/80">Sitters</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.sittings}</div>
              <div className="text-xs text-white/80">Sittings</div>
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
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-bold text-slate-900">Spotlight Offers</h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">New Customer</div>
                    <div className="text-2xl font-bold text-slate-900">30% OFF</div>
                    <div className="text-slate-500 text-xs">First Booking</div>
                  </div>
                  <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                    <Home className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹500</span>
                    <span className="ml-2 font-bold text-slate-900">₹350</span>
                  </div>
                  <Button size="sm" className="bg-purple-600 text-white hover:bg-purple-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('sitter_service')}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Featured Sitters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Featured Sitters</h2>
              <button 
                onClick={() => onNavigate('problem_grid')}
                className="text-sm text-purple-600 font-medium hover:text-purple-700"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {featuredSitters.map((sitter) => (
                <Card 
                  key={sitter.id}
                  className="p-4 border border-slate-100 hover:border-purple-200 transition-colors cursor-pointer"
                  onClick={() => onNavigate('sitter_service', { vendorId: sitter.id, vendorName: sitter.businessName })}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">{sitter.businessName}</h3>
                        <Badge variant="outline" className="text-xs">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                          {sitter.rating}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                        <span>{sitter.completedBookings} bookings</span>
                        <span>{sitter.distance.toFixed(1)} km away</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        From ₹{sitter.basePrice}/day
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
                className="bg-purple-600 hover:bg-purple-700 text-white h-20 flex-col gap-2"
                onClick={() => onNavigate('problem_grid')}
              >
                <Shield className="w-6 h-6" />
                <span className="text-sm">Find by Need</span>
              </Button>
              <Button 
                variant="outline"
                className="border-purple-200 hover:bg-purple-50 h-20 flex-col gap-2"
                onClick={() => onNavigate('sitter_service')}
              >
                <Clock className="w-6 h-6 text-purple-600" />
                <span className="text-sm text-purple-600">Book Now</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

