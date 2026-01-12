'use client';

import { useState, useEffect } from 'react';
import { 
  Heart, Calendar, Plus, ChevronRight, Star, MapPin, Clock, 
  Scissors, Stethoscope, Home as HomeIcon, ShoppingBag, Users, 
  GraduationCap, Coffee, Bike, Shield, Sparkles, TrendingUp,
  Phone, Video, Building, Bone, ShoppingCart, BookOpen, Wheat, User, Bot, Menu, Settings, Palmtree
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { apiClient } from '@/lib/api-client';
import { AIChatbotWidget } from './AIChatbotWidget';
import { CustomerSidebar } from './CustomerSidebar';
import { EnhancedSearchBar } from './EnhancedSearchBar';
import { ProblemGridNavigation } from './ProblemGridNavigation';
import { ServicesByProblem } from './ServicesByProblem';
import { TrendingProblems } from './TrendingProblems';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: number | string;
  weight?: number | string;
  lastCheckup?: string;
  mood?: string;
  image?: string;
  color?: string;
  photo?: string;
}

interface UserData {
  name: string;
  phone: string;
  pets: Pet[];
  journeyType?: string;
}

interface CustomerHomeCompleteProps {
  phone: string;
  refreshKey?: number;
  onNavigate?: (screen: string, data?: any) => void;
  onProfileClick?: () => void;
  onSidebarOpen?: () => void;
  onPetClick?: (petId: string) => void;
  onAddPet?: () => void;
  onViewBooking?: (bookingId: string, petId?: string) => void;
  onOpenMenu?: () => void;
  onOpenCategoryMapper?: () => void;
}

