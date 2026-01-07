'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Capability {
  id: string;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  category: 'core' | 'services' | 'specialized' | 'operations' | 'finance' | 'communication';
  route: string;
}

interface VendorDynamicNavigationProps {
  enabledCapabilities: Capability[];
  vendorType?: 'solo' | 'business';
}

const categoryLabels: Record<string, string> = {
  core: 'Core',
  services: 'Services',
  specialized: 'Specialized',
  operations: 'Operations',
  finance: 'Finance',
  communication: 'Communication',
};

const categoryOrder = ['core', 'services', 'specialized', 'operations', 'finance', 'communication'];

export function VendorDynamicNavigation({ enabledCapabilities, vendorType }: VendorDynamicNavigationProps) {
  const pathname = usePathname();

  // Group capabilities by category
  const groupedCapabilities = enabledCapabilities.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, Capability[]>);

  // Core capabilities for main navigation (always visible)
  const coreNavItems = groupedCapabilities.core || [];

  // Other capabilities grouped by category
  const otherCategories = categoryOrder.filter(cat => cat !== 'core' && groupedCapabilities[cat]);

  const isActive = (route: string) => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(route);
  };

  return (
    <nav className="bg-white rounded-2xl shadow-sm p-4 sticky top-20 space-y-6">
      {/* Core Navigation */}
      {coreNavItems.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
            {categoryLabels.core}
          </h3>
          <div className="space-y-1">
            {coreNavItems.map((cap) => (
              <Link
                key={cap.id}
                href={cap.route}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                  isActive(cap.route)
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                <span className="text-xl">{cap.icon}</span>
                <span className="text-sm font-medium">{cap.display_name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Other Categories */}
      {otherCategories.map((category) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
            {categoryLabels[category]}
          </h3>
          <div className="space-y-1">
            {groupedCapabilities[category].map((cap) => (
              <Link
                key={cap.id}
                href={cap.route}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                  isActive(cap.route)
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                <span className="text-xl">{cap.icon}</span>
                <span className="text-sm font-medium">{cap.display_name}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

