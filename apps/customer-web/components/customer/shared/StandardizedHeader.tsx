'use client';

import { 
  Heart, Plus, ChevronRight, ShoppingCart, User,
  Dog, Cat, ArrowLeft, MessageSquare
} from 'lucide-react';
import { WalletIcon } from '../WalletIcon';
import { PresignableImage } from '@/components/shared/PresignableImage';

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
  title?: string; // Page title (omit or leave empty for neutral shell title unless homeGreeting)
  subtitle?: string; // Dynamic subtitle
  /** When true and title is empty, show "Hi, {name}!" (home-style). Default false so inner shells show a neutral title. */
  homeGreeting?: boolean;
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
  homeGreeting = false,
  showBackButton = false,
  showPets = false,
  pets = [],
  selectedPet,
  onPetSelect,
  itemCount = 0,
  customerPhone
}: StandardizedHeaderProps) {
  const trimmedTitle = (title ?? '').trim();
  const displaySubtitle = (subtitle ?? '').trim();
  const neutralShellTitle = 'Warmpawz';

  const handleAddPet = () => {
    if (onAddPet) {
      onAddPet();
    }
  };

  const hasPetsRow = showPets;
  const topRowMb = hasPetsRow ? 'mb-2' : 'mb-0';

  return (
    <div className="relative z-20 isolate mx-auto w-full max-w-customer bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] cw-header-safe-top pb-2 sm:pb-3 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pl-[max(1rem,env(safe-area-inset-left,0px))] sm:pr-[max(1rem,env(safe-area-inset-right,0px))] md:pl-[max(1.5rem,env(safe-area-inset-left,0px))] md:pr-[max(1.5rem,env(safe-area-inset-right,0px))]">
      {/* Top Row - Match footer height: compact py-3, same width */}
      <div className={`flex items-center justify-between min-h-0 ${topRowMb}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {showBackButton && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="relative z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30 pointer-events-auto"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onProfileClick && onProfileClick()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm transition-all hover:ring-2 hover:ring-white/60 md:h-9 md:w-9"
          >
            {userProfilePhoto ? (
              <PresignableImage src={userProfilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              {trimmedTitle ? (
                <h1 className="text-white text-base font-semibold tracking-tight truncate">{trimmedTitle}</h1>
              ) : homeGreeting ? (
                <>
                  <h1 className="min-w-0 flex-1 truncate text-white text-base font-semibold tracking-tight">
                    Hi, {userName}!
                  </h1>
                  <span className="shrink-0 text-sm" role="img" aria-label="wave">👋</span>
                </>
              ) : (
                <h1 className="text-white text-base font-semibold tracking-tight truncate">{neutralShellTitle}</h1>
              )}
            </div>
            {displaySubtitle ? (
              <p className="text-white/70 text-[11px] font-normal tracking-wide truncate">{displaySubtitle}</p>
            ) : homeGreeting && !trimmedTitle ? (
              <p className="truncate text-white/70 text-[11px] font-normal tracking-wide">
                Explore Warmpawz Services
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {customerPhone && (
            <WalletIcon
              customerPhone={customerPhone}
              onClick={() => onNavigate && onNavigate('wallet')}
              size="sm"
              showBalance={true}
            />
          )}
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('booking-messages')}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
            aria-label="Messages"
          >
            <MessageSquare className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => onNavigate && onNavigate('cart')}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm relative transition-colors"
          >
            <ShoppingCart className="w-4 h-4 text-white" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center font-bold">
                {itemCount}
              </span>
            )}
          </button>
          <button className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
            <Heart className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Pet Selector - Compact when shown */}
      {showPets && pets.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-white/90 text-[10px] font-semibold tracking-wider uppercase shrink-0">Your Pets</span>
          <div className="flex min-w-0 gap-2 overflow-x-auto scrollbar-hide flex-1 py-0.5 -my-0.5 px-2">
            {pets.map((pet) => (
              <div key={pet.id} className="relative flex-shrink-0">
                <button
                  onClick={() => {
                    if (onPetSelect) onPetSelect(pet);
                  }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <div 
                    className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${
                      selectedPet?.id === pet.id
                        ? 'bg-white shadow-md ring-2 ring-inset ring-[#FF8C42]'
                        : 'overflow-hidden bg-white/25 backdrop-blur-sm hover:bg-white/35'
                    }`}
                  >
                    {pet.photo || pet.image ? (
                      <div className="h-full w-full overflow-hidden rounded-full">
                        <PresignableImage src={pet.photo || pet.image} alt={pet.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      pet.type === 'Dog' ? (
                        <Dog className={`w-4 h-4 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                      ) : pet.type === 'Cat' ? (
                        <Cat className={`w-4 h-4 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                      ) : (
                        <Heart className={`w-4 h-4 ${selectedPet?.id === pet.id ? 'text-[#FF8C42]' : 'text-white'}`} />
                      )
                    )}
                  </div>
                  <span className={`text-[9px] font-semibold max-w-[36px] truncate ${selectedPet?.id === pet.id ? 'text-white' : 'text-white/80'}`}>
                    {pet.name}
                  </span>
                </button>
                
                {/* Edit/View Button - Only show for selected pet */}
                {selectedPet?.id === pet.id && onPetClick && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPetClick(pet.id);
                    }}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                    title="View / edit pet"
                  >
                    <ChevronRight className="w-2 h-2 text-white" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Add Pet Button */}
            <button
              onClick={handleAddPet}
              className="flex-shrink-0 flex flex-col items-center gap-0.5"
            >
              <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/50 border-dashed hover:bg-white/25 transition-colors">
                <Plus className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[9px] text-white/80 font-semibold">Add</span>
            </button>
          </div>
        </div>
      )}
      
      {/* No Pets State - Compact */}
      {showPets && pets.length === 0 && (
        <button
          onClick={handleAddPet}
          className="w-full bg-white/15 backdrop-blur-sm rounded-lg py-2 px-3 mt-2 border border-white/35 border-dashed flex items-center gap-2 hover:bg-white/25 transition-colors"
        >
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Heart className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-white text-xs font-semibold tracking-tight truncate">Add Your Pet</p>
            <p className="text-white/60 text-[10px] font-normal truncate">Unlock personalized services</p>
          </div>
          <Plus className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
        </button>
      )}
    </div>
  );
}