export function CustomerHomeComplete({ 
  phone,
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet,
  onViewBooking,
  onOpenMenu,
  onOpenCategoryMapper,
  refreshKey = 0
}: CustomerHomeCompleteProps) {
  const [userData, setUserData] = useState<UserData>({
    name: 'User',
    phone: '',
    pets: []
  });
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'pet-details' | 'add-pet'>('home');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string>('');
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showAIChat, setShowAIChat] = useState(false);
  const { itemCount } = useCart();

  useEffect(() => {
    loadUserData();
  }, [phone, refreshKey]); // Add refreshKey to dependencies

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // AWS Serverless compatible - use apiClient instead of direct Supabase calls
      // First get customer by phone, then get pets
      const customerResponse: any = await apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(phone)}`).catch(() => null);
      const customer = customerResponse?.customer || customerResponse;
      const customerId = customer?.id;

      const [profileResponse, petsResponse] = await Promise.all([
        apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`).catch(() => null),
        customerId 
          ? apiClient.get(`/customer/${customerId}/pets`).catch(() => null)
          : Promise.resolve(null)
      ]);

      const profileResp = profileResponse as any;
      if (profileResp && (profileResp.success || profileResp.profile)) {
        const profile = profileResp.profile || profileResp;
        setUserData(prev => ({
          ...prev,
          name: profile.firstName || profile.name || 'User',
          phone: phone,
          journeyType: profile.journeyType || ''
        }));
        setUserProfilePhoto(profile.photo || profile.profile_photo_url || '');
      }

      const petsResp = petsResponse as any;
      if (petsResp && (petsResp.success || petsResp.pets)) {
        // ✅ Robust response parsing
        let pets = [];
        if (Array.isArray(petsResp)) {
          pets = petsResp;
        } else if (Array.isArray(petsResp.pets)) {
          pets = petsResp.pets;
        } else if (petsResp.pets?.pets && Array.isArray(petsResp.pets.pets)) {
          pets = petsResp.pets.pets;
        } else if (petsResp.success && Array.isArray(petsResp.data)) {
          pets = petsResp.data;
        } else if (Array.isArray(petsResp)) {
          pets = petsResp as any[];
        }
        
        setUserData(prev => ({
          ...prev,
          pets: pets
        }));
        if (pets.length > 0 && !selectedPet) {
          setSelectedPet(pets[0]);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPet = () => {
    if (onAddPet) {
      onAddPet();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const banners = [
    {
      title: "Get 50% OFF",
      subtitle: "First Grooming Session",
      bg: "linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)",
      emoji: "✂️"
    },
    {
      title: "Free Health Checkup",
      subtitle: "Book Vet Appointment Today",
      bg: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
      emoji: "🏥"
    },
    {
      title: "Premium Pet Food",
      subtitle: "20% OFF on First Order",
      bg: "linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)",
      emoji: "🍖"
    }
  ];

  const quickServices = [
    // PRIMARY SERVICES
    { icon: Stethoscope, label: 'Vet Care', color: 'bg-blue-100 text-blue-600', screen: 'vet' },
    { icon: Scissors, label: 'Grooming', color: 'bg-orange-100 text-orange-600', screen: 'grooming' },
    { icon: ShoppingBag, label: 'Shop', color: 'bg-pink-100 text-pink-600', screen: 'shop' },
    { icon: GraduationCap, label: 'Training', color: 'bg-purple-100 text-purple-600', screen: 'training' },
    
    // CARE SERVICES
    { icon: Bike, label: 'Walker', color: 'bg-green-100 text-green-600', screen: 'walker' },
    { icon: HomeIcon, label: 'Boarding', color: 'bg-indigo-100 text-indigo-600', screen: 'boarding' },
    { icon: Heart, label: 'Adoption', color: 'bg-red-100 text-red-600', screen: 'adoption' },
    { icon: Heart, label: 'Mating & Dating', color: 'bg-pink-100 text-pink-600', screen: 'mating-dating-hub' },
    { icon: Coffee, label: 'Pet Cafes', color: 'bg-amber-100 text-amber-600', screen: 'cafes' },
    
    // SPECIALIZED SERVICES - NEW
    { icon: Users, label: 'Photography', color: 'bg-purple-100 text-purple-600', screen: 'photography' },
    { icon: Shield, label: 'Insurance', color: 'bg-cyan-100 text-cyan-600', screen: 'insurance' },
    { icon: Users, label: 'Breeder', color: 'bg-amber-100 text-amber-600', screen: 'breeder' },
    { icon: Phone, label: 'Ambulance', color: 'bg-red-100 text-red-600', screen: 'ambulance' },
    
    // WELLNESS SERVICES - NEW
    { icon: Wheat, label: 'Nutritionist', color: 'bg-green-100 text-green-600', screen: 'nutritionist' },
    { icon: MapPin, label: 'Relocation', color: 'bg-blue-100 text-blue-600', screen: 'relocation' },
    { icon: Sparkles, label: 'Pet Resort', color: 'bg-teal-100 text-teal-600', screen: 'resort' },
    { icon: Palmtree, label: 'Pet Holiday', color: 'bg-cyan-100 text-cyan-600', screen: 'holiday' },
    { icon: Heart, label: 'Sunset Care', color: 'bg-purple-100 text-purple-600', screen: 'sunset' },
  ];

  const groomingServices = [
    { 
      title: 'At Home Grooming', 
      price: '₹999', 
      rating: 4.8, 
      icon: '🏠',
      description: 'Professional grooming at your doorstep'
    },
    { 
      title: 'Salon Appointment', 
      price: '₹799', 
      rating: 4.9, 
      icon: '✂️',
      description: 'Premium salon experience'
    },
    { 
      title: 'Spa Package', 
      price: '₹1499', 
      rating: 5.0, 
      icon: '💆',
      description: 'Complete spa & wellness'
    },
  ];

  const vetServices = [
    { 
      title: 'Vet at Home', 
      price: '₹599', 
      icon: '🏠',
      description: 'Doctor visits you',
      type: 'visit'
    },
    { 
      title: 'Tele Consulting', 
      price: '₹299', 
      icon: '📱',
      description: 'Video consultation',
      type: 'video'
    },
    { 
      title: 'Clinic Appointment', 
      price: '₹399', 
      icon: '🏥',
      description: 'Visit nearby clinic',
      type: 'clinic'
    },
  ];

  const hotDeals = [
    {
      title: 'Royal Canin Dog Food',
      price: '₹2,499',
      originalPrice: '₹3,499',
      discount: '30% OFF',
      image: '🍖',
      rating: 4.7
    },
    {
      title: 'Pet Carrier Bag',
      price: '₹1,299',
      originalPrice: '₹2,199',
      discount: '40% OFF',
      image: '🎒',
      rating: 4.5
    },
    {
      title: 'GPS Collar Tracker',
      price: '₹3,999',
      originalPrice: '₹5,999',
      discount: '35% OFF',
      image: '📍',
      rating: 4.9
    },
  ];

  const articles = [
    {
      title: '10 Tips for Puppy Training',
      category: 'Training',
      readTime: '5 min',
      image: '🐕'
    },
    {
      title: 'Best Foods for Senior Dogs',
      category: 'Nutrition',
      readTime: '7 min',
      image: '🍲'
    },
    {
      title: 'Understanding Pet Insurance',
      category: 'Insurance',
      readTime: '6 min',
      image: '🛡️'
    },
  ];

  const adoptionOptions = [
    {
      title: 'Adopt from NGOs',
      description: 'Give a home to rescued pets',
      icon: '❤️',
      count: '50+ pets'
    },
    {
      title: 'Certified Breeders',
      description: 'Ethical & verified breeders',
      icon: '🏆',
      count: '30+ breeders'
    },
    {
      title: 'Pet Rehoming',
      description: 'Find loving owners',
      icon: '🏡',
      count: '20+ listings'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-white text-sm font-medium">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="white"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="white" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="white"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onProfileClick && onProfileClick()}
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/50 transition-all shadow-lg"
            >
              {userProfilePhoto ? (
                <img src={userProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white">
                  {userData.name.charAt(0)}
                </div>
              )}
            </button>
            <div>
              <h1 className="text-white">Hi, {userData.name}! 👋</h1>
              <p className="text-white/90 text-sm">Explore WarmPawz Services</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onNavigate && onNavigate('cart')}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm relative"
            >
              <ShoppingCart className="w-5 h-5 text-white" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
            <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Pet Selector - Only show if user has pets */}
        {userData.pets.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white/90 text-sm font-medium">Your Pets</p>
              <button
                onClick={handleAddPet}
                className="text-white/90 text-xs flex items-center gap-1 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
              {userData.pets.map((pet) => (
                <div key={pet.id} className="relative flex-shrink-0">
                  <button
                    onClick={() => setSelectedPet(pet)}
                    className={`w-16 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                      selectedPet?.id === pet.id
                        ? 'bg-white shadow-lg'
                        : 'bg-white/20 backdrop-blur-sm'
                    }`}
                  >
                    <div 
                      className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-2xl ${
                        selectedPet?.id === pet.id ? 'bg-[#FF8C42]/10' : 'bg-white/20'
                      }`}
                    >
                      {pet.photo || pet.image ? (
                        <img src={pet.photo || pet.image} alt={pet.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}</span>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`}>
                      {pet.name}
                    </span>
                  </button>
                  
                  {/* Edit/View Button - Only show for selected pet */}
                  {selectedPet?.id === pet.id && (
                    <button
                      onClick={() => onPetClick && onPetClick(pet.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                      title="View/Edit Pet Profile"
                    >
                      <ChevronRight className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
              
              {/* Add Pet Button */}
              <button
                onClick={handleAddPet}
                className="flex-shrink-0 w-16 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-1 border-2 border-white/30 border-dashed"
              >
                <Plus className="w-6 h-6 text-white" />
                <span className="text-xs text-white font-medium">Add</span>
              </button>
            </div>
          </div>
        ) : (
          /* No Pets State - Show Add Pet CTA */
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 border-2 border-white/30 border-dashed">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-3 flex items-center justify-center">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-1">No Pets Yet</h3>
              <p className="text-white/80 text-xs mb-3">
                {userData.journeyType === 'end-of-life' 
                  ? 'Ready for a new companion? Add your pet profile to get started'
                  : 'Add your pet profile to unlock personalized services'}
              </p>
              <button
                onClick={handleAddPet}
                className="bg-white text-[#FF8C42] px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add Your First Pet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Scrollable Content */}
      <div className="bg-white rounded-t-[32px] -mt-6 pt-6 pb-24">
        {/* ✅ NEW: Enhanced Search Bar */}
        <div className="px-6 mb-6">
          <EnhancedSearchBar
            placeholder="Search services, products, vets, groomers..."
            customerId={phone}
            onResultSelect={(result) => {
              console.log('Search result selected:', result);
              // Navigate based on result type and category
              if (result.type === 'service' || result.category) {
                const serviceNavigationMap: Record<string, string> = {
                  'veterinary': 'vet',
                  'vet': 'vet',
                  'grooming': 'grooming',
                  'boarding': 'boarding',
                  'training': 'training',
                  'walking': 'walker',
                  'walker': 'walker',
                  'nutrition': 'nutritionist',
                  'nutritionist': 'nutritionist',
                  'cafe': 'cafes',
                  'cafes': 'cafes',
                  'adoption': 'adoption',
                  'breeder': 'breeder',
                  'ambulance': 'ambulance',
                  'insurance': 'insurance',
                  'pharmacy': 'pharmacy',
                  'photography': 'photography',
                  'relocation': 'relocation',
                  'resort': 'resort',
                  'holiday': 'holiday',
                  'sunset': 'sunset',
                  'mating': 'mating-dating-hub'
                };
                
                const category = result.category || result.data?.serviceType || result.data?.category || '';
                const targetScreen = serviceNavigationMap[category.toLowerCase()] || 'services';
                onNavigate?.(targetScreen);
              } else if (result.type === 'product') {
                onNavigate?.('shop');
              } else if (result.type === 'staff' || result.type === 'vendor' || result.type === 'center') {
                // Navigate to relevant service page
                const serviceType = result.data?.serviceType || result.data?.services?.[0] || 'vet';
                onNavigate?.(serviceType);
              }
            }}
          />
        </div>

        {/* ✅ NEW: Trending Problems Section */}
        <div className="px-6 mb-6">
          <TrendingProblems
            onProblemSelect={(problemId, title) => {
              // Navigate to services by problem
              onNavigate?.('services_by_problem', { problemId, problemTitle: title });
            }}
            limit={5}
          />
        </div>

        {/* ✅ NEW: Problem Grid Navigation */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-900">What's Your Pet's Need?</h2>
            <span className="text-xs text-gray-500">Problem-based search</span>
          </div>
          <ProblemGridNavigation
            onProblemSelect={(problemId, problem) => {
              // Navigate to services by problem
              onNavigate?.('services_by_problem', { 
                problemId, 
                problemTitle: problem?.title || (problem as any)?.name || 'Service',
                roleId: problem?.roleId || (problem as any)?.vendorType
              });
            }}
            showTrending={true}
          />
        </div>

        {/* Hero Banner Carousel */}
        <div className="px-6 mb-6">
          <div className="relative h-40 rounded-3xl overflow-hidden shadow-lg">
            {banners.map((banner, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  currentBanner === index ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ background: banner.bg }}
              >
                <div className="h-full flex items-center justify-between px-6">
                  <div>
                    <h2 className="text-white mb-1">{banner.title}</h2>
                    <p className="text-white/90 text-sm mb-3">{banner.subtitle}</p>
                    <button className="bg-white text-[#FF8C42] px-4 py-2 rounded-full text-sm font-medium">
                      Claim Now
                    </button>
                  </div>
                  <div className="text-4xl">{banner.emoji}</div>
                </div>
              </div>
            ))}
            {/* Banner Indicators */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              {banners.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    currentBanner === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Quick Services Grid */}
        <div className="px-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-black font-semibold">All Services</h2>
            <span className="text-xs text-gray-500">{quickServices.length} services</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {quickServices.map((service, index) => (
              <button
                key={index}
                onClick={() => onNavigate?.(service.screen)}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
                  <service.icon className="w-6 h-6" />
                </div>
                <span className="text-xs text-gray-700 text-center leading-tight">{service.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Spotlight: Grooming Services */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-black font-semibold">Grooming Services</h2>
            </div>
            <button className="text-xs text-[#FF8C42] font-medium flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6">
            {groomingServices.map((service, index) => (
              <div 
                key={index} 
                className="flex-shrink-0 w-64 bg-gradient-to-br from-orange-50 to-pink-50 rounded-3xl p-5 border border-orange-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onNavigate?.('grooming')}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                    {service.icon}
                  </div>
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium">{service.rating}</span>
                  </div>
                </div>
                <h3 className="text-black font-semibold mb-1">{service.title}</h3>
                <p className="text-xs text-gray-600 mb-3">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[#FF8C42] font-medium">{service.price}</span>
                  <button 
                    className="bg-[#FF8C42] text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-[#FF7A2E] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('grooming');
                    }}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vet Services */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-blue-600" />
              <h2 className="text-black font-semibold">Veterinary Care</h2>
            </div>
            <button 
              onClick={() => onNavigate?.('vet')}
              className="text-xs text-blue-600 font-medium flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 grid grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate?.('vet')}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl mb-2">📱</div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Tele Consult</h3>
              <p className="text-blue-600 font-medium text-sm">₹299</p>
            </button>
            <button
              onClick={() => onNavigate?.('vet')}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl mb-2">🏠</div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Vet at Home</h3>
              <p className="text-blue-600 font-medium text-sm">₹599</p>
            </button>
            <button
              onClick={() => onNavigate?.('vet')}
              className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100 text-center hover:shadow-lg transition-shadow"
            >
              <div className="text-3xl mb-2">🏥</div>
              <h3 className="text-xs font-semibold text-gray-800 mb-1">Clinic Visit</h3>
              <p className="text-blue-600 font-medium text-sm">₹399</p>
            </button>
          </div>
        </div>

        {/* Hot Deals */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-pink-600" />
              <h2 className="text-black font-semibold">Hot Deals 🔥</h2>
            </div>
            <button className="text-xs text-pink-600 font-medium flex items-center gap-1">
              Shop All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6">
            {hotDeals.map((deal, index) => (
              <div key={index} className="flex-shrink-0 w-40 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="h-32 bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-5xl relative">
                  {deal.image}
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {deal.discount}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2">{deal.title}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-gray-600">{deal.rating}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#FF8C42] font-bold text-sm">{deal.price}</span>
                    <span className="text-gray-400 line-through text-xs">{deal.originalPrice}</span>
                  </div>
                  <button className="w-full bg-[#FF8C42] text-white py-2 rounded-lg text-xs font-medium mt-2">
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Services Mix - Square Boxes */}
        <div className="mb-6">
          <div className="px-6 mb-4">
            <h2 className="text-black font-semibold mb-1">Featured Services</h2>
            <p className="text-xs text-gray-600">Popular choices for your pet</p>
          </div>
          <div className="px-6 grid grid-cols-2 gap-3">
            {/* Large Featured Item - Spans 2 columns */}
            <div className="col-span-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">TRENDING</span>
                    <h3 className="text-lg font-bold mt-2">Complete Health Package</h3>
                    <p className="text-sm text-white/90 mb-3">Full checkup + vaccination + grooming</p>
                  </div>
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-xs line-through text-white/70">₹3,999</span>
                    <div className="text-2xl font-bold">₹2,499</div>
                  </div>
                  <button 
                    onClick={() => onNavigate?.('vet')}
                    className="bg-white text-purple-600 px-4 py-2 rounded-full text-sm font-semibold"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>

            {/* Training */}
            <button
              onClick={() => onNavigate?.('training')}
              className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100 text-left hover:shadow-lg transition-all"
            >
              <GraduationCap className="w-8 h-8 text-indigo-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Training</h3>
              <p className="text-xs text-gray-600 mb-2">Expert trainers</p>
              <span className="text-indigo-600 font-bold text-sm">From ₹999</span>
            </button>

            {/* Boarding */}
            <button
              onClick={() => onNavigate?.('boarding')}
              className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-100 text-left hover:shadow-lg transition-all"
            >
              <HomeIcon className="w-8 h-8 text-cyan-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Boarding</h3>
              <p className="text-xs text-gray-600 mb-2">Safe stay</p>
              <span className="text-cyan-600 font-bold text-sm">₹499/day</span>
            </button>

            {/* Insurance */}
            <button
              onClick={() => onNavigate?.('insurance')}
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 text-left hover:shadow-lg transition-all"
            >
              <Shield className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Insurance</h3>
              <p className="text-xs text-gray-600 mb-2">Full coverage</p>
              <span className="text-green-600 font-bold text-sm">From ₹999</span>
            </button>

            {/* Walker */}
            <button
              onClick={() => onNavigate?.('walker')}
              className="bg-gradient-to-br from-lime-50 to-green-50 rounded-2xl p-4 border border-lime-100 text-left hover:shadow-lg transition-all"
            >
              <Bike className="w-8 h-8 text-lime-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Dog Walker</h3>
              <p className="text-xs text-gray-600 mb-2">Daily walks</p>
              <span className="text-lime-600 font-bold text-sm">₹299/walk</span>
            </button>
          </div>
        </div>

        {/* What's New Section */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-black font-semibold">What's New</h2>
            </div>
            <button className="text-xs text-[#FF8C42] font-medium">See All</button>
          </div>
          <div className="px-6 space-y-3">
            {/* AI Assistant Feature */}
            <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-2xl p-4 border border-orange-100 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                <Bot className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">NEW</span>
                  <span className="text-xs text-gray-500">Just launched</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">AI Pet Assistant</h3>
                <p className="text-xs text-gray-600">Get instant answers about pet care</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>

            {/* 24/7 Emergency */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-4 border border-red-100 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg animate-pulse">
                <Phone className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">SOS</span>
                  <span className="text-xs text-gray-500">Immediate Help</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">Emergency Ambulance</h3>
                <p className="text-xs text-gray-600">Instant location-based dispatch</p>
              </div>
              <button
                onClick={() => onNavigate?.('ambulance')} 
                className="bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-red-700 transition-colors animate-pulse"
              >
                SOS ALERT
              </button>
            </div>

            {/* Premium Membership */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100 flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                <Star className="w-8 h-8 fill-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full font-medium">PREMIUM</span>
                  <span className="text-xs text-gray-500">Save 40%</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">WarmPawz Plus</h3>
                <p className="text-xs text-gray-600">Unlimited services at best prices</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Adoption Services */}
        <div className="mb-6">
          <div className="px-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-red-600" />
              <h2 className="text-black font-semibold">Adoption & Breeding</h2>
            </div>
            <p className="text-xs text-gray-600">Find your perfect companion</p>
          </div>
          <div className="px-6 space-y-3">
            {adoptionOptions.map((option, index) => (
              <div key={index} className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-4 border border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">
                    {option.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">{option.title}</h3>
                    <p className="text-xs text-gray-600">{option.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-red-600 mb-1">{option.count}</p>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pet Food Vendors Spotlight */}
        <div className="mb-6">
          <div className="px-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Wheat className="w-5 h-5 text-yellow-600" />
              <h2 className="text-black font-semibold">Premium Pet Food</h2>
            </div>
            <p className="text-xs text-gray-600">Trusted brands & vendors</p>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-6">
            {[
              { name: 'Royal Canin', discount: '25% OFF', icon: '👑' },
              { name: 'Pedigree', discount: '30% OFF', icon: '🍖' },
              { name: 'Drools', discount: '20% OFF', icon: '🦴' },
              { name: 'Whiskas', discount: '15% OFF', icon: '🐱' },
            ].map((vendor, index) => (
              <div key={index} className="flex-shrink-0 w-32 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 border border-yellow-100 text-center">
                <div className="text-4xl mb-2">{vendor.icon}</div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">{vendor.name}</h3>
                <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {vendor.discount}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pet Articles */}
        <div className="mb-6">
          <div className="px-6 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-600" />
              <h2 className="text-black font-semibold">Pet Care Articles</h2>
            </div>
            <button className="text-xs text-teal-600 font-medium flex items-center gap-1">
              Read More <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 space-y-3">
            {articles.map((article, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4 shadow-sm">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                  {article.image}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                      {article.category}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {article.readTime}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800">{article.title}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Other Services Highlight */}
        <div className="px-6 mb-6">
          <h2 className="text-black font-semibold mb-4">More Services</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-4 border border-rose-100">
              <Users className="w-8 h-8 text-rose-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Mating & Dating</h3>
              <p className="text-xs text-gray-600 mb-3">Find perfect match for your pet</p>
              <button className="text-xs text-rose-600 font-medium flex items-center gap-1">
                Explore <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-100">
              <Shield className="w-8 h-8 text-cyan-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Pet Insurance</h3>
              <p className="text-xs text-gray-600 mb-3">Protect your furry friend</p>
              <button className="text-xs text-cyan-600 font-medium flex items-center gap-1">
                Get Quote <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
              <Bike className="w-8 h-8 text-green-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Dog Walkers</h3>
              <p className="text-xs text-gray-600 mb-3">Trusted & verified walkers</p>
              <button className="text-xs text-green-600 font-medium flex items-center gap-1">
                Book Now <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 border border-amber-100">
              <Coffee className="w-8 h-8 text-amber-600 mb-2" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Pet Cafes</h3>
              <p className="text-xs text-gray-600 mb-3">Pet-friendly dining spots</p>
              <button className="text-xs text-amber-600 font-medium flex items-center gap-1">
                Find Cafes <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Training Services */}
        <div className="px-6 mb-6">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-lg mb-2">Pet Training Programs</h2>
                <p className="text-sm text-white/90 mb-4">
                  Professional trainers for obedience, agility & behavior
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>
                    Basic Obedience - ₹2,999
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>
                    Advanced Training - ₹4,999
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>
                    Behavior Correction - ₹3,499
                  </li>
                </ul>
                <button className="mt-4 bg-white text-purple-600 px-5 py-2.5 rounded-full text-sm font-medium">
                  View Programs
                </button>
              </div>
              <GraduationCap className="w-16 h-16 text-white/80" />
            </div>
          </div>
        </div>

        {/* Boarding Services */}
        <div className="px-6 mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg mb-2">Pet Boarding</h2>
                <p className="text-sm text-white/90 mb-4">
                  Safe & comfortable stay for your pets
                </p>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <span className="text-2xl font-bold">₹499</span>
                    <p className="text-xs text-white/80">per day</p>
                  </div>
                  <div className="h-8 w-px bg-white/20"></div>
                  <div>
                    <p className="text-lg font-semibold">4.9★</p>
                    <p className="text-xs text-white/80">250+ reviews</p>
                  </div>
                </div>
                <button className="bg-white text-indigo-600 px-5 py-2.5 rounded-full text-sm font-medium">
                  Book Boarding
                </button>
              </div>
              <HomeIcon className="w-16 h-16 text-white/80" />
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="px-6">
          <div className="bg-gradient-to-r from-orange-100 to-pink-100 rounded-3xl p-6 border-2 border-[#FF8C42] text-center">
            <h2 className="text-black font-bold text-lg mb-2">Need Help? 🤝</h2>
            <p className="text-gray-700 text-sm mb-4">
              Our support team is available 24/7 for you
            </p>
            <div className="flex gap-3">
              <button className="flex-1 bg-white border-2 border-[#FF8C42] text-[#FF8C42] py-3 rounded-full font-medium text-sm flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Call Us
              </button>
              <button className="flex-1 bg-[#FF8C42] text-white py-3 rounded-full font-medium text-sm flex items-center justify-center gap-2">
                <Video className="w-4 h-4" /> Live Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 max-w-[430px] mx-auto">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-1">
            <HomeIcon className="w-6 h-6 text-[#FF8C42]" />
            <span className="text-xs font-medium text-[#FF8C42]">Home</span>
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('cart')}
            className="flex flex-col items-center gap-1 relative"
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6 text-gray-400" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">Cart</span>
          </button>
          <button 
            onClick={() => onOpenMenu && onOpenMenu()}
            className="flex flex-col items-center gap-1"
          >
            <Calendar className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Bookings</span>
          </button>
          <button 
            onClick={() => onProfileClick && onProfileClick()}
            className="flex flex-col items-center gap-1"
          >
            <User className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Profile</span>
          </button>
        </div>
        {/* Home Indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>

      {/* AI Assistant Floating Action Button */}
      <button
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40 max-w-[430px] mx-auto animate-pulse"
        style={{ right: 'max(1.5rem, calc((100vw - 430px) / 2 + 1.5rem))' }}
      >
        <Bot className="w-8 h-8 text-white" />
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      </button>

      {/* ✅ NEW: Category Mapper Button (Development Tool) */}
      {onOpenCategoryMapper && (
        <button
          onClick={onOpenCategoryMapper}
          className="fixed bottom-24 left-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40 max-w-[430px] mx-auto"
          style={{ left: 'max(1.5rem, calc((100vw - 430px) / 2 + 1.5rem))' }}
          title="Open Category Mapper"
        >
          <Settings className="w-7 h-7 text-white" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-800">🧪</span>
          </div>
        </button>
      )}

      {/* AI Assistant Chat Modal */}
      {showAIChat && (
        <AIChatbotWidget
          customerId={phone}
          customerPhone={phone}
          onClose={() => setShowAIChat(false)}
        />
      )}
    </div>
  );
}