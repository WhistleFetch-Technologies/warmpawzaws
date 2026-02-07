import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface SellerAnalyticsProps {
  sellerId: string;
}

export function SellerAnalytics({ sellerId }: SellerAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [sellerId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${getApiBaseUrl()}/ecommerce/analytics/seller/${sellerId}`,
        { headers: getAuthHeaders() }
      );
      
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-black">Analytics & Reports</h1>
        <p className="text-gray-500 mt-1">Track your store performance and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <p className="text-black text-2xl mt-1">₹{analytics?.totalRevenue?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Orders</p>
              <p className="text-black text-2xl mt-1">{analytics?.totalOrders || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Products</p>
              <p className="text-black text-2xl mt-1">{analytics?.totalProducts || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-lg">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Avg. Order Value</p>
              <p className="text-black text-2xl mt-1">
                ₹{analytics?.totalOrders > 0 ? Math.round(analytics.totalRevenue / analytics.totalOrders) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Advanced analytics coming soon</p>
        <p className="text-sm text-gray-400 mt-1">Sales trends, customer insights, and detailed reports</p>
      </div>
    </div>
  );
}
