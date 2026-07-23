'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface WarmpawzPayCatalogueShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function WarmpawzPayCatalogueShell({
  title,
  subtitle,
  actions,
  children,
}: WarmpawzPayCatalogueShellProps) {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <nav className="mb-2 flex items-center gap-1 text-sm text-gray-500">
            <Link href="/warmpawz-pay/catalogue" className="hover:text-gray-900">
              Warmpawz Pay
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900">Catalogue</span>
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto w-full px-6 py-6">{children}</main>
    </div>
  );
}
