import { useState, useEffect } from 'react';
import { Heart, Calendar, Activity, TrendingUp, ChevronLeft, ChevronRight, Plus, Home as HomeIcon, Scissors, ShoppingBag, Users, User } from 'lucide-react';
import { Button } from '../ui/button';
import logoImage from 'figma:asset/da6636b92da744b3db8eed5288ca6da9ab889afe.png';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CustomerProfileView } from './CustomerProfileView';
import { CustomerPetDetails } from './CustomerPetDetails';
import { CustomerPetProfile } from './CustomerPetProfile';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: number;
  weight?: number;
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

export function CustomerHome({ 
  phone, 
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet 
}: { 
  phone: string; 
  onNavigate: (screen: string) => void;
  onProfileClick?: () => void;
  onPetClick?: (petId: string) => void;
  onAddPet?: () => void;
}) {
  const [userData, setUserData] = useState<UserData>({
    name: 'User',
    phone: '',
    pets: [],
  });
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'home' | 'profile' | 'pet-details' | 'add-pet'>('home');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string>('');

  useEffect(() => {
    loadUserData();
  }, [phone]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      const profileResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      // Load pets
      const petsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/pets/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      let userName = 'User';
      let userPets: Pet[] = [];

      // Get user profile
      if (profileResponse.ok) {
        const profileResult = await profileResponse.json();
        if (profileResult.profile) {
          userName = profileResult.profile.firstName || 'User';
          setUserProfilePhoto(profileResult.profile.photo || '');
        }
      }

      // Get pets
      if (petsResponse.ok) {
        const petsResult = await petsResponse.json();
        if (petsResult.pets && petsResult.pets.pets && petsResult.pets.pets.length > 0) {
          userPets = petsResult.pets.pets.map((pet: any) => ({
            ...pet,
            color: pet.color || '#FF8C42'
          }));
        }
      }

      // If no pets from profile, try to load from onboarding
      if (userPets.length === 0) {
        const responses = await Promise.all([
          fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/onboarding/${phone}/planning`, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }),
          fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/onboarding/${phone}/have-pet`, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }),
          fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/onboarding/${phone}/end-of-life`, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          })
        ]);

        let onboardingData = null;
        let journeyType = '';

        // Find which journey has data
        for (let i = 0; i < responses.length; i++) {
          if (responses[i].ok) {
            const result = await responses[i].json();
            if (result.onboarding) {
              onboardingData = result.onboarding;
              journeyType = ['planning', 'have-pet', 'end-of-life'][i];
              break;
            }
          }
        }

        if (onboardingData) {
          const data = onboardingData.data;
          
          if (journeyType === 'planning' && data.selectedBreeds && data.selectedBreeds.length > 0) {
            userPets = data.selectedBreeds.slice(0, 3).map((breed: any, index: number) => ({
              id: `pet_${index + 1}`,
              name: typeof breed === 'string' ? breed : breed.name,
              type: 'Dog',
              breed: typeof breed === 'string' ? breed : breed.name,
              age: 0,
              color: ['#FF8C42', '#FFB84D', '#4A90E2', '#F5A623'][index % 4]
            }));
          }
        }
      }

      // Default pet if still none
      if (userPets.length === 0) {
        userPets = [{
          id: 'pet_1',
          name: 'Oreo',
          type: 'Dog',
          breed: 'Golden Retriever',
          age: 6,
          weight: 12.5,
          lastCheckup: 'Oct 15',
          mood: 'Happy',
          color: '#FF8C42'
        }];
      }

      setUserData({
        name: userName,
        phone,
        pets: userPets,
      });

      if (userPets.length > 0) {
        setSelectedPet(userPets[0]);
        setSelectedPetId(userPets[0].id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Set default data on error
      setUserData({
        name: 'User',
        phone,
        pets: [{
          id: 'pet_1',
          name: 'Oreo',
          type: 'Dog',
          breed: 'Golden Retriever',
          age: 6,
          weight: 12.5,
          lastCheckup: 'Oct 15',
          mood: 'Happy',
          color: '#FF8C42'
        }],
      });
      setSelectedPet({
        id: 'pet_1',
        name: 'Oreo',
        type: 'Dog',
        breed: 'Golden Retriever',
        age: 6,
        weight: 12.5,
        lastCheckup: 'Oct 15',
        mood: 'Happy',
        color: '#FF8C42'
      });
      setSelectedPetId('pet_1');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPet = () => {
    // Navigate to add pet screen
    if (onAddPet) {
      onAddPet();
    } else {
      onNavigate('add-pet');
    }
  };

  const handleBookService = (service: string) => {
    console.log('Booking service:', service);
    // Navigate to booking screen
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FF8C42] to-[#FFB84D] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FF8C42] to-[#FFB84D] pb-20">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onProfileClick && onProfileClick()}
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/50 transition-all"
            >
              {userProfilePhoto ? (
                <img src={userProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                  {userData.name.charAt(0)}
                </div>
              )}
            </button>
            <div>
              <h1 className="text-white text-xl">Hi, {userData.name}!</h1>
              <p className="text-white/80 text-sm">How's {selectedPet?.name || 'your pet'} today?</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-5 h-5 text-white" />
            </button>
            <button className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Calendar className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Pet Selector */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {userData.pets.map((pet) => (
            <button
              key={pet.id}
              onClick={() => {
                setSelectedPet(pet);
              }}
              onDoubleClick={() => {
                if (onPetClick) {
                  onPetClick(pet.id);
                }
              }}
              className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
                selectedPet?.id === pet.id
                  ? 'bg-white'
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
              <span className={`text-xs ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`}>
                {pet.name}
              </span>
            </button>
          ))}
          <button
            onClick={handleAddPet}
            className="flex-shrink-0 w-16 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-1"
          >
            <Plus className="w-6 h-6 text-white" />
            <span className="text-xs text-white">Add Pet</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-6 pt-6">
        {/* Pet Dashboard */}
        {selectedPet && (
          <div className="bg-white rounded-3xl shadow-lg p-6 mb-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐕</span>
                <div>
                  <h3 className="font-semibold">{selectedPet.name}'s Dashboard</h3>
                  <p className="text-sm text-gray-600">
                    {selectedPet.breed} | {selectedPet.age} years old
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-gray-600">Weight</span>
                </div>
                <p className="font-semibold text-lg">{selectedPet.weight || 0} kg</p>
                <span className="text-xs text-green-600">+0.5%</span>
              </div>

              <div className="bg-pink-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-pink-600" />
                  <span className="text-xs text-gray-600">Checkup</span>
                </div>
                <p className="font-semibold text-lg">{selectedPet.lastCheckup || 'N/A'}</p>
                <span className="text-xs text-gray-500">14 days ago</span>
              </div>

              <div className="bg-green-50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600">Mood</span>
                </div>
                <p className="font-semibold text-lg">{selectedPet.mood || 'Happy'}</p>
                <span className="text-xl">😊</span>
              </div>
            </div>
          </div>
        )}

        {/* Today's Hot Deals */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⚡</span>
            <h2 className="text-lg font-semibold">Today's Hot Deals</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-2 left-2">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs">
                  50% OFF
                </span>
              </div>
              <div className="mt-8 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-1">Vet Checkup</h3>
                <p className="text-sm opacity-90 line-through">₹998</p>
                <p className="text-xl font-bold">₹499</p>
              </div>
              <Button 
                onClick={() => handleBookService('vet-checkup')}
                className="w-full bg-white text-blue-600 hover:bg-white/90"
              >
                Book Now
              </Button>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-2 left-2">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs">
                  30% OFF
                </span>
              </div>
              <div className="mt-8 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                  <Scissors className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-1">Spa & Grooming</h3>
                <p className="text-sm opacity-90 line-through">₹1149</p>
                <p className="text-xl font-bold">₹799</p>
              </div>
              <Button 
                onClick={() => handleBookService('grooming')}
                className="w-full bg-white text-green-600 hover:bg-white/90"
              >
                Book Now
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Services */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Quick Services</h2>
            <button className="text-[#FF8C42] text-sm">See All</button>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <button className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <span className="text-xs text-center">Vet</span>
            </button>
            
            <button className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
                <Scissors className="w-8 h-8 text-green-600" />
              </div>
              <span className="text-xs text-center">Grooming</span>
            </button>
            
            <button className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-purple-600" />
              </div>
              <span className="text-xs text-center">Shop</span>
            </button>
            
            <button className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center">
                <Calendar className="w-8 h-8 text-pink-600" />
              </div>
              <span className="text-xs text-center">Training</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 safe-area-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button className="flex flex-col items-center gap-1 text-[#FF8C42]">
            <HomeIcon className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Scissors className="w-6 h-6" />
            <span className="text-xs">Services</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <ShoppingBag className="w-6 h-6" />
            <span className="text-xs">Store</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <Users className="w-6 h-6" />
            <span className="text-xs">Community</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 text-gray-400">
            <User className="w-6 h-6" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}