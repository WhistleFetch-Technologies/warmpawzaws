'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

export interface WarmpawzPayShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

const NAV_ITEMS = [
  { href: '/warmpawz-pay', label: 'Dashboard' },
  { href: '/warmpawz-pay/merchants', label: 'Merchants' },
  { href: '/warmpawz-pay/catalogue', label: 'Catalogue' },
] as const;

export function WarmpawzPayShell({
  title,
  subtitle,
  actions,
  children,
}: WarmpawzPayShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <nav className="mb-2 flex items-center gap-1 text-sm text-gray-500">
            <Link href="/warmpawz-pay" className="hover:text-gray-900">
              Warmpawz Pay
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-gray-900">{title}</span>
          </nav>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200 -mb-px">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/warmpawz-pay'
                  ? pathname === '/warmpawz-pay'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 border-b-2 text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? 'border-[#FF8C42] text-[#FF8C42]'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto w-full px-6 py-6">{children}</main>
    </div>
  );
}
