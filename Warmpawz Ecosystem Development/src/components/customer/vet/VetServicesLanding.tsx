import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Video,
  Building2,
  Home as HomeIcon,
  FlaskConical,
  Pill,
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Stethoscope,
  History,
  ShoppingCart,
  Calendar,
  User,
  Heart
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { ServiceBookingHistory } from '../ServiceBookingHistory';
import { useCart } from '../../../context/CartContext';

interface VetServicesLandingProps {
  phone: string;
  onNavigate: (screen: string, data?: any) => void;
  onBack: () => void;
  data?: any;
}

export function VetServicesLanding({ phone, onNavigate, onBack, data }: VetServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [spotlightDeals, setSpotlightDeals] = useState<any[]>([]);
  const [featuredVets, setFeaturedVets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showBookingHistory, setShowBookingHistory] = useState(false);
  const { itemCount } = useCart();
  
  // ✅ User data for consistent header
  const [userName, setUserName] = useState('User');
  const [userPhoto, setUserPhoto] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  useEffect(() => {
    loadVetData();
    loadUserData();
  }, []);
  
  // ✅ Load user data for header
  const loadUserData = async () => {
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      
      const [profileRes, petsRes, walletRes] = await Promise.all([
        fetch(`${API_BASE}/customer/profile/${phone}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${API_BASE}/customer/pets/${phone}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        fetch(`${API_BASE}/customer/wallet/${phone}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        })
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setUserName(data.profile?.firstName || 'User');
        setUserPhoto(data.profile?.photo || '');
      }

      if (petsRes.ok) {
        const data = await petsRes.json();
        let petList = [];
        if (Array.isArray(data)) petList = data;
        else if (Array.isArray(data.pets)) petList = data.pets;
        else if (data.pets?.pets) petList = data.pets.pets;
        
        setPets(petList);
        if (petList.length > 0) setSelectedPetId(petList[0].id);
      }

      if (walletRes.ok) {
        const data = await walletRes.json();
        setWalletBalance(data.balance || data.wallet?.balance || 0);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadVetData = async () => {
    try {
      setLoading(true);
      
      // Fetch all approved vendors from database
      const vendorsRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/services`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (vendorsRes.ok) {
        const servicesData = await vendorsRes.json();
        console.log('✅ Loaded services:', servicesData);
        
        // Extract unique vet vendors
        // Criteria: roleId includes 'vet' or 'clinic', OR vendorType is 'healthcare_provider'
        const vendorMap = new Map();
        servicesData.services?.forEach((service: any) => {
          // Get vendor metadata - check multiple fields for vet identification
          const vendorId = service.vendorId;
          const vendorType = (service.vendorType || '').toLowerCase();
          const roleId = (service.vendorRoleId || '').toLowerCase();
          const vendorName = service.vendorName || '';
          
          // Filter for veterinary vendors
          const isVet = vendorType.includes('vet') || 
                        vendorType.includes('clinic') || 
                        vendorType.includes('healthcare') ||
                        roleId.includes('vet') ||
                        roleId.includes('clinic') ||
                        vendorName.toLowerCase().includes('vet') ||
                        vendorName.toLowerCase().includes('clinic');
          
          if (isVet && !vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              name: service.vendorName,
              rating: service.vendorRating || 4.5,
              reviews: service.vendorReviewCount || 0,
              specialty: 'General Veterinarian',
              experience: 5,
              fee: service.price || 499,
              location: service.vendorLocation,
              serviceStyle: service.serviceStyle
            });
          }
        });
        
        const vets = Array.from(vendorMap.values());
        console.log(`✅ Found ${vets.length} vet vendors`);
        
        setFeaturedVets(vets.slice(0, 5)); // Top 5 vets
        
        // Set stats based on real data
        setStats({
          activeVets: vets.length > 0 ? vets.length : 150,
          consultations: '5K',
          rating: vets.length > 0 ? (vets.reduce((acc: number, v: any) => acc + v.rating, 0) / vets.length).toFixed(1) : '4.8'
        });
      } else {
        console.error('Failed to load services:', await vendorsRes.text());
        // Set default stats
        setStats({
          activeVets: 0,
          consultations: '0',
          rating: '0.0'
        });
      }
    } catch (error) {
      console.error('Error loading vet data:', error);
      // Set default stats on error
      setStats({
        activeVets: 0,
        consultations: '0',
        rating: '0.0'
      });
    } finally {
      setLoading(false);
    }
  };

  const serviceTypes = [
    {
      id: 'tele',
      name: 'Tele Consultation',
      description: 'Video call with vets',
      icon: Video,
      color: '#6B9FFF',
      bgColor: 'bg-blue-50',
      badge: '24/7 Available'
    },
    {
      id: 'clinic',
      name: 'Clinic Visit',
      description: 'Book appointment',
      icon: Building2,
      color: '#7FD47F',
      bgColor: 'bg-green-50',
      badge: '200+ Clinics'
    },
    {
      id: 'home',
      name: 'Home Visit',
      description: 'Vet comes to you',
      icon: HomeIcon,
      color: '#FF8C42',
      bgColor: 'bg-orange-50',
      badge: 'Track Live'
    },
    {
      id: 'lab',
      name: 'Lab Tests',
      description: 'Sample collection',
      icon: FlaskConical,
      color: '#9F7FFF',
      bgColor: 'bg-purple-50',
      badge: 'Digital Reports'
    },
    {
      id: 'medicine',
      name: 'Medicine',
      description: 'Order medicines',
      icon: Pill,
      color: '#FF6B9F',
      bgColor: 'bg-pink-50',
      badge: 'Fast Delivery'
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
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-20">
      {/* ✅ CONSISTENT HEADER - Matching Home Page */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-white text-sm font-medium">09:41</span>
        <div className="flex gap-1.5 items-center">
          <div className="flex gap-0.5">
            {[1,2,3,4].map(i => <div key={i} className={`w-1 rounded-sm bg-white ${i < 4 ? 'h-2' : 'h-3'}`} style={{opacity: 0.4 + i * 0.2}} />)}
          </div>
          <div className="w-6 h-3 border border-white/40 rounded-sm relative">
            <div className="absolute inset-0.5 bg-white rounded-sm" style={{width: '80%'}} />
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pb-6">
        {/* Back button */}
        <button 
          onClick={onBack}
          className="mb-3 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        
        {/* User Info Row - Matching Home */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('profile')}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30"
            >
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold">
                  {userName.charAt(0)}
                </div>
              )}
            </button>
            <div>
              <h1 className="text-white font-semibold">Hi, {userName}! 👋</h1>
              <p className="text-white/80 text-sm">Explore Vet Services</p>
            </div>
          </div>
          
          {/* Right side icons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('wallet')}
              className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5"
            >
              <span className="text-white text-lg">₹</span>
              <span className="text-white font-semibold">{walletBalance}</span>
            </button>
            <button onClick={() => onNavigate('cart')} className="relative p-2">
              <ShoppingCart className="w-6 h-6 text-white" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
            <button onClick={() => onNavigate('favorites')} className="p-2">
              <Heart className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* YOUR PETS Section - Matching Home */}
        {pets.length > 0 && (
          <div className="mb-2">
            <p className="text-white/80 text-xs font-medium mb-2">YOUR PETS</p>
            <div className="flex items-center gap-3">
              {pets.slice(0, 3).map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPetId(pet.id)}
                  className={`flex flex-col items-center ${selectedPetId === pet.id ? 'opacity-100' : 'opacity-70'}`}
                >
                  <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${
                    selectedPetId === pet.id ? 'border-white' : 'border-white/40'
                  } flex items-center justify-center bg-white/20`}>
                    {pet.photo || pet.image ? (
                      <img src={pet.photo || pet.image} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <Heart className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <span className="text-white text-xs mt-1">{pet.name}</span>
                  {selectedPetId === pet.id && <div className="w-1.5 h-1.5 rounded-full bg-white mt-1" />}
                </button>
              ))}
              <button onClick={() => onNavigate('add-pet')} className="flex flex-col items-center opacity-70 hover:opacity-100">
                <div className="w-12 h-12 rounded-full border-2 border-white/40 border-dashed flex items-center justify-center">
                  <span className="text-white text-2xl">+</span>
                </div>
                <span className="text-white text-xs mt-1">Add</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content on White Background */}
      <div className="px-6 pb-24">
        {/* Spotlight Banners */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">Spotlight Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* First Consultation Offer - WHITE BACKGROUND */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-blue-100 text-blue-600 border-none mb-2">Limited Time</Badge>
                  <div className="text-3xl font-bold text-blue-600 mb-1">50% OFF</div>
                  <div className="text-gray-700 text-sm">First Tele Consultation</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="line-through text-gray-400">₹599</span>
                  <span className="ml-2 font-bold text-lg text-gray-900">₹299</span>
                </div>
                <Button 
                  size="sm" 
                  className="bg-blue-600 text-white hover:bg-blue-700 h-8"
                  onClick={() => onNavigate('vet-booking', { serviceType: 'tele' })}
                >
                  Book Now
                </Button>
              </div>
            </Card>

            {/* Free Lab Tests Offer - WHITE BACKGROUND */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-purple-100 text-purple-600 border-none mb-2">New</Badge>
                  <div className="text-3xl font-bold text-purple-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Home Sample Collection</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl">
                  <FlaskConical className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">On orders above ₹999</div>
                <Button 
                  size="sm" 
                  className="bg-purple-600 text-white hover:bg-purple-700 h-8"
                  onClick={() => onNavigate('vet-lab-tests')}
                >
                  Book Test
                </Button>
              </div>
            </Card>

            {/* Additional spotlight deals - WHITE BACKGROUND */}
            {spotlightDeals.map((deal, index) => (
              <Card 
                key={index}
                className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {deal.badge && (
                      <Badge className="bg-green-100 text-green-600 border-none mb-2">{deal.badge}</Badge>
                    )}
                    <div className="text-3xl font-bold text-green-600 mb-1">{deal.discount}</div>
                    <div className="text-gray-700 text-sm">{deal.title}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-xl">
                    <Stethoscope className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm">
                    {deal.oldPrice && <span className="line-through text-gray-400">₹{deal.oldPrice}</span>}
                    <span className="ml-2 font-bold text-lg text-gray-900">₹{deal.price}</span>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-green-600 text-white hover:bg-green-700 h-8"
                    onClick={() => onNavigate(deal.action || 'vet-clinic-visit')}
                  >
                    Book
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Service Types */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Choose Service</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1 font-medium"
              onClick={() => setShowBookingHistory(true)}
            >
              <History className="w-4 h-4" />
              My Bookings
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {serviceTypes.map((service) => (
              <Card
                key={service.id}
                className="p-4 cursor-pointer hover:shadow-md active:scale-95 transition-all border-2 border-gray-100 bg-white shadow-sm hover:border-[#FF8C42]"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Special handling for clinic visit - use new enhanced flow
                  if (service.id === 'clinic') {
                    onNavigate('vet-clinic-list');
                  } else {
                    onNavigate('vet-booking', { serviceType: service.id });
                  }
                }}
                onMouseDown={(e) => e.preventDefault()}
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

        {/* Featured Vets */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Vets</h2>
            <button 
              className="text-sm text-[#FF8C42] flex items-center gap-1"
              onClick={() => onNavigate('vet-all-doctors')}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {featuredVets.length > 0 ? (
              featuredVets.slice(0, 3).map((vet, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('vet-doctor-details', { doctorId: vet.id })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {vet.name?.charAt(0) || 'V'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{vet.name || 'Dr. Veterinarian'}</h3>
                      <p className="text-xs text-gray-500 mb-2">{vet.specialty || 'General Veterinarian'}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{vet.rating || 4.8}</span>
                          <span className="text-gray-400">({vet.reviews || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{vet.experience || 5}+ years</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#FF8C42]">₹{vet.fee || 499}</div>
                      <div className="text-xs text-gray-400">per visit</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // Placeholder vets
              [1, 2, 3].map((i) => (
                <Card 
                  key={i}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('vet-tele-consultation')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      D
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Dr. Veterinarian {i}</h3>
                      <p className="text-xs text-gray-500 mb-2">General Veterinarian • MVSc</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">4.8</span>
                          <span className="text-gray-400">(120)</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>8+ years</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#FF8C42]">₹{299 + i * 100}</div>
                      <div className="text-xs text-gray-400">per visit</div>
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
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold">What's New</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Video className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">24/7 Tele Consultation</h3>
                  <p className="text-sm text-gray-600">Connect with vets anytime via video call</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Digital Lab Reports</h3>
                  <p className="text-sm text-gray-600">View reports instantly in your pet's health records</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Live Tracking</h3>
                  <p className="text-sm text-gray-600">Track your vet's location for home visits</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Booking History */}
      {showBookingHistory && (
        <ServiceBookingHistory
          phone={phone}
          serviceType="vet"
          serviceName="Vet"
          onClose={() => setShowBookingHistory(false)}
        />
      )}

      {/* Fixed Bottom Navigation - Matching Customer Home */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 max-w-[430px] mx-auto z-50">
        <div className="flex items-center justify-around">
          <button 
            onClick={() => onNavigate && onNavigate('home')}
            className="flex flex-col items-center gap-1"
          >
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
            onClick={() => setShowBookingHistory(true)}
            className="flex flex-col items-center gap-1"
          >
            <Calendar className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Bookings</span>
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('profile')}
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
    </div>
  );
}