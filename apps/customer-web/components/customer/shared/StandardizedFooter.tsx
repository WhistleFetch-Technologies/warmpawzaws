'use client';

import { Home as HomeIcon, ShoppingCart, Calendar, User } from 'lucide-react';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';

interface StandardizedFooterProps {
  currentTab?: 'home' | 'cart' | 'bookings' | 'profile';
  onTabChange?: (tab: 'home' | 'cart' | 'bookings' | 'profile') => void;
  itemCount?: number;
  maxWidth?: string;
}

export function StandardizedFooter({
  currentTab = 'home',
  onTabChange,
  itemCount = 0,
  maxWidth = 'max-w-customer'
}: StandardizedFooterProps) {
  const commerceEnabled = isCustomerEcommerceEnabled();

  const handleTabClick = (tab: 'home' | 'cart' | 'bookings' | 'profile') => {
    if (tab === 'cart' && !commerceEnabled) return;
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const isActive = (tab: string) => currentTab === tab;

  return (
    <div className={`cw-customer-tabbar-fixed fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white ${maxWidth} mx-auto`}>
      {/* Sticky CTAs use --customer-footer-offset in globals.css; safe-area via .cw-customer-tabbar-fixed */}
      <div className="px-4 py-3 sm:px-6">
      <div className="flex items-center justify-around">
        {/* Home Tab */}
        <button 
          onClick={() => handleTabClick('home')}
          className="flex flex-col items-center gap-1"
        >
          <HomeIcon className={`w-6 h-6 ${isActive('home') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs font-medium ${isActive('home') ? 'text-[#FF8C42]' : 'text-gray-400'}`}>
            Home
          </span>
        </button>
        
        {/* Cart Tab */}
        {commerceEnabled ? (
          <button
            type="button"
            onClick={() => handleTabClick('cart')}
            className="relative flex flex-col items-center gap-1"
          >
            <div className="relative">
              <ShoppingCart className={`w-6 h-6 ${isActive('cart') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <span className={`text-xs ${isActive('cart') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
              Cart
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="relative flex flex-col items-center gap-1 opacity-40 cursor-not-allowed"
          >
            <ShoppingCart className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Soon</span>
          </button>
        )}
        
        {/* Bookings Tab */}
        <button 
          onClick={() => handleTabClick('bookings')}
          className="flex flex-col items-center gap-1"
        >
          <Calendar className={`w-6 h-6 ${isActive('bookings') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs ${isActive('bookings') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
            Bookings
          </span>
        </button>
        
        {/* Profile Tab */}
        <button 
          onClick={() => handleTabClick('profile')}
          className="flex flex-col items-center gap-1"
        >
          <User className={`w-6 h-6 ${isActive('profile') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs ${isActive('profile') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
            Profile
          </span>
        </button>
      </div>
      </div>
    </div>
  );
}
