'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface DashboardStats {
  appointments: number;
  consultations: number;
  earnings: number;
  pendingEarnings: number;
  completedServices: number;
  rating: number;
  totalReviews: number;
}

interface Booking {
  id: string;
  customer_name: string;
  service_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
}

interface VendorDashboardProps {
  vendorId: string;
}

export function VendorDashboard({ vendorId }: VendorDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: 0,
    totalReviews: 0,
  });
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, [vendorId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get vendor dashboard data
      const response = await apiClient.get<any>(`/vendor/${vendorId}/dashboard`);
      if (response.success || response.vendor) {
        setVendor(response.vendor);
        setStats(response.stats || stats);
        setTodayBookings(response.bookings || []);
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadDashboard}
            className="px-6 py-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{vendor?.businessName || 'Vendor Dashboard'}</h1>
            <p className="text-sm text-orange-100">{vendor?.ownerName}</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/10 rounded-full">
              <span className="text-2xl">🔔</span>
            </button>
            <button className="p-2 hover:bg-white/10 rounded-full">
              <span className="text-2xl">⚙️</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-3xl mb-2">📅</div>
            <p className="text-2xl font-bold text-gray-900">{stats.appointments}</p>
            <p className="text-sm text-gray-500">Today&apos;s Appointments</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-3xl mb-2">💰</div>
            <p className="text-2xl font-bold text-green-600">₹{stats.earnings.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Earnings</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-2xl font-bold text-gray-900">{stats.completedServices}</p>
            <p className="text-sm text-gray-500">Completed Services</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-3xl mb-2">⭐</div>
            <p className="text-2xl font-bold text-yellow-600">{stats.rating.toFixed(1)}</p>
            <p className="text-sm text-gray-500">{stats.totalReviews} Reviews</p>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '📋', label: 'Manage Services', href: '/services' },
              { icon: '👥', label: 'Staff', href: '/staff' },
              { icon: '💳', label: 'Settlements', href: '/settlements' },
              { icon: '📊', label: 'Analytics', href: '/analytics' },
              { icon: '📝', label: 'Reviews', href: '/reviews' },
              { icon: '🗓️', label: 'Schedule', href: '/schedule' },
              { icon: '💬', label: 'Messages', href: '/messages' },
              { icon: '🔔', label: 'Notifications', href: '/notifications' },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md hover:bg-orange-50 transition"
              >
                <span className="text-3xl mb-2">{action.icon}</span>
                <span className="text-sm text-gray-700">{action.label}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Today's Bookings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Bookings</h2>
            <a href="/bookings" className="text-orange-500 text-sm font-medium hover:text-orange-600">
              View All
            </a>
          </div>
          {todayBookings.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <span className="text-5xl mb-4 block">📅</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings today</h3>
              <p className="text-gray-500">Enjoy your day off!</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="divide-y">
                {todayBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="p-4 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center text-xl">
                          🐾
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{booking.customer_name}</h3>
                          <p className="text-sm text-gray-500">{booking.service_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{booking.booking_time}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Pending Settlements */}
        {stats.pendingEarnings > 0 && (
          <section className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Pending Settlement</h2>
                <p className="text-3xl font-bold mt-2">₹{stats.pendingEarnings.toLocaleString()}</p>
                <p className="text-sm text-green-100 mt-1">Expected within 7 days</p>
              </div>
              <a
                href="/settlements"
                className="px-4 py-2 bg-white text-green-600 rounded-full font-medium hover:bg-green-50 transition"
              >
                View Details
              </a>
            </div>
          </section>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-around py-3">
          {[
            { icon: '🏠', label: 'Home', href: '/', active: true },
            { icon: '📅', label: 'Bookings', href: '/bookings' },
            { icon: '📊', label: 'Analytics', href: '/analytics' },
            { icon: '👤', label: 'Profile', href: '/profile' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center ${item.active ? 'text-orange-500' : 'text-gray-500'}`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

