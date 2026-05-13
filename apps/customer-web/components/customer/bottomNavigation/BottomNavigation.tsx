"use client";

import { Home, ShoppingCart, Calendar, User } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';

interface BottomNavigationProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onProfileClick?: () => void;
}

export function BottomNavigation({ currentScreen, onNavigate, onProfileClick }: BottomNavigationProps) {
  const { itemCount } = useCart();
  const commerceEnabled = isCustomerEcommerceEnabled();

  const isActive = (screen: string) => {
    // Map screen names to navigation tabs - only highlight when exactly on that screen
    // For service screens (nutritionist, vet, grooming, etc.), no tab should be active
    if (screen === 'home') {
      return currentScreen === 'home';
    }
    if (screen === 'cart') {
      return currentScreen === 'cart' || currentScreen === 'checkout';
    }
    if (screen === 'bookings') {
      return currentScreen === 'my-bookings' || currentScreen === 'appointments';
    }
    if (screen === 'profile') {
      return (
        currentScreen === 'customer-profile' ||
        currentScreen === 'user-profile' ||
        currentScreen === 'my-packages'
      );
    }
    // For all other screens (like nutritionist, vet, etc.), no tab should be active
    return false;
  };

  const handleNavClick = (screen: string) => {
    if (screen === 'profile' && onProfileClick) {
      onProfileClick();
    } else {
      onNavigate(screen);
    }
  };

  return (
    <div className="cw-customer-tabbar-fixed fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-customer border-t border-gray-200 bg-white">
      <div className="flex items-center justify-around px-4 py-3 sm:px-6">
        {/* Home Tab */}
        <button 
          onClick={() => handleNavClick('home')}
          className="flex flex-col items-center gap-1"
        >
          <Home className={`w-6 h-6 ${isActive('home') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs font-medium ${isActive('home') ? 'text-[#FF8C42]' : 'text-gray-400'}`}>
            Home
          </span>
        </button>

        {/* Cart Tab — disabled until customer marketplace is enabled */}
        <button
          type="button"
          disabled={!commerceEnabled}
          onClick={() => commerceEnabled && handleNavClick('cart')}
          className={`relative flex flex-col items-center gap-1 ${!commerceEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
          aria-disabled={!commerceEnabled}
        >
          <div className="relative">
            <ShoppingCart className={`w-6 h-6 ${isActive('cart') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
            {commerceEnabled && itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          <span className={`text-xs ${isActive('cart') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
            {commerceEnabled ? 'Cart' : 'Soon'}
          </span>
        </button>

        {/* Bookings Tab */}
        <button 
          onClick={() => handleNavClick('my-bookings')}
          className="flex flex-col items-center gap-1"
        >
          <Calendar className={`w-6 h-6 ${isActive('bookings') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs ${isActive('bookings') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
            Bookings
          </span>
        </button>

        {/* Profile Tab */}
        <button 
          onClick={() => handleNavClick('profile')}
          className="flex flex-col items-center gap-1"
        >
          <User className={`w-6 h-6 ${isActive('profile') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs ${isActive('profile') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
            Profile
          </span>
        </button>
      </div>
      
      {/* Optional home indicator — keep subtle on devices with safe area */}
      <div className="flex justify-center pb-1 sm:pb-2">
        <div className="h-1 w-28 rounded-full bg-black/10 sm:bg-black/20" aria-hidden />
      </div>
    </div>
  );
}