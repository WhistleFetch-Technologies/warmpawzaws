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
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">GST Invoices</h1>
        <p className="text-slate-500 mt-1">Customer sales tax invoices and WarmPawz platform documents</p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit max-w-full overflow-x-auto">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              subTab === tab.id
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
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
