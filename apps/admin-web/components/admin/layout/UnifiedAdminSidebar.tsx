'use client';

import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Globe,
  Megaphone,
  Headphones,
  BookOpen,
  CreditCard,
  Database,
  Calendar,
  FileText,
  Package,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Briefcase,
  Gift,
  Menu,
  X,
  UserCircle,
  Bell,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Tag,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { filterMarketingSidebarNavItems, isLegacyPromotionUiEnabled } from '@/lib/legacy-promotion-ui';
import {
  MARKETING_PORTAL_NAV_GROUPS,
  MARKETING_PORTAL_TOP_LINKS,
  marketingPortalTopLinkActive,
  type MarketingPortalNavGroup,
} from '@/lib/marketing-portal-nav';
import { getStoredAdminPermissions, hasAdminPortalPermission } from '@/lib/admin-permissions';
import { apiClient } from '@/lib/api-client';
import {
  adminPortalNavItemVisible,
  getAdminPortalFooterNavItems,
  getAdminPortalMainNavItems,
  getAdminPortalMarketingNavItems,
  type AdminPortalNavItem,
} from '@warmpawz/shared-types';

const logoImage = '/logo.png';

interface UnifiedAdminSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  'product-analytics': BarChart3,
  enterprise: Briefcase,
  vendors: Users,
  customers: UserCircle,
  ecommerce: ShoppingCart,
  'warmpawz-pay-catalogue': CreditCard,
  'warmpawz-appointments-catalogue': Calendar,
  regions: Globe,
  loyalty: Gift,
  support: Headphones,
  catalog: BookOpen,
  'database-seeding': Database,
  events: Calendar,
  content: FileText,
  'pet-info': Package,
  finance: Wallet,
  refunds: RefreshCw,
  roles: UserCog,
  marketing: Megaphone,
  promotions: Tag,
  'marketing-vendor-promotions': Users,
  'policy-center': Scale,
  'marketing-analytics': BarChart3,
  'marketing-campaigns': Megaphone,
  'notification-engine': Bell,
  reports: BarChart3,
  'platform-settings': Settings,
};

function navOnClick(item: AdminPortalNavItem, onNavigate: (view: string) => void): () => void {
  if (item.id === 'vendors') {
    return () => {
      window.location.href = '/vendors';
    };
  }
  if (item.id === 'customers') {
    return () => {
      window.location.href = '/customers';
    };
  }
  if (item.id === 'refunds') {
    return () => {
      window.location.href = '/refunds';
    };
  }
  if (item.id === 'notification-engine') {
    return () => {
      window.location.href = '/notification-engine';
    };
  }
  if (item.id === 'promotions') {
    return () => {
      window.location.href = '/promotion-center';
    };
  }
  if (item.id === 'marketing-vendor-promotions') {
    return () => {
      window.location.href = '/marketing/vendor-promotions';
    };
  }
  if (item.id === 'policy-center') {
    return () => {
      window.location.href = '/policy-center';
    };
  }
  if (item.id === 'marketing-analytics') {
    return () => {
      window.location.href = '/marketing/analytics';
    };
  }
  if (item.id === 'marketing-campaigns') {
    return () => {
      window.location.href = '/marketing/campaigns';
    };
  }
  if (item.id === 'warmpawz-pay-catalogue') {
    return () => {
      window.location.href = '/warmpawz-pay/catalogue';
    };
  }
  if (item.id === 'warmpawz-appointments-catalogue') {
    return () => {
      window.location.href = item.routeHint ?? '/warmpawz-appointments/catalogue';
    };
  }
  return () => onNavigate(item.id);
}

