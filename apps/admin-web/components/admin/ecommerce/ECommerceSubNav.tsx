'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Package,
  ShoppingCart,
  Percent,
  BarChart3,
  Settings,
  FileText,
  Tag,
  Megaphone,
  LineChart,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ECommerceNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefix?: string;
};

const NAV: ECommerceNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/ecommerce', icon: LayoutDashboard, matchPrefix: '/ecommerce' },
  { id: 'sellers', label: 'Sellers', href: '/ecommerce?tab=sellers', icon: Store },
  { id: 'products', label: 'Product Approval', href: '/ecommerce?tab=products', icon: Package },
  { id: 'orders', label: 'Orders', href: '/ecommerce?tab=orders', icon: ShoppingCart },
  { id: 'marketplace-analytics', label: 'Marketplace Analytics', href: '/ecommerce?tab=analytics', icon: BarChart3 },
  { id: 'categories', label: 'Categories', href: '/ecommerce?tab=categories', icon: FileText },
  { id: 'promotions', label: 'Promotions & Coupons', href: '/ecommerce/promotions', icon: Tag, matchPrefix: '/ecommerce/promotions' },
  { id: 'seller-promotions', label: 'Seller Promotions', href: '/ecommerce/seller-promotions', icon: Store, matchPrefix: '/ecommerce/seller-promotions' },
  { id: 'campaigns', label: 'Campaigns', href: '/ecommerce/campaigns', icon: Megaphone, matchPrefix: '/ecommerce/campaigns' },
  { id: 'promotion-analytics', label: 'Promotion Analytics', href: '/ecommerce/analytics', icon: LineChart, matchPrefix: '/ecommerce/analytics' },
  { id: 'commission', label: 'Commission', href: '/ecommerce?tab=commission', icon: Percent },
  { id: 'policies', label: 'Policies', href: '/ecommerce/policy', icon: Settings, matchPrefix: '/ecommerce/policy' },
];

function tabFromHref(href: string): string | null {
  const q = href.indexOf('?');
  if (q === -1) return null;
  return new URLSearchParams(href.slice(q + 1)).get('tab');
}

function isActive(
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams>,
  item: ECommerceNavItem
): boolean {
  if (!pathname) return false;
  if (item.id === 'promotions') {
    if (pathname.startsWith('/ecommerce/coupons')) return true;
    return pathname.startsWith('/ecommerce/promotions');
  }
  if (item.matchPrefix && item.matchPrefix !== '/ecommerce') {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.href.startsWith('/ecommerce/')) {
    const baseHref = item.href.split('?')[0];
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  }
  if (pathname === '/ecommerce') {
    const currentTab = searchParams.get('tab');
    const itemTab = tabFromHref(item.href);
    if (itemTab) {
      return currentTab === itemTab;
    }
    if (item.id === 'dashboard') {
      return !currentTab || currentTab === 'dashboard';
    }
  }
  return false;
}

export function ECommerceSubNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, searchParams, item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#FF8C42] text-[#FF8C42]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ECommercePageHeader({
  title = 'E-Commerce Management',
  subtitle = 'Manage your multi-vendor marketplace',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <h1 className="text-black">{title}</h1>
        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
