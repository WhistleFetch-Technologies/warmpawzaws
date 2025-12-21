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
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Package, Calendar, Check, Clock, TrendingUp, ChevronRight, Info, Star, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner@2.0.3'; // ✅ FIX Bug 3: Import toast at module level instead of dynamic import

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
  packageType?: 'bundle' | 'time_based' | 'appointment' | 'membership' | 'subscription';
  isRecurring?: boolean;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
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
  onBack?: () => void; // ✅ ENHANCEMENT: Add onBack for navigation control
  onNavigate?: (screen: string, data?: any) => void; // ✅ ENHANCEMENT: Add onNavigate for external navigation
  onBookingComplete?: (bookingId: string) => void; // ✅ ENHANCEMENT: Add callback for booking completion
}

export function PackageBookingPage({ 
  customerPhone, 
  customerId, 
  petId,
  onBack,
  onNavigate,
  onBookingComplete
}: PackageBookingPageProps) {
  const [view, setView] = useState<'browse' | 'schedule' | 'my-packages'>('browse');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [myPackages, setMyPackages] = useState<PackageBooking[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const [scheduledDates, setScheduledDates] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Array<{ date: string; timeSlot: string }>>([]);
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
      setError(null);
      
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      
      // ✅ FIX: Fetch packages from backend API
      const response = await fetch(`${API_BASE}/customer/packages`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, packages: [...], total: ... }
        const packagesList = data.packages || data.data?.packages || [];
        
        // Map to PackageItem format
        const mappedPackages: PackageItem[] = packagesList.map((pkg: any) => ({
          id: pkg.id || pkg.packageId,
          name: pkg.packageName || pkg.name,
          description: pkg.description || '',
          vendorId: pkg.vendorId,
          vendorName: pkg.vendorDetails?.businessName || pkg.vendorName || 'Unknown Vendor',
          totalSessions: pkg.totalSessions || pkg.sessionsPerPackage || 1,
          pricePerSession: pkg.pricePerSession || (pkg.totalPrice / (pkg.totalSessions || 1)),
          totalPrice: pkg.totalPrice || pkg.price || 0,
          discount: pkg.discount || 0,
          duration: pkg.duration || pkg.sessionDuration || 30,
          category: pkg.category || 'general',
          popular: pkg.isPopular || pkg.popular || false,
          packageType: pkg.packageType || 'bundle',
          isRecurring: pkg.isRecurring || false,
          billingCycle: pkg.billingCycle || 'monthly'
        }));

        setPackages(mappedPackages);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load packages:', errorData);
        setError(errorData.error || 'Failed to load packages');
        setPackages([]);
      }
    } catch (err: any) {
      console.error('Error loading packages:', err);
      const errorMessage = err?.message || 'Network error. Please check your connection and try again.';
      setError(errorMessage);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMyPackages = async () => {
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
      
      // ✅ FIX: Fetch customer's active packages from backend
      const response = await fetch(`${API_BASE}/customer/packages/my-packages?customerId=${customerId}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const packagesList = data.packages || data.data?.packages || [];
        setMyPackages(packagesList);
      } else {
        // If endpoint doesn't exist yet, use empty array
        console.warn('My packages endpoint not available yet');
        setMyPackages([]);
      }
    } catch (err: any) {
      console.error('Error loading my packages:', err);
      // Don't show error - just use empty array
      setMyPackages([]);
    }
  };

  const handlePackageSelect = (pkg: PackageItem) => {
    setSelectedPackage(pkg);
    setScheduledDates(new Array(pkg.totalSessions).fill(''));
    setSelectedTimeSlots(new Array(pkg.totalSessions).fill(null).map(() => ({ date: '', timeSlot: '' })));
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

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/package/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
            body: JSON.stringify({
            customerPhone,
            customerId,
            petId,
            vendorId: selectedPackage.vendorId,
            packageId: selectedPackage.id,
            totalSessions: selectedPackage.totalSessions,
            scheduledDates: scheduledDates.filter(d => d), // Only send filled dates
            timeSlots: selectedPackage.packageType === 'subscription' || selectedPackage.isRecurring
              ? selectedTimeSlots.filter(s => s.date && s.timeSlot) // General schedule slots
              : undefined, // One-time packages don't need time slots
            packageType: selectedPackage.packageType || 'bundle',
            isRecurring: selectedPackage.isRecurring || false,
            paymentMethod: 'razorpay',
            transactionId: `txn_${Date.now()}`
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create package booking');
      }

      const data = await response.json();
      
      // ✅ FIX Bug 3: Use toast imported at module level (not dynamic import)
      const bookingId = data.bookingId || data.booking?.id || data.packageBookingId;
      
      toast.success(`Package booking created successfully!`);
      
      // Call booking complete callback if provided
      if (onBookingComplete && bookingId) {
        onBookingComplete(bookingId);
      } else if (onNavigate && bookingId) {
        // Fallback: navigate to booking success screen
        onNavigate('booking-success', { bookingId, type: 'package' });
      }
      
      // Reload packages
      loadMyPackages();
      setView('my-packages');
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Packages</h1>
            <p className="text-sm text-gray-600">
              Save more with multi-session packages
            </p>
          </div>
          {/* ✅ ENHANCEMENT: Add back button if onBack provided */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
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
            
            {/* ✅ FIX: Show general schedule for subscription packages */}
            {selectedPackage.packageType === 'subscription' || selectedPackage.isRecurring ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-700">
                    <Info className="w-4 h-4 inline mr-1" />
                    This is a subscription package. Select your preferred time slots for recurring sessions.
                  </p>
                </div>
                
                {/* General Schedule Slots */}
                <div className="space-y-3">
                  {Array.from({ length: selectedPackage.totalSessions }).map((_, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900">Session {index + 1}</span>
                        {index === 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <input
                          type="date"
                          min={getMinDate()}
                          value={scheduledDates[index] || ''}
                          onChange={(e) => {
                            const newDates = [...scheduledDates];
                            newDates[index] = e.target.value;
                            setScheduledDates(newDates);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                        />
                        
                        {/* General Schedule Time Slots */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newSlots = [...selectedTimeSlots];
                              newSlots[index] = { 
                                date: scheduledDates[index] || '', 
                                timeSlot: 'morning' 
                              };
                              setSelectedTimeSlots(newSlots);
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              selectedTimeSlots[index]?.timeSlot === 'morning'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            Morning<br />8 AM - 12 PM
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newSlots = [...selectedTimeSlots];
                              newSlots[index] = { 
                                date: scheduledDates[index] || '', 
                                timeSlot: 'afternoon' 
                              };
                              setSelectedTimeSlots(newSlots);
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              selectedTimeSlots[index]?.timeSlot === 'afternoon'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            Afternoon<br />12 PM - 4 PM
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newSlots = [...selectedTimeSlots];
                              newSlots[index] = { 
                                date: scheduledDates[index] || '', 
                                timeSlot: 'evening' 
                              };
                              setSelectedTimeSlots(newSlots);
                            }}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              selectedTimeSlots[index]?.timeSlot === 'evening'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            Evening<br />4 PM - 8 PM
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* One-time package: Show specific date selection */
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
            )}
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
              disabled={!scheduledDates[0] || booking}
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
