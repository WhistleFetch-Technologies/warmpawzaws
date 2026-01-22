import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, ShoppingCart } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useCart } from '../../../context/CartContext';

interface CustomerServiceHeaderProps {
  phone: string;
  title?: string;           // Optional title like "Vet Services"
  subtitle?: string;        // Optional subtitle
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  showBackButton?: boolean;
}

export function CustomerServiceHeader({ 
  phone, 
  title,
  subtitle,
  onBack, 
  onNavigate,
  showBackButton = true
}: CustomerServiceHeaderProps) {
  const [userName, setUserName] = useState('User');
  const [userPhoto, setUserPhoto] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const { itemCount } = useCart();

  useEffect(() => {
    loadUserData();
  }, [phone]);

  const loadUserData = async () => {
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      
      // Load profile and pets in parallel
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
        if (petList.length > 0) {
          setSelectedPetId(petList[0].id);
        }
      }

      if (walletRes.ok) {
        const data = await walletRes.json();
        setWalletBalance(data.balance || data.wallet?.balance || 0);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  return (
    <>
      {/* Status Bar - Matching Home */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-white text-sm font-medium">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <path d="M1 4.5H2.5V11H1V4.5Z" fill="white" fillOpacity="0.4"/>
            <path d="M4.5 3H6V11H4.5V3Z" fill="white" fillOpacity="0.6"/>
            <path d="M8 1.5H9.5V11H8V1.5Z" fill="white" fillOpacity="0.8"/>
            <path d="M11.5 0H13V11H11.5V0Z" fill="white"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M8 2.4C11.6 2.4 14.6 4.5 16 7.5C14.6 10.5 11.6 12 8 12C4.4 12 1.4 10.5 0 7.5C1.4 4.5 4.4 2.4 8 2.4Z" fill="white" fillOpacity="0.4"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="white" strokeOpacity="0.4"/>
            <rect x="2" y="2" width="18" height="8" rx="1" fill="white"/>
            <path d="M23 4V8C23.8 7.7 24 6.8 24 6C24 5.2 23.8 4.3 23 4Z" fill="white" fillOpacity="0.4"/>
          </svg>
        </div>
      </div>

      {/* Main Header - Matching Home Page Style */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pb-6">
        {/* Back button row (if enabled) */}
        {showBackButton && (
          <button 
            onClick={onBack}
            className="mb-3 flex items-center gap-2 text-white/90 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
        )}
        
        {/* User Info Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate?.('profile')}
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
              <p className="text-white/80 text-sm">{subtitle || 'Explore WarmPawz Services'}</p>
            </div>
          </div>
          
          {/* Right side icons */}
          <div className="flex items-center gap-3">
            {/* Wallet */}
            <button 
              onClick={() => onNavigate?.('wallet')}
              className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5"
            >
              <span className="text-white text-lg">₹</span>
              <span className="text-white font-semibold">{walletBalance}</span>
            </button>
            
            {/* Cart */}
            <button 
              onClick={() => onNavigate?.('cart')}
              className="relative p-2"
            >
              <ShoppingCart className="w-6 h-6 text-white" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
            
            {/* Favorites */}
            <button 
              onClick={() => onNavigate?.('favorites')}
              className="p-2"
            >
              <Heart className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* YOUR PETS Section */}
        {pets.length > 0 && (
          <div className="mb-2">
            <p className="text-white/80 text-xs font-medium mb-2">YOUR PETS</p>
            <div className="flex items-center gap-3">
              {pets.slice(0, 3).map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => {
                    setSelectedPetId(pet.id);
                    onNavigate?.('pet-details', { petId: pet.id });
                  }}
                  className={`flex flex-col items-center ${selectedPetId === pet.id ? 'opacity-100' : 'opacity-70'}`}
                >
                  <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${
                    selectedPetId === pet.id ? 'border-white' : 'border-white/40'
                  } flex items-center justify-center bg-white/20`}>
                    {pet.photo || pet.image ? (
                      <img src={pet.photo || pet.image} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-lg">
                        {pet.type === 'dog' ? '🐕' : pet.type === 'cat' ? '🐱' : '🐾'}
                      </span>
                    )}
                  </div>
                  <span className="text-white text-xs mt-1">{pet.name}</span>
                  {selectedPetId === pet.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white mt-1" />
                  )}
                </button>
              ))}
              
              {/* Add Pet Button */}
              <button
                onClick={() => onNavigate?.('add-pet')}
                className="flex flex-col items-center opacity-70 hover:opacity-100"
              >
                <div className="w-12 h-12 rounded-full border-2 border-white/40 border-dashed flex items-center justify-center">
                  <span className="text-white text-2xl">+</span>
                </div>
                <span className="text-white text-xs mt-1">Add</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
