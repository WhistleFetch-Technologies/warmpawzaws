'use client';

import { useState, useEffect } from 'react';
import { Store, Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function SellerManagement() {
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/vendor/list');
      const vendors = (data as any).data?.vendors || (data as any).vendors || [];
      // Filter vendors with pet_product role
      const petProductSellers =
        vendors.filter((v: any) => v.roleId === 'pet_product') || [];
      setSellers(petProductSellers);
    } catch (error: any) {
      console.error('Error loading sellers:', error);
      // In UAT mode, show empty state instead of error
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        console.warn('⚠️ API returned 401 - showing empty state (UAT mode)');
        setSellers([]); // Empty array allows UI to render
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredSellers = sellers.filter((seller) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      seller.businessName?.toLowerCase().includes(searchLower) ||
      seller.fullName?.toLowerCase().includes(searchLower) ||
      seller.phone?.includes(searchQuery)
    );
  });

  return (
    <div className="p-6 space-y-6 relative">
      {/* Loading overlay - only show when actively loading */}
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
          <h2 className="text-black text-xl font-semibold">
            Seller Management
          </h2>
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <Store className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No sellers found</p>
                  </td>
                </tr>
              ) : (
                filteredSellers.map((seller) => (
                  <tr key={seller.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-black">
                          {seller.businessName || seller.fullName}
                        </p>
                        <p className="text-xs text-gray-500">
                          ID: {seller.id?.slice(0, 8) || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{seller.phone || '-'}</td>
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
                    <td className="px-6 py-4 text-center text-gray-600">-</td>
                    <td className="px-6 py-4 text-right text-gray-600">₹0</td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
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
    </div>
  );
}

