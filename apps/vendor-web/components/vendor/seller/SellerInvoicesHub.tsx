'use client';

import { useState } from 'react';
import { CustomerSalesInvoices } from './CustomerSalesInvoices';
import { PlatformCommissionInvoices } from './PlatformCommissionInvoices';

export type SellerInvoiceSubTab = 'customer_sales' | 'platform';

interface SellerInvoicesHubProps {
  sellerId: string;
  sellerData: Record<string, unknown> | null;
}

const SUB_TABS: { id: SellerInvoiceSubTab; label: string; description: string }[] = [
  {
    id: 'customer_sales',
    label: 'Customer Sales',
    description: 'Invoices you issued to customers',
  },
  {
    id: 'platform',
    label: 'Platform (WarmPawz)',
    description: 'Commission & fee tax documents from WarmPawz',
  },
];

export function SellerInvoicesHub({ sellerId, sellerData }: SellerInvoicesHubProps) {
  const [subTab, setSubTab] = useState<SellerInvoiceSubTab>('customer_sales');

  return (
    <div className="space-y-3 p-1 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="flex w-full max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 sm:w-fit sm:rounded-xl">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-all sm:flex-none sm:rounded-lg sm:px-4 sm:py-2.5 sm:text-sm ${
              subTab === tab.id
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.id === 'customer_sales' ? 'Customer sales' : 'Platform'}
          </button>
        ))}
      </div>

      {subTab === 'customer_sales' ? (
        <CustomerSalesInvoices sellerId={sellerId} sellerData={sellerData} />
      ) : (
        <PlatformCommissionInvoices sellerId={sellerId} />
      )}
    </div>
  );
}