function isNavItemActive(item: AdminPortalNavItem, activeView: string, pathname: string | null): boolean {
  if (activeView === item.id) return true;
  if (item.id === 'vendors') {
    return activeView === 'vendor-admin' || activeView === 'vendor-management' || pathname === '/vendors';
  }
  if (item.id === 'customers') {
    return activeView === 'customer-admin' || pathname === '/customers';
  }
  if (item.id === 'regions') {
    return activeView === 'region-manager';
  }
  if (item.id === 'catalog') {
    return activeView === 'catalog-and-services';
  }
  if (item.id === 'marketing') {
    return pathname?.startsWith('/marketing') ?? false;
  }
  if (item.id === 'promotions') {
    return pathname?.startsWith('/promotions') ?? false;
  }
  if (item.id === 'marketing-vendor-promotions') {
    return pathname?.startsWith('/marketing/vendor-promotions') ?? false;
  }
  if (item.id === 'policy-center') {
    return pathname?.startsWith('/policy-center') ?? false;
  }
  if (item.id === 'marketing-analytics') {
    return pathname?.startsWith('/marketing/analytics') ?? false;
  }
  if (item.id === 'marketing-campaigns') {
    return pathname?.startsWith('/marketing/campaigns') ?? false;
  }
  if (item.id === 'notification-engine') {
    return pathname?.startsWith('/notification-engine') ?? false;
  }
  if (item.pathPrefixes?.length && pathname) {
    return item.pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }
  return false;
}

function canSeeMarketingLink(permissionNavId: string, hydrated: boolean): boolean {
  if (!hydrated) return true;
  const item = getAdminPortalMarketingNavItems().find((i) => i.id === permissionNavId);
  if (!item) return true;
  return canSeeNavItem(item, hydrated);
}

