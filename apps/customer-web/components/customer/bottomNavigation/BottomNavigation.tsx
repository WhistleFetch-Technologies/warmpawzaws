"use client";

import { Home, ShoppingBag, Calendar, User, QrCode } from 'lucide-react';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { isShopUiVisibleForAccount, readStoredCustomerPhone } from '@/lib/app-review-demo-account';
import { useProfileMenuOpen } from '@/lib/profile-menu-open-context';
import { isWarmpawzPayEnabled } from '@/lib/warmpawz-pay/wpay-feature-flag';

interface BottomNavigationProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  onProfileClick?: () => void;
  profileMenuOpen?: boolean;
}

export function BottomNavigation({
  currentScreen,
  onNavigate,
  onProfileClick,
  profileMenuOpen: profileMenuOpenProp,
}: BottomNavigationProps) {
  const shopTabVisible = isShopUiVisibleForAccount(readStoredCustomerPhone());
  const commerceEnabled = shopTabVisible && isCustomerEcommerceEnabled();
  const profileMenuOpenContext = useProfileMenuOpen();
  const profileMenuOpen = profileMenuOpenProp ?? profileMenuOpenContext;

  if (profileMenuOpen) {
    return null;
  }

  const isActive = (screen: string) => {
    if (screen === 'home') {
      return currentScreen === 'home';
    }
    if (screen === 'shop') {
      return currentScreen === 'shop';
    }
    if (screen === 'bookings') {
      return currentScreen === 'my-bookings' || currentScreen === 'appointments';
    }
    if (screen === 'warmpawz-pay') {
      return currentScreen === 'warmpawz-pay';
    }
    if (screen === 'profile') {
      return (
        profileMenuOpen ||
        currentScreen === 'customer-profile' ||
        currentScreen === 'user-profile' ||
        currentScreen === 'my-packages' ||
        currentScreen === 'account-menu'
      );
    }
    return false;
  };

  const handleNavClick = (screen: string) => {
    if (screen === 'profile' && onProfileClick) {
      onProfileClick();
    } else {
      onNavigate(screen);
    }
  };

  const profileActive = isActive('profile');
  const wpayEnabled = isWarmpawzPayEnabled();

  return (
    <div className="cw-customer-tabbar-fixed fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-customer border-t border-gray-200 bg-white">
      <div className="relative flex items-end justify-around px-2 pb-2 pt-2 sm:px-4">
        <button onClick={() => handleNavClick('home')} className="flex flex-col items-center gap-1">
          <Home className={`w-6 h-6 ${isActive('home') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs font-medium ${isActive('home') ? 'text-[#FF8C42]' : 'text-gray-400'}`}>
            Home
          </span>
        </button>

        {shopTabVisible ? (
          commerceEnabled ? (
            <button
              type="button"
              onClick={() => handleNavClick('shop')}
              className="flex flex-col items-center gap-1"
            >
              <ShoppingBag className={`w-6 h-6 ${isActive('shop') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
              <span className={`text-xs ${isActive('shop') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
                Shop
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex flex-col items-center gap-1 opacity-40 cursor-not-allowed"
            >
              <ShoppingBag className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-400">Soon</span>
            </button>
          )
        ) : null}

        {wpayEnabled ? (
          <button
            type="button"
            onClick={() => handleNavClick('warmpawz-pay')}
            className="-mt-6 flex flex-col items-center gap-0.5"
            aria-label="Warmpawz Pay"
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg ${
                isActive('warmpawz-pay') ? 'bg-[#FF6B00] ring-4 ring-orange-100' : 'bg-[#FF8C42]'
              }`}
            >
              <QrCode className="h-7 w-7 text-white" />
            </div>
            <span
              className={`text-[10px] font-semibold ${
                isActive('warmpawz-pay') ? 'text-[#FF6B00]' : 'text-[#FF8C42]'
              }`}
            >
              SCAN TO PAY
            </span>
          </button>
        ) : null}

        <button onClick={() => handleNavClick('my-bookings')} className="flex flex-col items-center gap-1">
          <Calendar className={`w-6 h-6 ${isActive('bookings') ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
          <span className={`text-xs ${isActive('bookings') ? 'text-[#FF8C42] font-medium' : 'text-gray-400'}`}>
            Bookings
          </span>
        </button>

        <button onClick={() => handleNavClick('profile')} className="flex flex-col items-center gap-0.5">
          <div
            className={`flex items-center justify-center rounded-2xl px-5 py-1.5 transition-all ${
              profileActive ? 'bg-orange-100' : ''
            }`}
          >
            <User
              className={`h-6 w-6 ${profileActive ? 'text-[#FF8C42]' : 'text-gray-400'}`}
              strokeWidth={profileActive ? 2.25 : 2}
            />
          </div>
          <span className={`text-xs ${profileActive ? 'font-semibold text-[#FF8C42]' : 'text-gray-400'}`}>
            Profile
          </span>
        </button>
      </div>

      <div className="flex justify-center pb-1 sm:pb-2">
        <div className="h-1 w-28 rounded-full bg-black/10 sm:bg-black/20" aria-hidden />
      </div>
    </div>
  );
}
