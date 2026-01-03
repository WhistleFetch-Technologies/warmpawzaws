'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Subscription {
  id: string;
  package_name: string;
  vendor_name: string;
  service_type: string;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  price: number;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    loadSubscriptions();
  }, [router]);

  const loadSubscriptions = async () => {
    try {
      const customerId = localStorage.getItem('customerId');
      if (customerId) {
        const response = await apiClient.get<{ subscriptions: Subscription[] }>(
          `/subscriptions/customer/${customerId}`
        );
        setSubscriptions(response.subscriptions || []);
      }
    } catch (err) {
      console.error('Error loading subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (filter === 'all') return true;
    if (filter === 'active') return sub.status === 'active';
    if (filter === 'expired') return sub.status === 'expired' || sub.status === 'cancelled';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'expired': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">My Subscriptions & Packages</h1>

        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'expired'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition ${
                filter === f
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-orange-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-gray-500">No subscriptions found</p>
            <button
              onClick={() => router.push('/search')}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Browse Packages
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSubscriptions.map((subscription) => (
              <div key={subscription.id} className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {subscription.package_name}
                    </h3>
                    <p className="text-gray-500">{subscription.vendor_name}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                    {subscription.status}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Sessions Used</span>
                    <span>{subscription.used_sessions} / {subscription.total_sessions}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(subscription.used_sessions / subscription.total_sessions) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Start Date</span>
                    <p className="font-medium">{new Date(subscription.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">End Date</span>
                    <p className="font-medium">{new Date(subscription.end_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Remaining</span>
                    <p className="font-medium text-orange-600">{subscription.remaining_sessions} sessions</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Price</span>
                    <p className="font-medium">₹{subscription.price}</p>
                  </div>
                </div>

                {subscription.status === 'active' && subscription.remaining_sessions > 0 && (
                  <button
                    onClick={() => router.push(`/booking/${subscription.id}?type=package`)}
                    className="w-full mt-4 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                  >
                    Book Next Session
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

