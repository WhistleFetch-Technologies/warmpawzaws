'use client';

/**
 * PostSessionPackageOffer - Shows package offers after trial/first session completion
 * 
 * Features:
 * - Displays vendor's available packages
 * - "Stay with same provider" toggle
 * - Session scheduling option
 * - One-click purchase flow
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Package, Gift, Star, Clock, Calendar, CheckCircle, 
  ChevronRight, X, Sparkles, TrendingUp, User, Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PackageOffer {
  id: string;
  name: string;
  description: string;
  totalSessions: number;
  price: number;
  pricePerSession: number;
  regularPrice: number;
  savings: number;
  savingsPercent: number;
  validityDays?: number;
  validityMonths?: number;
  isRecommended: boolean;
  features?: string[];
}

interface PostSessionPackageOfferProps {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  serviceType: string;
  staffName?: string;
  staffId?: string;
  customerId: string;
  onPackagePurchased?: (purchase: any) => void;
  onDismiss?: () => void;
  onClose?: () => void;
}

export function PostSessionPackageOffer({
  bookingId,
  vendorId,
  vendorName,
  serviceType,
  staffName,
  staffId,
  customerId,
  onPackagePurchased,
  onDismiss,
  onClose
}: PostSessionPackageOfferProps) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageOffer[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageOffer | null>(null);
  const [preferSameProvider, setPreferSameProvider] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchPackageOffers();
  }, [vendorId, bookingId]);

  const fetchPackageOffers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(
        `/packages/post-trial-offers?vendorId=${vendorId}&serviceType=${serviceType}&bookingId=${bookingId}`
      );

      if (response?.packages) {
        setPackages(response.packages);
        // Auto-select recommended package
        const recommended = response.packages.find((p: PackageOffer) => p.isRecommended);
        if (recommended) setSelectedPackage(recommended);
      }
    } catch (error) {
      console.error('Error fetching package offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }

    try {
      setPurchasing(true);

      const response = await apiClient.post<any>('/packages/convert-from-trial', {
        trialBookingId: bookingId,
        packageId: selectedPackage.id,
        customerId,
        preferSameProvider,
        scheduleAllSessions: false
      });

      if (response?.success) {
        setShowSuccess(true);
        toast.success('Package purchased successfully!');
        setTimeout(() => {
          if (onPackagePurchased) onPackagePurchased(response.purchase);
          if (onClose) onClose();
        }, 2000);
      } else {
        toast.error(response?.error || 'Failed to purchase package');
      }
    } catch (error: any) {
      console.error('Error purchasing package:', error);
      toast.error(error.message || 'Failed to purchase package');
    } finally {
      setPurchasing(false);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    if (onClose) onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  const getServiceIcon = () => {
    switch (serviceType) {
      case 'walking': return '🚶';
      case 'training': return '🎓';
      case 'grooming': return '✂️';
      case 'vet': return '🩺';
      default: return '🐾';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          <p className="text-gray-600 mt-4">Loading offers...</p>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Package Purchased!</h2>
          <p className="text-gray-600 mb-4">
            {selectedPackage?.totalSessions} sessions are now available.
            {preferSameProvider && staffName && (
              <span className="block mt-1">All sessions will be with {staffName}.</span>
            )}
          </p>
          <div className="animate-pulse text-orange-500 text-sm">Redirecting...</div>
        </div>
      </div>
    );
  }

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full">
                  Special Offer
                </span>
              </div>
              <button 
                onClick={handleDismiss}
                className="p-1 hover:bg-white/20 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h2 className="text-2xl font-bold mb-1">Loved Your Session?</h2>
            <p className="text-white/90">
              Save more with a package from {vendorName}
            </p>
          </div>
        </div>

        <div className="p-6">
          {/* Staff Preference Toggle */}
          {staffName && (
            <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                    {staffName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{staffName}</p>
                    <p className="text-sm text-gray-600">Your {serviceType} expert</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferSameProvider}
                    onChange={(e) => setPreferSameProvider(e.target.checked)}
                    className="w-5 h-5 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Same provider</span>
                </label>
              </div>
            </div>
          )}

          {/* Package Options */}
          <h3 className="font-bold text-gray-900 mb-4">Choose a Package</h3>
          
          <div className="space-y-3 mb-6">
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.id === pkg.id;
              
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`w-full p-4 rounded-xl border-2 transition text-left relative ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {pkg.isRecommended && (
                    <div className="absolute -top-2 right-4 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                      BEST VALUE
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getServiceIcon()}</span>
                        <h4 className="font-bold text-gray-900">{pkg.name}</h4>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {pkg.totalSessions} sessions
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {pkg.validityMonths || 3} months
                        </span>
                      </div>
                      
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-gray-900">
                          {formatPrice(pkg.price)}
                        </span>
                        <span className="text-sm text-gray-500 cw-price-strike">
                          {formatPrice(pkg.regularPrice)}
                        </span>
                        {pkg.savingsPercent > 0 && (
                          <span className="text-sm font-bold text-green-600">
                            Save {pkg.savingsPercent}%
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-1">
                        {formatPrice(pkg.pricePerSession)}/session
                      </p>
                    </div>
                    
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Benefits */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" />
              Package Benefits
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>No session expiry</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Priority booking</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Same provider</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Flexible scheduling</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handlePurchase}
              disabled={purchasing || !selectedPackage}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 text-lg font-bold rounded-xl"
            >
              {purchasing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5 mr-2" />
                  Buy Package {selectedPackage && `- ${formatPrice(selectedPackage.price)}`}
                </>
              )}
            </Button>

            <button
              onClick={handleDismiss}
              className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm transition"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostSessionPackageOffer;
