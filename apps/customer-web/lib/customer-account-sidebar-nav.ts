import type { AppRouterInstance } from 'next/navigation';
import {
  rememberBeforeMyPackagesNav,
  rememberHelpBackFromCurrentUrl,
  rememberPromotionsBackFromCurrentUrl,
  rememberShopBackFromCurrentUrl,
} from '@/lib/go-back-or-replace';

/** Route account-menu actions from standalone Next.js pages (search, my-packages, etc.). */
export function navigateFromStandaloneAccountMenu(router: AppRouterInstance, path: string) {
  if (path === 'home') {
    router.push('/');
    return;
  }
  if (path === 'shop') {
    rememberShopBackFromCurrentUrl();
    router.push('/shop');
    return;
  }
  if (path === 'account/orders' || path === 'orders') {
    router.push('/orders');
    return;
  }
  if (path === 'account/addresses' || path === 'addresses') {
    router.push('/profile');
    return;
  }
  if (path === 'wallet' || path === 'account/wallet') {
    router.push('/wallet');
    return;
  }
  if (path === 'my-packages') {
    rememberBeforeMyPackagesNav();
    router.push('/my-packages');
    return;
  }
  if (path === 'rewards-loyalty') {
    router.push('/rewards');
    return;
  }
  if (path === 'referral-system') {
    router.push('/referrals');
    return;
  }
  if (path === 'appointments') {
    router.push('/bookings');
    return;
  }
  if (path === 'support_help' || path === 'help') {
    rememberHelpBackFromCurrentUrl();
    router.push('/help');
    return;
  }
  if (path === 'promotions' || path === 'offers') {
    rememberPromotionsBackFromCurrentUrl();
    router.push('/promotions');
    return;
  }
  router.push(`/${path.replace(/^\//, '')}`);
}
