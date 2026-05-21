'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { Store, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SellerDetailsModal, type SellerSummary } from './SellerDetailsModal';

export function SellerManagement() {
  const [sellers, setSellers] = useState<SellerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<SellerSummary | null>(null);

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/ecommerce/vendors/list');
      const vendors = (data as any).vendors || [];

      const mappedSellers: SellerSummary[] = vendors.map(
        (vendor: Record<string, unknown>) => ({
          id: String(vendor.id),
          businessName:
            (vendor.business_name as string) || (vendor.businessName as string),
          ownerName: (vendor.owner_name as string) || (vendor.ownerName as string),
          phone: vendor.phone as string | undefined,
          email: vendor.email as string | undefined,
          isActive: vendor.is_active === true,
          status: vendor.status as string | undefined,
          sellerStatus: vendor.seller_status as string | undefined,
          products:
            (typeof vendor.active_product_count === 'number'
              ? vendor.active_product_count
              : null) ??
            (typeof vendor.product_count === 'number' ? vendor.product_count : null) ??
            0,
          listVendor: vendor,
        })
      );

      setSellers(mappedSellers);
    } catch (error: any) {
      console.error('Error loading sellers:', error);
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        console.warn('⚠️ API returned 401 - showing empty state (UAT mode)');
        setSellers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 13 && digits.startsWith('919')) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    return phone;
  };

  const filteredSellers = sellers.filter((seller) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      seller.businessName?.toLowerCase().includes(searchLower) ||
      seller.ownerName?.toLowerCase().includes(searchLower) ||
      seller.phone?.includes(searchQuery)
    );
  });

  return (
    <div className="p-6 space-y-6 relative">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sellers...</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">Seller Management</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage pet product sellers on the platform
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sellers..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Products
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Revenue
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSellers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Store className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No sellers found</p>
                  </td>
                </tr>
              ) : (
                filteredSellers.map((seller) => (
                  <tr key={seller.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-black">
                        {seller.businessName || seller.ownerName || 'Unnamed Seller'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatPhoneNumber(seller.phone)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                          seller.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {seller.isActive ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {seller.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-800 font-medium">
                      {Number.isFinite(seller.products) ? seller.products : 0}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">₹0</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedSeller(seller)}
                        className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        title="View seller details"
                        aria-label={`View details for ${seller.businessName || seller.ownerName || 'seller'}`}
                        data-testid="viewSellerButton"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSeller && (
        <SellerDetailsModal
          seller={selectedSeller}
          onClose={() => setSelectedSeller(null)}
        />
      )}
    </div>
  );
}
