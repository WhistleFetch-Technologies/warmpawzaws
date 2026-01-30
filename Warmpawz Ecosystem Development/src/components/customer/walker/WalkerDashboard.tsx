import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Footprints,
  MapPin,
  Star,
  Clock,
  ArrowLeft,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Calendar,
  Package,
  Shield,
  Video
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface WalkerDashboardProps {
  phone: string;
  onNavigate: (screen: string, data?: any) => void;
  onBack: () => void;
  data?: any;
  onBrowseProviders?: () => void; // ✅ Navigate to full provider listing
  onViewProvider?: (provider: any) => void; // ✅ Navigate to provider profile
}

export function WalkerDashboard({ phone, onNavigate, onBack, data, onBrowseProviders, onViewProvider }: WalkerDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [featuredWalkers, setFeaturedWalkers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // ✅ Handler to navigate to full provider listing (unified flow)
  const handleBrowseProviders = () => {
    if (onBrowseProviders) {
      onBrowseProviders();
    } else {
      // Fallback to universal router via screen navigation
      onNavigate('home-walker');
    }
  };

  // ✅ Handler to view provider profile (unified flow)
  const handleViewProvider = (provider: any) => {
    if (onViewProvider) {
      onViewProvider(provider);
    } else {
      // Fallback navigation
      onNavigate('home-walker', { vendorId: provider.id });
    }
  };

  useEffect(() => {
    loadWalkerData();
  }, []);

  const loadWalkerData = async () => {
    try {
      setLoading(true);
      
      // Fetch all approved vendors from database
      const vendorsRes = await fetch(
        `${getApiBaseUrl()}/customer/services`,
        {
          headers: { Authorization: (getAuthHeaders().Authorization || "") },
        }
      );

      if (vendorsRes.ok) {
        const servicesData = await vendorsRes.json();
        console.log('✅ Loaded services for walker:', servicesData);
        
        // Extract unique walker vendors
        const vendorMap = new Map();
        servicesData.services?.forEach((service: any) => {
          const vendorId = service.vendorId;
          const vendorType = (service.vendorType || '').toLowerCase();
          const roleId = (service.vendorRoleId || '').toLowerCase();
          const vendorName = service.vendorName || '';
          
          // Filter for walker vendors
          const isWalker = vendorType.includes('walker') || 
                          roleId.includes('walker') ||
                          vendorName.toLowerCase().includes('walker');
          
          if (isWalker && !vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              name: service.vendorName,
              rating: service.vendorRating || 4.5,
              reviews: service.vendorReviewCount || 0,
              experience: 3,
              fee: service.price || 199,
              location: service.vendorLocation,
              completedWalks: Math.floor(Math.random() * 500) + 100
            });
          }
        });
        
        const walkers = Array.from(vendorMap.values());
        console.log(`✅ Found ${walkers.length} walker vendors`);
        
        setFeaturedWalkers(walkers.slice(0, 5));
        
        // Set stats
        setStats({
          activeWalkers: walkers.length > 0 ? walkers.length : 80,
          walks: '10K',
          rating: walkers.length > 0 ? (walkers.reduce((acc: number, w: any) => acc + w.rating, 0) / walkers.length).toFixed(1) : '4.7'
        });
      } else {
        setStats({
          activeWalkers: 0,
          walks: '0',
          rating: '0.0'
        });
      }
    } catch (error) {
      console.error('Error loading walker data:', error);
      setStats({
        activeWalkers: 0,
        walks: '0',
        rating: '0.0'
      });
    } finally {
      setLoading(false);
    }
  };

  const serviceCategories = [
    {
      id: 'single-walk',
      name: 'Single Walk',
      description: 'One-time booking',
      icon: Footprints,
      color: '#6B9FFF',
      bgColor: 'bg-blue-50',
      price: 'From ₹199'
    },
    {
      id: 'weekly-package',
      name: 'Weekly Package',
      description: '7 walks • Mon-Sun',
      icon: Calendar,
      color: '#7FD47F',
      bgColor: 'bg-green-50',
      price: 'From ₹1,199',
      badge: 'Save 15%'
    },
    {
      id: 'monthly-package',
      name: 'Monthly Package',
      description: '30 walks • 1x or 2x daily',
      icon: Package,
      color: '#9F7FFF',
      bgColor: 'bg-purple-50',
      price: 'From ₹3,999',
      badge: 'Save 30%'
    },
    {
      id: 'premium-care',
      name: 'Premium Care',
      description: 'Certified walkers only',
      icon: Shield,
      color: '#FF8C42',
      bgColor: 'bg-orange-50',
      badge: 'Best Value'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors hover:bg-white/30"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
            <Footprints className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dog Walking</h1>
            <p className="text-white/80 text-sm">Trusted walkers for your pet</p>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold">{stats.activeWalkers || 80}+</div>
              <div className="text-white/80 text-xs">Active Walkers</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold">{stats.walks || '10K'}+</div>
              <div className="text-white/80 text-xs">Walks Done</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="flex items-center gap-1 text-2xl font-bold">
                {stats.rating || '4.7'} <Star className="w-4 h-4 fill-white" />
              </div>
              <div className="text-white/80 text-xs">Avg Rating</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content on White Background */}
      <div className="px-6 pt-8 pb-24 bg-white rounded-t-[32px] -mt-4 min-h-[calc(100vh-200px)]">
        {/* Spotlight Offers */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">Spotlight Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* First Walk Offer */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-blue-100 text-blue-600 border-none mb-2">New User</Badge>
                  <div className="text-3xl font-bold text-blue-600 mb-1">40% OFF</div>
                  <div className="text-gray-700 text-sm">Your First Walk</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Footprints className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="line-through text-gray-400">₹299</span>
                  <span className="ml-2 font-bold text-lg text-gray-900">₹179</span>
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 text-white hover:bg-blue-700 h-8"
                  onClick={handleBrowseProviders}
                >
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Monthly Package Offer */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-purple-100 text-purple-600 border-none mb-2">Best Value</Badge>
                  <div className="text-3xl font-bold text-purple-600 mb-1">30% OFF</div>
                  <div className="text-gray-700 text-sm">Monthly Package</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">30 walks • 1x daily</div>
                <Button 
                  size="sm" 
                  className="bg-purple-600 text-white hover:bg-purple-700 h-8"
                  onClick={handleBrowseProviders}
                >
                  Subscribe
                </Button>
              </div>
            </Card>

            {/* Live Tracking Feature */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-green-100 text-green-600 border-none mb-2">Premium</Badge>
                  <div className="text-3xl font-bold text-green-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Live Walk Tracking</div>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">Track walker in real-time</div>
                <Button 
                  size="sm" 
                  className="bg-green-600 text-white hover:bg-green-700 h-8"
                  onClick={handleBrowseProviders}
                >
                  Try Now
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Service Categories */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Choose Package</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {serviceCategories.map((category) => (
              <Card
                key={category.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
                onClick={handleBrowseProviders}
              >
                <div className="flex flex-col h-full">
                  <div 
                    className={`w-12 h-12 ${category.bgColor} rounded-xl flex items-center justify-center mb-3`}
                  >
                    <category.icon className="w-6 h-6" style={{ color: category.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{category.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{category.description}</p>
                    {category.price && (
                      <p className="text-sm font-semibold text-[#FF8C42]">{category.price}</p>
                    )}
                  </div>
                  {category.badge && (
                    <Badge variant="secondary" className="text-xs w-fit mt-2">
                      {category.badge}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Walkers */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Walkers</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1"
              onClick={handleBrowseProviders}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {featuredWalkers.length > 0 ? (
              featuredWalkers.slice(0, 3).map((walker, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => handleViewProvider(walker)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {walker.name?.charAt(0) || 'W'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{walker.name || 'Walker'}</h3>
                      <p className="text-xs text-gray-500 mb-2">{walker.completedWalks || 250}+ walks completed</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{walker.rating || 4.7}</span>
                          <span className="text-gray-400">({walker.reviews || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{walker.experience || 3}+ years</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#FF8C42]">₹{walker.fee || 199}</div>
                      <div className="text-xs text-gray-400">per walk</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // Placeholder walkers
              [1, 2, 3].map((i) => (
                <Card 
                  key={i}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={handleBrowseProviders}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      W
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Walker {i}</h3>
                      <p className="text-xs text-gray-500 mb-2">{250 + i * 50}+ walks completed</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">4.{7 + i}</span>
                          <span className="text-gray-400">(85)</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{2 + i}+ years</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#FF8C42]">₹{199 + i * 50}</div>
                      <div className="text-xs text-gray-400">per walk</div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* What's Included */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">What's Included</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Live GPS Tracking</h3>
                  <p className="text-sm text-gray-600">Track your pet's walk in real-time on the map</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Walk Report</h3>
                  <p className="text-sm text-gray-600">Photos, route map, and activity summary after each walk</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Verified Walkers</h3>
                  <p className="text-sm text-gray-600">All walkers are background-checked and certified</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