function isMarketingPortalLinkActive(href: string, pathname: string | null, searchParams: URLSearchParams | null): boolean {
  if (!pathname) return false;
  const [path, query = ''] = href.split('?');
  const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;
  if (!query) return true;
  const expected = new URLSearchParams(query);
  const actual = searchParams ?? new URLSearchParams();
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

function isMarketingPortalGroupActive(
  group: MarketingPortalNavGroup,
  pathname: string | null,
  searchParams: URLSearchParams | null
): boolean {
  return group.links.some((link) => isMarketingPortalLinkActive(link.href, pathname, searchParams));
}

function canSeeNavItem(item: AdminPortalNavItem, hydrated: boolean): boolean {
  if (!hydrated) return true;
  const perms = getStoredAdminPermissions();
  if (item.permissionsAny?.length) {
    return hasAdminPortalPermission(item.permissionsAny);
  }
  return adminPortalNavItemVisible(item, perms);
}

export function UnifiedAdminSidebar({ activeView, onNavigate }: UnifiedAdminSidebarProps) {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const legacyMarketingNav = isLegacyPromotionUiEnabled();
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [openMarketingGroups, setOpenMarketingGroups] = useState<Record<string, boolean>>({
    'marketing-hub': true,
    promotions: true,
    notifications: false,
  });

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const inMarketing =
      pathname?.startsWith('/marketing') ||
      pathname?.startsWith('/notification-engine') ||
      pathname?.startsWith('/notifications') ||
      pathname?.startsWith('/promotion-center') ||
      pathname?.startsWith('/promotions') ||
      pathname?.startsWith('/policy-center');
    if (inMarketing) {
      setMarketingOpen(true);
    }
    if (!legacyMarketingNav && pathname) {
      setOpenMarketingGroups((prev) => {
        const next = { ...prev };
        for (const group of MARKETING_PORTAL_NAV_GROUPS) {
          if (isMarketingPortalGroupActive(group, pathname, searchParams)) {
            next[group.id] = true;
          }
        }
        return next;
      });
    }
  }, [pathname, searchParams, legacyMarketingNav]);

  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) setOpen(true);
  }, []);

  const handleSignOut = async () => {
    apiClient.clearAuth();
    window.location.href = '/';
  };

  const mainNavItems = useMemo(() => getAdminPortalMainNavItems(), []);
  const footerNavItems = useMemo(() => getAdminPortalFooterNavItems(), []);
  const marketingNavItems = useMemo(() => getAdminPortalMarketingNavItems(), []);

  const visibleMainNav = useMemo(() => {
    if (!hydrated) return mainNavItems;
    const perms = getStoredAdminPermissions();
    if (perms.includes('admin.full_access') || perms.includes('*')) return mainNavItems;
    return mainNavItems.filter((item) => canSeeNavItem(item, hydrated));
  }, [hydrated, mainNavItems, pathname, activeView]);

  const visibleMarketingNav = useMemo(() => {
    if (!hydrated) return marketingNavItems;
    const permitted = marketingNavItems.filter((item) => canSeeNavItem(item, hydrated));
    return filterMarketingSidebarNavItems(permitted);
  }, [hydrated, marketingNavItems, pathname, activeView]);

  const visibleMarketingTopLinks = useMemo(() => {
    return MARKETING_PORTAL_TOP_LINKS.filter((link) =>
      canSeeMarketingLink(link.permissionNavId, hydrated)
    );
  }, [hydrated]);

  const visibleMarketingPortalGroups = useMemo(() => {
    return MARKETING_PORTAL_NAV_GROUPS.map((group) => ({
      ...group,
      links: group.links.filter((link) => canSeeMarketingLink(link.permissionNavId, hydrated)),
    })).filter((group) => group.links.length > 0);
  }, [hydrated]);

  const marketingSectionActive =
    pathname?.startsWith('/marketing') ||
    pathname?.startsWith('/notification-engine') ||
    pathname?.startsWith('/notifications') ||
    pathname?.startsWith('/promotion-center') ||
    pathname?.startsWith('/promotions') ||
    pathname?.startsWith('/policy-center') ||
    false;

  const visibleFooterNav = useMemo(() => {
    if (!hydrated) return footerNavItems;
    const perms = getStoredAdminPermissions();
    if (perms.includes('admin.full_access') || perms.includes('*')) return footerNavItems;
    return footerNavItems.filter((item) => canSeeNavItem(item, hydrated));
  }, [hydrated, footerNavItems]);

  const sidebarWidth = 256;

  return (
    <>
      {!open && (
        <button
          className="fixed cursor-pointer top-4 left-4 z-40 bg-white border border-gray-200 rounded-full p-2 shadow-md hover:shadow-lg transition-all hover:bg-gray-50"
          onClick={() => setOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 transition-all duration-300 cursor-pointer backdrop-blur-sm bg-black/20"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-50 h-screen transition-transform duration-300 ease-in-out shadow-xl ${open ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}`}
        style={{ WebkitOverflowScrolling: 'touch', width: sidebarWidth }}
      >
        {open && (
          <button
            className="absolute cursor-pointer top-4 right-4 z-50 bg-white border border-gray-200 rounded-full p-1 shadow transition-opacity hover:bg-gray-100"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        )}

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Warmpawz" className="w-10 h-10" />
            <div>
              <h2 className="text-[#FF8C42] font-bold">Warmpawz</h2>
              <span className="text-xs text-gray-500">Admin Portal</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
              Main Menu
            </h3>
            <nav className="space-y-1">
              {visibleMainNav.map((item) => {
                const Icon = NAV_ICONS[item.id] ?? LayoutDashboard;
                const isActive = isNavItemActive(item, activeView, pathname);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navOnClick(item, onNavigate)();
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-lg ${
                      isActive
                        ? 'text-[#FF8C42] bg-orange-50 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}

              {(legacyMarketingNav ? visibleMarketingNav.length > 0 : visibleMarketingTopLinks.length > 0) && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setMarketingOpen((v) => !v)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-lg ${
                      marketingSectionActive
                        ? 'text-[#FF8C42] bg-orange-50 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1 text-left">Marketing</span>
                    {marketingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {marketingOpen && legacyMarketingNav && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-2">
                      {visibleMarketingNav.map((item) => {
                        const ChildIcon = NAV_ICONS[item.id] ?? Megaphone;
                        const childActive = isNavItemActive(item, activeView, pathname);
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              navOnClick(item, onNavigate)();
                              setOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors rounded-lg ${
                              childActive
                                ? 'text-[#FF8C42] bg-orange-50 font-medium'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            <ChildIcon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {marketingOpen && !legacyMarketingNav && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-2">
                      {visibleMarketingTopLinks.map((link) => {
                        const linkActive = marketingPortalTopLinkActive(link, pathname);
                        return (
                          <button
                            key={link.id}
                            type="button"
                            onClick={() => {
                              window.location.href = link.href;
                              setOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors rounded-lg ${
                              linkActive
                                ? 'text-[#FF8C42] bg-orange-50 font-medium'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            {link.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>

        <div className="border-t border-gray-200 p-3 space-y-1">
          {visibleFooterNav.map((item) => {
            const Icon = NAV_ICONS[item.id] ?? Settings;
            const isActive = isNavItemActive(item, activeView, pathname);
            return (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'text-[#FF8C42] bg-orange-50 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                onClick={() => {
                  navOnClick(item, onNavigate)();
                  setOpen(false);
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
