'use client';

import { 
  Heart, Plus, ChevronRight, ShoppingCart, User,
  Dog, Cat, ArrowLeft
} from 'lucide-react';
import { WalletIcon } from '../WalletIcon';

interface Pet {
  id: string;
  name: string;
  type: string;
  photo?: string;
  image?: string;
}

interface StandardizedHeaderProps {
  // User data
  userName: string;
  userProfilePhoto?: string;
  
  // Navigation
  onNavigate?: (screen: string, data?: any) => void;
  onProfileClick?: () => void;
  onPetClick?: (petId: string) => void;
  onAddPet?: () => void;
  onBack?: () => void;
  
  // Display options
  title?: string; // Dynamic page title (default: greeting)
  subtitle?: string; // Dynamic subtitle
  showBackButton?: boolean; // Show back button (default: false for home)
  showPets?: boolean; // Show pet selector (default: true on home)
  
  // Pets data
  pets?: Pet[];
  selectedPet?: Pet | null;
  onPetSelect?: (pet: Pet) => void;
  
  // Cart
  itemCount?: number;
  customerPhone?: string;
}

export function StandardizedHeader({
  userName = 'User',
  userProfilePhoto,
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet,
  onBack,
  title,
  subtitle,
  showBackButton = false,
  showPets = false,
  pets = [],
  selectedPet,
  onPetSelect,
  itemCount = 0,
  customerPhone
}: StandardizedHeaderProps) {
  // Default title is greeting, or use provided title
  // If title is provided, use it; otherwise show greeting with emoji on home screen only
  const displayTitle = title || '';
  const displaySubtitle = subtitle || '';
  
  const handleAddPet = () => {
    if (onAddPet) {
      onAddPet();
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-4 pt-4 pb-4">
      {/* Top Row - Back Button (if needed) / User Info & Actions */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Back Button - Only show when not on home */}
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          
          {/* Profile Avatar */}
          <button 
            onClick={() => onProfileClick && onProfileClick()}
            className="w-11 h-11 bg-white rounded-full flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-white/60 transition-all shadow-md"
          >
            {userProfilePhoto ? (
              <img src={userProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-base font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          
          {/* Title & Subtitle */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              {displayTitle ? (
                <h1 className="text-white text-lg font-bold tracking-tight">{displayTitle}</h1>
              ) : (
                <h1 className="text-white text-lg font-bold tracking-tight">
                  Hi, {userName}!
                  <span className="text-base ml-1" role="img" aria-label="wave">👋</span>
                </h1>
              )}
            </div>
            {displaySubtitle ? (
              <p className="text-white/65 text-xs font-normal tracking-wide">{displaySubtitle}</p>
            ) : !displayTitle ? (
              <p className="text-white/65 text-xs font-normal tracking-wide">Explore WarmPawz Services</p>
            ) : null}
          </div>
        </div>
        
        {/* Analytics Icons */}
        <div className="flex items-center gap-1.5">
          {/* Wallet Icon */}
          {customerPhone && (
            <WalletIcon
              customerPhone={customerPhone}
              onClick={() => onNavigate && onNavigate('wallet')}
              size="sm"
              showBalance={true}
            />
          )}
          
          {/* Cart Icon */}
          <button 
            onClick={() => onNavigate && onNavigate('cart')}
            className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm relative transition-colors"
          >
            <ShoppingCart className="w-[18px] h-[18px] text-white" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-[18px] h-[18px] flex items-center justify-center font-bold shadow-sm">
                {itemCount}
              </span>
            )}
          </button>
          
          {/* Favorites Icon */}
          <button className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
            <Heart className="w-[18px] h-[18px] text-white" />
          </button>
        </div>
      </div>

      {/* Pet Selector - Only show on home screen */}
      {showPets && pets.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-white/90 text-[11px] font-semibold tracking-wider uppercase shrink-0">Your Pets</span>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide flex-1">
            {pets.map((pet) => (
              <div key={pet.id} className="relative flex-shrink-0">
                <button
                  onClick={() => {
                    if (onPetSelect) onPetSelect(pet);
                  }}
                  className="flex flex-col items-center gap-1"
                >
                  <div 
                    className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200 ${
                      selectedPet?.id === pet.id
                        ? 'ring-2 ring-white bg-white shadow-md scale-105'
                        : 'bg-white/25 backdrop-blur-sm hover:bg-white/35'
                    }`}
                  >
                    {pet.photo || pet.image ? (
                      <img src={pet.photo || pet.image} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      pet.type === 'Dog' ? (
                        <Dog className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                      ) : pet.type === 'Cat' ? (
                        <Cat className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                      ) : (
                        <Heart className={`w-5 h-5 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                      )
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold max-w-[44px] truncate ${selectedPet?.id === pet.id ? 'text-white' : 'text-white/80'}`}>
                    {pet.name}
                  </span>
                </button>
                
                {/* Edit/View Button - Only show for selected pet */}
                {selectedPet?.id === pet.id && onPetClick && (
                  <button
                    onClick={() => onPetClick(pet.id)}
                    className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-blue-500 rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                    title="View/Edit Pet Profile"
                  >
                    <ChevronRight className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Add Pet Button */}
            <button
              onClick={handleAddPet}
              className="flex-shrink-0 flex flex-col items-center gap-1"
            >
              <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center border-[1.5px] border-white/50 border-dashed hover:bg-white/25 transition-colors">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] text-white/80 font-semibold">Add</span>
            </button>
          </div>
        </div>
      )}
      
      {/* No Pets State - Only show on home */}
      {showPets && pets.length === 0 && (
        <button
          onClick={handleAddPet}
          className="w-full bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-3 border border-white/35 border-dashed flex items-center gap-2.5 hover:bg-white/25 transition-colors"
        >
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
            <Heart className="w-4 h-4 text-white" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white text-sm font-semibold tracking-tight">Add Your Pet</p>
            <p className="text-white/60 text-[11px] font-normal">Unlock personalized services</p>
          </div>
          <Plus className="w-4 h-4 text-white/80" />
        </button>
      )}
    </div>
  );
}
