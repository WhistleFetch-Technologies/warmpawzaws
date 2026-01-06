'use client';

import React, { useState, useEffect } from 'react';
import { Package, Calendar, Check, Clock, TrendingUp, ChevronRight, Info, Star, Users, DollarSign, X } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface PackageItem {
  id: string;
  name: string;
  description: string;
  vendorId: string;
  vendorName: string;
  totalSessions: number;
  pricePerSession: number;
  totalPrice: number;
  discount?: number;
  duration: number;
  category: string;
  popular?: boolean;
}

interface Session {
  id: string;
  sessionNumber: number;
  status: 'scheduled' | 'pending_schedule' | 'completed';
  scheduledDate?: string;
  completedAt?: string;
}

interface PackageBooking {
  id: string;
  packageId: string;
  packageName: string;
  totalSessions: number;
  completedSessions: number;
  status: 'active' | 'completed';
  sessions: Session[];
  createdAt: string;
}

interface PackageBookingPageProps {
  customerPhone: string;
  customerId: string;
  petId?: string;
  onBack?: () => void;
}

export function PackageBookingPage({ customerPhone, customerId, petId, onBack }: PackageBookingPageProps) {
  const [view, setView] = useState<'browse' | 'schedule' | 'my-packages'>('browse');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [myPackages, setMyPackages] = useState<PackageBooking[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const [scheduledDates, setScheduledDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
    loadMyPackages();
  }, [customerId]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ packages: PackageItem[] }>('/packages/available');
      if (response.packages) {
        setPackages(response.packages);
      }
    } catch (err) {
      console.error('Error loading packages:', err);
      setError('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const loadMyPackages = async () => {
    try {
      const response = await apiClient.get<{ packages: PackageBooking[] }>(`/customer/${customerId}/packages`);
      if (response.packages) {
        setMyPackages(response.packages);
      }
    } catch (err) {
      console.error('Error loading my packages:', err);
    }
  };

  const handleBookPackage = async () => {
    if (!selectedPackage || scheduledDates.length === 0) {
      alert('Please select a package and schedule dates');
      return;
    }

    setBooking(true);
    try {
      const response = await apiClient.post<{ bookingId: string }>('/packages/book', {
        customerId,
        customerPhone,
        packageId: selectedPackage.id,
        petId,
        scheduledDates
      });

      if (response.bookingId) {
        alert('Package booked successfully!');
        loadMyPackages();
        setView('my-packages');
        setSelectedPackage(null);
      }
    } catch (err) {
      console.error('Error booking package:', err);
      alert('Failed to book package');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Package Bookings</h1>
            <p className="text-white/90 text-sm">Book service packages</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-1">
          {(['browse', 'my-packages'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                view === tab
                  ? 'bg-white text-primary'
                  : 'text-white/90 hover:text-white'
              }`}
            >
              {tab === 'browse' ? 'Browse Packages' : 'My Packages'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {view === 'browse' ? (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : packages.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">No packages available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setView('schedule');
                    }}
                    className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:border-primary hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                          {pkg.popular && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                        <p className="text-sm text-gray-600">{pkg.vendorName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span>{pkg.totalSessions} sessions</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{pkg.duration} min each</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div>
                        {pkg.discount && (
                          <p className="text-sm text-gray-500 line-through">₹{pkg.totalPrice + pkg.discount}</p>
                        )}
                        <p className="text-2xl font-bold text-primary">₹{pkg.totalPrice}</p>
                        {pkg.discount && (
                          <p className="text-xs text-green-600">Save ₹{pkg.discount}</p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : view === 'schedule' && selectedPackage ? (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">{selectedPackage.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{selectedPackage.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary">₹{selectedPackage.totalPrice}</span>
                <span className="text-sm text-gray-600">{selectedPackage.totalSessions} sessions</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Schedule Sessions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select dates for {selectedPackage.totalSessions} sessions
              </p>
              <div className="space-y-3">
                {Array.from({ length: selectedPackage.totalSessions }).map((_, idx) => (
                  <div key={idx}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Session {idx + 1}
                    </label>
                    <input
                      type="date"
                      value={scheduledDates[idx] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const newDates = [...scheduledDates];
                        newDates[idx] = e.target.value;
                        setScheduledDates(newDates);
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleBookPackage}
              disabled={booking || scheduledDates.length !== selectedPackage.totalSessions}
              className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {booking ? 'Booking Package...' : 'Confirm Package Booking'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myPackages.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600">No active packages</p>
              </div>
            ) : (
              myPackages.map((pkg) => (
                <div key={pkg.id} className="bg-white rounded-xl border-2 border-gray-200 p-5">
                  <h3 className="font-bold text-gray-900 mb-2">{pkg.packageName}</h3>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">
                      {pkg.completedSessions}/{pkg.totalSessions} sessions completed
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {pkg.status}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(pkg.completedSessions / pkg.totalSessions) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

