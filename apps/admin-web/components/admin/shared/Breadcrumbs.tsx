'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation component
 * Automatically generates breadcrumbs from pathname or accepts custom items
 */
export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname if not provided
  const breadcrumbs = items || generateBreadcrumbsFromPath(pathname);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`} aria-label="Breadcrumb">
      <Link
        href="/"
        className="text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            {isLast ? (
              <span className="text-gray-900 font-medium">{item.label}</span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-500">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/**
 * Generate breadcrumbs from pathname
 */
function generateBreadcrumbsFromPath(pathname: string | null | undefined): BreadcrumbItem[] {
  if (pathname == null || pathname === '') {
    return [];
  }
  if (pathname === '/') {
    return [];
  }

  const segments = pathname.split('/').filter((s): s is string => Boolean(s));
  const breadcrumbs: BreadcrumbItem[] = [];

  segments.forEach((segment, index) => {
    if (segment == null) return;
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = formatSegmentLabel(segment);
    
    breadcrumbs.push({
      label,
      href: index < segments.length - 1 ? href : undefined,
    });
  });

  return breadcrumbs;
}

/**
 * Format URL segment into readable label
 */
function formatSegmentLabel(segment: string | null | undefined): string {
  if (segment == null || typeof segment !== 'string') {
    return 'Unknown';
  }
  const trimmed = segment.trim();
  if (trimmed === '') return 'Unknown';

  // Handle special cases
  const specialCases: Record<string, string> = {
    'admin': 'Admin',
    'vendor-admin': 'Vendor Management',
    'service-catalog': 'Service Catalog',
    'rbac': 'Roles & Permissions',
    'roles': 'Roles & Permissions',
  };

  if (specialCases[trimmed]) {
    return specialCases[trimmed];
  }

  // Convert kebab-case to Title Case (guard against empty words)
  return trimmed
    .split('-')
    .map(word => (word && word.length) ? word.charAt(0).toUpperCase() + word.slice(1) : '')
    .filter(Boolean)
    .join(' ') || trimmed;
}
