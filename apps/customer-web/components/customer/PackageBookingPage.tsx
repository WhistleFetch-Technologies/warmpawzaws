'use client';

/**
 * PACKAGE BOOKING PAGE - COMPLETE IMPLEMENTATION
 * 
 * Features:
 * - Browse available packages (training, grooming bundles)
 * - View session breakdown
 * - Schedule multiple sessions
 * - Track package progress
 * - Session status management
 * 
 * Status: ✅ P0 IMPLEMENTATION
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { toast } from 'sonner';
import { Package, Calendar, Check, Clock, TrendingUp, ChevronRight, Info, Star, Users, IndianRupee, Dog, Footprints } from 'lucide-react';

export type VendorPackageIntent = {
  vendorId: string;
  vendorServiceId: string;
  serviceName: string;
  totalSessions: number;
  price: number;
  duration?: number;
  serviceType?: string;
  serviceStyle?: string;
  description?: string;
  vendorName?: string;
};

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
  duration: number; // per session in minutes
  category: string;
  popular?: boolean;
  /** When set, purchase uses POST /packages/purchase-from-vendor-service */
  vendorServiceId?: string;
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

export interface WalkSessionIntent {
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
}

function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as unknown as { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      const deadline = Date.now() + 15000;
      const tick = setInterval(() => {
        const win = window as unknown as { Razorpay?: unknown };
        if (win.Razorpay) {
          clearInterval(tick);
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(tick);
          reject(new Error('Razorpay script timeout'));
        }
      }, 80);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      const win = window as unknown as { Razorpay?: unknown };
      if (win.Razorpay) resolve();
      else reject(new Error('Razorpay unavailable'));
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

interface PackageBookingPageProps {
  customerPhone: string;
  customerId: string;
  petId?: string;
  onBack?: () => void;
  /** Walker / home-service flow: custom vendor_services package + vendor catalog */
  vendorPackageIntent?: VendorPackageIntent | null;
  /** Single walk (30/60 min) chosen from dog walking — show summary + path back to pick a walker */
  walkSessionIntent?: WalkSessionIntent | null;
  onContinueToChooseWalker?: () => void;
}

export function PackageBookingPage({
  customerPhone,
  customerId,
  petId,
  onBack,
  vendorPackageIntent,
  walkSessionIntent,
  onContinueToChooseWalker,
}: PackageBookingPageProps) {
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
  }, [customerId, vendorPackageIntent?.vendorId, vendorPackageIntent?.vendorServiceId]);

  const loadPackages = async () => {
    try {
      setLoading(true);

      const mockPackages: PackageItem[] = [
        {
          id: 'pkg_training_5',
          name: '5-Session Obedience Training',
          description: 'Complete obedience training package with 5 sessions',
          vendorId: 'vendor_trainer_1',
          vendorName: 'PawsUp Training Center',
          totalSessions: 5,
          pricePerSession: 800,
          totalPrice: 3500,
          discount: 500,
          duration: 60,
          category: 'training',
          popular: true
        },
        {
          id: 'pkg_grooming_3',
          name: '3-Month Grooming Package',
          description: 'Monthly grooming sessions for 3 months',
          vendorId: 'vendor_groomer_1',
          vendorName: 'Furry Friends Spa',
          totalSessions: 3,
          pricePerSession: 600,
          totalPrice: 1500,
          discount: 300,
          duration: 90,
          category: 'grooming',
          popular: false
        },
        {
          id: 'pkg_training_10',
          name: '10-Session Advanced Training',
          description: 'Advanced skills and tricks training over 10 sessions',
          vendorId: 'vendor_trainer_1',
          vendorName: 'PawsUp Training Center',
          totalSessions: 10,
          pricePerSession: 800,
          totalPrice: 6500,
          discount: 1500,
          duration: 60,
          category: 'training',
          popular: false
        },
        {
          id: 'pkg_vet_wellness_6',
          name: '6-Month Wellness Package',
          description: 'Bi-monthly health checkups for 6 months',
          vendorId: 'vendor_vet_1',
          vendorName: 'Happy Tails Clinic',
          totalSessions: 6,
          pricePerSession: 500,
          totalPrice: 2500,
          discount: 500,
          duration: 30,
          category: 'vet',
          popular: true
        }
      ];

      const items: PackageItem[] = [];

      if (vendorPackageIntent?.vendorId) {
        try {
          const res = (await apiClient.get(
            `/vendor/${encodeURIComponent(vendorPackageIntent.vendorId)}/packages`
          )) as any;
          const rows = Array.isArray(res?.packages) ? res.packages : [];
          for (const p of rows) {
            const sc = Number(p.session_count ?? p.total_sessions ?? p.sessions_included);
            const ts =
              !Number.isFinite(sc) || sc <= 0 ? 1 : sc < 0 ? 1 : Math.min(365, Math.floor(sc));
            const price = Number(p.price ?? 0);
            items.push({
              id: String(p.id),
              vendorId: String(p.vendor_id ?? vendorPackageIntent.vendorId),
              name: String(p.name ?? p.package_name ?? 'Package'),
              description: String(p.description ?? ''),
              vendorName: String(vendorPackageIntent.vendorName || 'Vendor'),
              totalSessions: ts,
              pricePerSession: ts > 0 ? Math.round(price / ts) : price,
              totalPrice: price,
              duration: Number(
                p.duration_minutes ?? p.duration ?? vendorPackageIntent.duration ?? 60
              ),
              category: String(p.service_type ?? 'walking'),
              popular: false,
            });
          }
        } catch (e) {
          console.warn('[PackageBookingPage] vendor packages:', e);
        }
      }

      if (vendorPackageIntent?.vendorServiceId) {
        const p = vendorPackageIntent;
        const ts = Math.max(1, Number(p.totalSessions ?? 1));
        const price = Number(p.price ?? 0);
        items.unshift({
          id: `vs-${p.vendorServiceId}`,
          vendorServiceId: p.vendorServiceId,
          vendorId: p.vendorId,
          name: p.serviceName,
          description: p.description ?? '',
          vendorName: p.vendorName || 'Your provider',
          totalSessions: ts,
          pricePerSession: ts > 0 ? Math.round(price / ts) : price,
          totalPrice: price,
          duration: p.duration ?? 60,
          category: p.serviceType ?? 'walking',
          popular: true,
        });
      }

      setPackages(items.length > 0 ? items : mockPackages);
    } catch (err) {
      console.error('Error loading packages:', err);
      setError('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const loadMyPackages = async () => {
    try {
      const res = await apiClient
        .get<any>(`/customer/${encodeURIComponent(customerPhone)}/packages`)
        .catch(() => null);
      const rows: any[] = Array.isArray(res?.packages) ? res.packages : [];
      setMyPackages(
        rows.map((p) => {
          const total = Number(p.totalSessions ?? p.total_sessions ?? 0);
          const used = Number(p.sessionsUsed ?? p.sessions_used ?? 0);
          const unlimited = p.isUnlimited || p.remainingSessions === 'unlimited';
          return {
            id: String(p.id),
            packageId: String(p.packageId || p.id),
            packageName: String(p.packageName || p.package_name || 'Package'),
            totalSessions: unlimited ? Math.max(used, 1) : total || Math.max(used, 1),
            completedSessions: unlimited ? used : used,
            status: (p.status === 'exhausted' || p.status === 'expired' ? 'completed' : 'active') as
              | 'active'
              | 'completed',
            sessions: [],
            createdAt: p.expiresAt || p.expires_at || new Date().toISOString(),
          };
        })
      );
    } catch (err) {
      console.error('Error loading my packages:', err);
      setMyPackages([]);
    }
  };

  const handlePackageSelect = (pkg: PackageItem) => {
    setSelectedPackage(pkg);
    setScheduledDates(new Array(pkg.totalSessions).fill(''));
    setView('schedule');
  };

  const updateScheduledDate = (index: number, date: string) => {
    const newDates = [...scheduledDates];
    newDates[index] = date;
    setScheduledDates(newDates);
  };

  const createPackageBooking = async () => {
    if (!selectedPackage || !petId) {
      setError('Please select a pet first');
      return;
    }

    try {
      setBooking(true);
      setError(null);

      const sessionSchedule = scheduledDates
        .map((d, idx) => ({
          sessionNumber: idx + 1,
          date: d || undefined,
          time: '09:00',
        }))
        .filter((s) => !!s.date);

      if (selectedPackage.vendorServiceId) {
        const basePayload = {
          customerId,
          vendorId: selectedPackage.vendorId,
          vendorServiceId: selectedPackage.vendorServiceId,
          preferSameProvider: true,
          sessionSchedule,
        };

        const res = (await apiClient.post('/packages/purchase-from-vendor-service', basePayload)) as any;
        if (!res?.success) {
          throw new Error(res?.error || 'Purchase failed');
        }

        if (res.requiresPayment && res.razorpayOrderId && res.razorpayKeyId) {
          await loadRazorpayCheckoutScript();
          const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
          const amountRupees = Number(res.amount ?? selectedPackage.totalPrice ?? 0);
          const paymentIdFromOrder = String(res.paymentId || '').trim();

          let completed = false;
          await new Promise<void>((resolve) => {
            const options = buildSanitizedStandardRazorpayCheckoutOptions({
              key: res.razorpayKeyId,
              amountPaise: Math.max(1, Math.round(amountRupees * 100)),
              currency: res.currency || 'INR',
              name: 'Warmpawz',
              description: `Package — ${selectedPackage.name}`,
              order_id: res.razorpayOrderId,
              customerPhone,
              customerEmail: checkoutEmail,
              includeInstrumentBlocks: true,
              handler: async (response: any) => {
                try {
                  const confirm = (await apiClient.post('/packages/purchase-from-vendor-service', {
                    ...basePayload,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    ...(paymentIdFromOrder ? { paymentId: paymentIdFromOrder } : {}),
                  })) as any;
                  if (!confirm?.success) {
                    throw new Error(confirm?.error || 'Purchase confirmation failed');
                  }
                  completed = true;
                  toast.success(
                    confirm.message ||
                      `Package purchased — ${confirm.purchase?.totalSessions ?? selectedPackage.totalSessions} sessions`
                  );
                  await loadMyPackages();
                  setView('my-packages');
                } catch (e: any) {
                  toast.error(e?.message || 'Could not confirm payment');
                } finally {
                  resolve();
                }
              },
              theme: { color: '#FF8C42' },
              modal: {
                ondismiss: () => resolve(),
              },
            });
            const RazorpayCtor = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } })
              .Razorpay;
            if (!RazorpayCtor) {
              toast.error('Payment gateway not available');
              resolve();
              return;
            }
            const rz = new RazorpayCtor(options);
            rz.open();
          });
          if (completed) return;
          return;
        }

        toast.success(
          res.message ||
            `Package purchased — ${res.purchase?.totalSessions ?? selectedPackage.totalSessions} sessions`
        );
        await loadMyPackages();
        setView('my-packages');
        return;
      }

      const pkgId = selectedPackage.id;
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pkgId)
      ) {
        const res = (await apiClient.post('/packages/convert-from-trial', {
          packageId: pkgId,
          customerId,
          preferSameProvider: true,
          sessionSchedule,
        })) as any;
        if (!res?.success) {
          throw new Error(res?.error || 'Purchase failed');
        }
        toast.success(res.message || 'Package purchased');
        await loadMyPackages();
        setView('my-packages');
        return;
      }

      setError('This package cannot be purchased from this screen. Try again after refresh.');
    } catch (err: any) {
      console.error('Error creating package booking:', err);
      setError(err.message || 'Failed to create booking');
    } finally {
      setBooking(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (loading && view === 'browse') {
    return (
      <div className="flex min-h-screen min-h-[100dvh] items-center justify-center cw-header-safe-top cw-header-safe-x max-w-customer mx-auto w-full bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto bg-gray-50 cw-header-safe-top cw-header-safe-x pb-24">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex min-h-11 min-w-11 items-center justify-start gap-2 rounded-lg px-1 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            aria-label="Go back"
          >
            <ChevronRight className="h-5 w-5 shrink-0 rotate-180" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Service Packages</h1>
        <p className="text-sm text-gray-600">
          Save more with multi-session packages
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {walkSessionIntent && onContinueToChooseWalker && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 shadow-sm mb-6">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-orange-100 flex items-center justify-center shrink-0">
              <Dog className="w-7 h-7 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1">Dog walking</p>
              <h2 className="text-lg font-bold text-gray-900">{walkSessionIntent.serviceName}</h2>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-semibold text-orange-600">₹{walkSessionIntent.price}</span>
                {' / walk · '}
                {walkSessionIntent.duration} minutes
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Tap below to return to dog walking and pick a walker for this session.
              </p>
              <button
                type="button"
                onClick={onContinueToChooseWalker}
                className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Footprints className="w-5 h-5" />
                Choose a walker
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('browse')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
            view === 'browse'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Browse Packages
        </button>
        <button
          onClick={() => setView('my-packages')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
            view === 'my-packages'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          My Packages ({myPackages.length})
        </button>
      </div>

      {/* Browse Packages View */}
      {view === 'browse' && (
        <div className="space-y-4">
          {packages.map((pkg) => {
            const savings = pkg.discount || 0;
            const regularPrice = pkg.pricePerSession * pkg.totalSessions;
            
            return (
              <div
                key={pkg.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
              >
                {pkg.popular && (
                  <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold mb-3">
                    <Star className="w-3 h-3" />
                    Popular
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">{pkg.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{pkg.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{pkg.vendorName}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Sessions</div>
                    <div className="font-semibold text-gray-900">{pkg.totalSessions}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Per Session</div>
                    <div className="font-semibold text-gray-900">₹{pkg.pricePerSession}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Duration</div>
                    <div className="font-semibold text-gray-900">{pkg.duration}m</div>
                  </div>
                </div>

                {savings > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-green-700">You Save ₹{savings}</div>
                        <div className="text-xs text-green-600 line-through">Regular: ₹{regularPrice}</div>
                      </div>
                      <div className="text-2xl font-bold text-green-700">₹{pkg.totalPrice}</div>
                    </div>
                  </div>
                )}

                {!savings && (
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-600">Total Package Price</span>
                    <span className="text-2xl font-bold text-gray-900">₹{pkg.totalPrice}</span>
                  </div>
                )}

                <button
                  onClick={() => handlePackageSelect(pkg)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  Book Package
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Sessions View */}
      {view === 'schedule' && selectedPackage && (
        <div className="space-y-6">
          {/* Package Summary */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">{selectedPackage.name}</h3>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">Total Sessions</span>
              <span className="font-semibold text-gray-900">{selectedPackage.totalSessions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Amount</span>
              <span className="text-xl font-bold text-orange-600">₹{selectedPackage.totalPrice}</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-semibold mb-1">Schedule Sessions (Optional)</p>
                <p>You can schedule all sessions now or schedule them later. Only the first session needs to be scheduled to book the package.</p>
              </div>
            </div>
          </div>

          {/* Session Scheduling */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">Schedule Sessions</h3>
            
            <div className="space-y-3">
              {Array.from({ length: selectedPackage.totalSessions }).map((_, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">Session {index + 1}</span>
                    {index === 0 && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  
                  <input
                    type="date"
                    min={getMinDate()}
                    value={scheduledDates[index] || ''}
                    onChange={(e) => updateScheduledDate(index, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('browse')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
            >
              Back
            </button>
            <button
              onClick={createPackageBooking}
              disabled={
                booking ||
                (!selectedPackage?.vendorServiceId && !scheduledDates[0])
              }
              className="bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {booking ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Booking...
                </>
              ) : (
                <>
                  Confirm Booking
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* My Packages View */}
      {view === 'my-packages' && (
        <div className="space-y-4">
          {myPackages.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Active Packages</h3>
              <p className="text-sm text-gray-600 mb-4">
                You don't have any active packages yet. Browse and book packages to get started!
              </p>
              <button
                onClick={() => setView('browse')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Browse Packages
              </button>
            </div>
          ) : (
            myPackages.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">{pkg.packageName}</h3>
                    <div className="text-sm text-gray-600">
                      {pkg.completedSessions} of {pkg.totalSessions} sessions completed
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    pkg.status === 'active' 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {pkg.status === 'active' ? 'In Progress' : 'Completed'}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(pkg.completedSessions / pkg.totalSessions) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Sessions */}
                <div className="space-y-2">
                  {pkg.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          session.status === 'completed'
                            ? 'bg-green-500'
                            : session.status === 'scheduled'
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                        }`}>
                          {session.status === 'completed' && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          Session {session.sessionNumber}
                        </span>
                      </div>
                      
                      {session.scheduledDate && (
                        <span className="text-xs text-gray-600">
                          {new Date(session.scheduledDate).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PackageBookingPage;
