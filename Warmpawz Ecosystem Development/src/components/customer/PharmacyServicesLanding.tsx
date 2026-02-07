import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  MapPin,
  Truck,
  Pill,
  Heart,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface PharmacyServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function PharmacyServicesLanding({ onBack, onNavigate, customerId, phone }: PharmacyServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredPharmacies, setFeaturedPharmacies] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadPharmacyData();
  }, []);

  const loadPharmacyData = async () => {
    try {
      setLoading(true);
      
      // Fetch services from backend with roleId filter
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_pharmacy`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [PHARMACY] Loaded services:', data);
        
        // Already filtered by roleId=pet_pharmacy on backend
        const pharmacyServices = data.services || [];
        
        console.log(`✅ [PHARMACY] Found ${pharmacyServices.length} pharmacy services from ${new Set(pharmacyServices.map((s: any) => s.vendorId)).size} pharmacies`);
        
        // Get unique vendors
        const vendorMap = new Map();
        pharmacyServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.7,
              completedOrders: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              deliveryTime: Math.floor(Math.random() * 30) + 20
            });
          }
        });
        
        const allPharmacies = Array.from(vendorMap.values());
        setFeaturedPharmacies(allPharmacies.slice(0, 5));
        
        setStats({
          activePharmacies: allPharmacies.length || 25,
          orders: '50K+',
          rating: allPharmacies.length > 0 
            ? (allPharmacies.reduce((acc: number, p: any) => acc + (p.rating || 4.7), 0) / allPharmacies.length).toFixed(1) 
            : '4.7'
        });
      } else {
        console.error('❌ [PHARMACY] Failed to load services:', response.status);
        setStats({
          activePharmacies: 25,
          orders: '50K+',
          rating: '4.7'
        });
      }
    } catch (error) {
      console.error('❌ [PHARMACY] Error loading pharmacy data:', error);
      setStats({
        activePharmacies: 25,
        orders: '50K+',
        rating: '4.7'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header with Concave Bottom Curve */}
      <div className="bg-gradient-to-br from-pink-600 to-pink-700 text-white px-6 pt-8 pb-16 relative">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pet Pharmacy</h1>
            <p className="text-white/80 text-sm">Medicines & health products</p>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.activePharmacies}+</div>
              <div className="text-white/80 text-xs">Pharmacies</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.orders}</div>
              <div className="text-white/80 text-xs">Orders</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-1 text-2xl font-bold">
                <Star className="w-4 h-4 fill-white" />
                {stats.rating}
              </div>
              <div className="text-white/80 text-xs">Avg Rating</div>
            </div>
          </div>
        )}
        
        {/* Concave curve */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      {/* Main Content */}
      <div className="px-6 pb-24">
        {/* Spotlight Offers */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-pink-600" />
            <h2 className="text-lg font-semibold">Special Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* First Order Discount */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-pink-100 text-pink-600 border-none mb-2">First Order</Badge>
                  <div className="text-3xl font-bold text-pink-600 mb-1">20% OFF</div>
                  <div className="text-gray-700 text-sm">On All Medicines</div>
                </div>
                <div className="p-3 bg-pink-50 rounded-xl">
                  <Pill className="w-6 h-6 text-pink-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">+ Free delivery above ₹500</div>
                <Button 
                  size="sm" 
                  className="bg-pink-600 text-white hover:bg-pink-700 h-8"
                  onClick={() => onNavigate('pharmacy_store')}
                >
                  Shop Now
                </Button>
              </div>
            </Card>

            {/* Prescription Upload */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-blue-100 text-blue-600 border-none mb-2">Upload RX</Badge>
                  <div className="text-3xl font-bold text-blue-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Home Delivery</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">On prescription orders</div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 text-white hover:bg-blue-700 h-8"
                  onClick={() => onNavigate('pharmacy_store')}
                >
                  Upload
                </Button>
              </div>
            </Card>

            {/* Monthly Pack */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-green-100 text-green-600 border-none mb-2">Monthly</Badge>
                  <div className="text-3xl font-bold text-green-600 mb-1">₹2,499</div>
                  <div className="text-gray-700 text-sm">Health Pack</div>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <Heart className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">Supplements + Vitamins</div>
                <Button 
                  size="sm" 
                  className="bg-green-600 text-white hover:bg-green-700 h-8"
                  onClick={() => onNavigate('pharmacy_store')}
                >
                  View
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Shop by Category</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
              onClick={() => onNavigate('pharmacy_store', { category: 'prescription' })}
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center mb-3">
                  <Pill className="w-6 h-6 text-pink-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Prescription</h3>
                  <p className="text-xs text-gray-500 mb-2">Medicines & treatments</p>
                </div>
                <Badge variant="secondary" className="text-xs w-fit">
                  RX Required
                </Badge>
              </div>
            </Card>

            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
              onClick={() => onNavigate('pharmacy_store', { category: 'otc' })}
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">OTC Products</h3>
                  <p className="text-xs text-gray-500 mb-2">Over-the-counter items</p>
                </div>
                <Badge variant="secondary" className="text-xs w-fit">
                  No RX Needed
                </Badge>
              </div>
            </Card>

            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
              onClick={() => onNavigate('pharmacy_store', { category: 'supplements' })}
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                  <Heart className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Supplements</h3>
                  <p className="text-xs text-gray-500 mb-2">Vitamins & nutrition</p>
                </div>
                <Badge variant="secondary" className="text-xs w-fit">
                  Popular
                </Badge>
              </div>
            </Card>

            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
              onClick={() => onNavigate('pharmacy_store', { category: 'accessories' })}
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
                  <ShoppingBag className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Accessories</h3>
                  <p className="text-xs text-gray-500 mb-2">Health devices & more</p>
                </div>
                <Badge variant="secondary" className="text-xs w-fit">
                  New Arrivals
                </Badge>
              </div>
            </Card>
          </div>
        </div>

        {/* Featured Pharmacies */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Nearby Pharmacies</h2>
            <button 
              className="text-sm text-pink-600 flex items-center gap-1"
              onClick={() => onNavigate('pharmacy_store')}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {featuredPharmacies.length > 0 ? (
              featuredPharmacies.slice(0, 3).map((pharmacy, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('pharmacy_store')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-600 to-pink-700 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {pharmacy.businessName?.charAt(0) || 'P'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{pharmacy.businessName || 'Pet Pharmacy'}</h3>
                      <p className="text-xs text-gray-500 mb-2">Licensed • Home Delivery</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{pharmacy.rating || 4.7}</span>
                          <span className="text-gray-400">({pharmacy.completedOrders || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{pharmacy.distance ? `${pharmacy.distance.toFixed(1)}km` : 'Nearby'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-600 text-xs font-semibold mb-1">
                        <Clock className="w-3 h-3" />
                        <span>{pharmacy.deliveryTime || 30} min</span>
                      </div>
                      <div className="text-xs text-gray-400">delivery</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // Placeholder pharmacies
              [
                { name: 'PetMeds Pharmacy', orders: 1200, deliveryTime: 25 },
                { name: 'VetCare Pharmacy', orders: 980, deliveryTime: 30 },
                { name: 'Healthy Paws Pharmacy', orders: 1550, deliveryTime: 20 }
              ].map((pharmacy, i) => (
                <Card 
                  key={i}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('pharmacy_store')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-pink-600 to-pink-700 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {pharmacy.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{pharmacy.name}</h3>
                      <p className="text-xs text-gray-500 mb-2">Licensed • Home Delivery</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">4.7</span>
                          <span className="text-gray-400">({pharmacy.orders})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{((i + 1) * 1.5).toFixed(1)}km</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-600 text-xs font-semibold mb-1">
                        <Clock className="w-3 h-3" />
                        <span>{pharmacy.deliveryTime} min</span>
                      </div>
                      <div className="text-xs text-gray-400">delivery</div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Why Choose Us */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-pink-600" />
            <h2 className="text-lg font-semibold">Why Choose Us</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-pink-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">100% Authentic</h3>
                  <p className="text-sm text-gray-600">Licensed pharmacies with genuine medicines</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Fast Delivery</h3>
                  <p className="text-sm text-gray-600">Get medicines delivered within 30 minutes</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Pill className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Expert Consultation</h3>
                  <p className="text-sm text-gray-600">Free pharmacist consultation available</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Loyalty Rewards</h3>
                  <p className="text-sm text-gray-600">Earn points on every purchase</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
