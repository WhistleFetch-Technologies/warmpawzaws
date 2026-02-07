import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Brain,
  Home as HomeIcon,
  Building2,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  MapPin,
  Shield,
  Award,
  Heart
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface BehavioralServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function BehavioralServicesLanding({ onBack, onNavigate, customerId, phone }: BehavioralServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredBehaviorists, setFeaturedBehaviorists] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = getApiBaseUrl();

  // ✅ Behavioral Issues - Problem Grid
  const behavioralIssues = [
    {
      id: 'separation_anxiety',
      name: 'Anxiety & Stress',
      icon: '😰',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600'
    },
    {
      id: 'barking',
      name: 'Barking Issues',
      icon: '📢',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    },
    {
      id: 'destructive',
      name: 'Destructive Habits',
      icon: '💥',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      id: 'fear_phobia',
      name: 'Fear Issues',
      icon: '😨',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      id: 'resource_guarding',
      name: 'Possessive Behavior',
      icon: '🛡️',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600'
    },
    {
      id: 'view_all',
      name: 'View All',
      icon: '➕',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-600'
    }
  ];

  useEffect(() => {
    loadBehavioralData();
  }, []);

  const loadBehavioralData = async () => {
    try {
      setLoading(true);
      
      // Fetch services from backend with roleId filter
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=behaviourist`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [BEHAVIORAL] Loaded services:', data);
        
        // Already filtered by roleId=behaviourist on backend
        const behavioralServices = data.services || [];
        
        console.log(`✅ [BEHAVIORAL] Found ${behavioralServices.length} behavioral services from ${new Set(behavioralServices.map((s: any) => s.vendorId)).size} behaviorists`);
        
        // Get unique vendors
        const vendorMap = new Map();
        behavioralServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.9,
              completedBookings: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              basePrice: service.price || 2500
            });
          }
        });
        
        const allBehaviorists = Array.from(vendorMap.values());
        setFeaturedBehaviorists(allBehaviorists.slice(0, 5));
        
        setStats({
          activeBehaviorists: allBehaviorists.length || 25,
          sessions: '3K+',
          rating: allBehaviorists.length > 0 
            ? (allBehaviorists.reduce((acc: number, b: any) => acc + (b.rating || 4.9), 0) / allBehaviorists.length).toFixed(1) 
            : '4.9'
        });
      } else {
        console.error('❌ [BEHAVIORAL] Failed to load services:', response.status);
        setStats({
          activeBehaviorists: 25,
          sessions: '3K+',
          rating: '4.9'
        });
      }
    } catch (error) {
      console.error('❌ [BEHAVIORAL] Error loading behavioral data:', error);
      setStats({
        activeBehaviorists: 25,
        sessions: '3K+',
        rating: '4.9'
      });
    } finally {
      setLoading(false);
    }
  };

  const serviceTypes = [
    {
      id: 'behavioral_center',
      name: 'Behavioral Centre',
      description: 'Visit our facilities',
      icon: Building2,
      color: '#F97316',
      bgColor: 'bg-orange-50',
      badge: '15+ Centres'
    },
    {
      id: 'behavioral_home',
      name: 'At Home Sessions',
      description: 'Expert comes to you',
      icon: HomeIcon,
      color: '#14B8A6',
      bgColor: 'bg-teal-50',
      badge: 'Personalized'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header with Concave Bottom Curve */}
      <div className="bg-gradient-to-br from-orange-600 to-orange-700 text-white px-6 pt-8 pb-16 relative">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pet Behaviorist</h1>
            <p className="text-white/80 text-sm">Expert behavioral solutions</p>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.activeBehaviorists}+</div>
              <div className="text-white/80 text-xs">Certified Experts</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.sessions}</div>
              <div className="text-white/80 text-xs">Success Stories</div>
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
            <Sparkles className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Spotlight Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* Initial Assessment Offer */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-orange-100 text-orange-600 border-none mb-2">First Visit</Badge>
                  <div className="text-3xl font-bold text-orange-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Behavioral Assessment</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl">
                  <Brain className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">Expert evaluation & plan</div>
                <Button 
                  size="sm" 
                  className="bg-orange-600 text-white hover:bg-orange-700 h-8"
                  onClick={() => onNavigate('behavioral_center')}
                >
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Anxiety Package */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-red-100 text-red-600 border-none mb-2">Popular</Badge>
                  <div className="text-3xl font-bold text-red-600 mb-1">₹8999</div>
                  <div className="text-gray-700 text-sm">Anxiety Relief Program</div>
                </div>
                <div className="p-3 bg-red-50 rounded-xl">
                  <Heart className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">6 sessions + follow-up</div>
                <Button 
                  size="sm" 
                  className="bg-red-600 text-white hover:bg-red-700 h-8"
                  onClick={() => onNavigate('behavioral_home')}
                >
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Advanced Behavior Package */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-purple-100 text-purple-600 border-none mb-2">Premium</Badge>
                  <div className="text-3xl font-bold text-purple-600 mb-1">₹15999</div>
                  <div className="text-gray-700 text-sm">Complete Behavior Mod</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <Award className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">12 sessions intensive</div>
                <Button 
                  size="sm" 
                  className="bg-purple-600 text-white hover:bg-purple-700 h-8"
                  onClick={() => onNavigate('behavioral_center')}
                >
                  Book
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Service Types */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Choose Service</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((service) => (
              <Card
                key={service.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 bg-white shadow-sm"
                onClick={() => onNavigate(service.id)}
              >
                <div className="flex flex-col h-full">
                  <div 
                    className={`w-12 h-12 ${service.bgColor} rounded-xl flex items-center justify-center mb-3`}
                  >
                    <service.icon className="w-6 h-6" style={{ color: service.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{service.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{service.description}</p>
                  </div>
                  {service.badge && (
                    <Badge variant="secondary" className="text-xs w-fit">
                      {service.badge}
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Behavioral Issues Grid - PROBLEM GRID */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold">What's The Behavioral Issue?</h2>
            </div>
            <button 
              onClick={() => onNavigate('problem_grid')}
              className="text-sm text-orange-600 font-medium"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {behavioralIssues.map((issue) => (
              <button
                key={issue.id}
                onClick={() => {
                  if (issue.id === 'view_all') {
                    onNavigate('problem_grid');
                  } else {
                    onNavigate('problem_selected', { problemId: issue.id });
                  }
                }}
                className="group"
              >
                <div className={`${issue.bgColor} rounded-2xl p-3 border border-gray-200 hover:shadow-md transition-all`}>
                  <div className="w-full aspect-square flex items-center justify-center mb-2">
                    <span className="text-2xl">{issue.icon}</span>
                  </div>
                  <div className={`text-xs text-center ${issue.textColor} font-medium leading-tight`}>
                    {issue.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Behaviorists */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Behaviorists</h2>
            <button 
              className="text-sm text-orange-600 flex items-center gap-1"
              onClick={() => onNavigate('behavioral_center')}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {featuredBehaviorists.length > 0 ? (
              featuredBehaviorists.slice(0, 3).map((behaviorist, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('behavioral_center')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {behaviorist.businessName?.charAt(0) || 'B'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{behaviorist.businessName || 'Certified Behaviorist'}</h3>
                      <p className="text-xs text-gray-500 mb-2">Pet Behavior Specialist</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{behaviorist.rating || 4.9}</span>
                          <span className="text-gray-400">({behaviorist.completedBookings || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{behaviorist.distance ? `${behaviorist.distance.toFixed(1)}km` : 'Nearby'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-600">₹{behaviorist.basePrice || 2500}</div>
                      <div className="text-xs text-gray-400">per session</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // Placeholder behaviorists
              [1, 2, 3].map((i) => (
                <Card 
                  key={i}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('behavioral_center')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      P
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">PawBehavior Expert {i}</h3>
                      <p className="text-xs text-gray-500 mb-2">Pet Behavior Specialist</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">4.9</span>
                          <span className="text-gray-400">(85)</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span>{(i * 1.5).toFixed(1)}km</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-600">₹{2500 + i * 500}</div>
                      <div className="text-xs text-gray-400">per session</div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* What's New */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">What's New</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Science-Based Methods</h3>
                  <p className="text-sm text-gray-600">Positive reinforcement techniques</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">In-Home Sessions</h3>
                  <p className="text-sm text-gray-600">Personalized one-on-one attention</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Certified Professionals</h3>
                  <p className="text-sm text-gray-600">All behaviorists are certified & experienced</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
