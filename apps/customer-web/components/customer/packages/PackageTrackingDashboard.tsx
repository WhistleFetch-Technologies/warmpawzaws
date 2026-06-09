"use client";

/**
 * PackageTrackingDashboard - Universal Package Tracking Component
 * 
 * Tracks package utilization across all service types:
 * - Session-based packages (fixed count)
 * - Time-based packages (validity period)
 * - Unlimited packages
 * - Subscription packages (recurring)
 * - Multi-service packages (bundled services)
 * 
 * Features:
 * - Visual progress tracking
 * - Next session booking with pre-loaded package
 * - Session history
 * - Package renewal/upgrade options
 * - Expiry warnings
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Package, Clock, Calendar, CheckCircle2, AlertTriangle,
  ChevronRight, Star, RefreshCw, Gift, Zap, History, Play, Plus, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { hasEffectivePriceReduction } from '@warmpawz/shared-types';

interface PackageTrackingDashboardProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  /** Optional: open chat with vendor (bookingId from latest booking with that vendor). If not set, onNavigate('open-chat', data) is used. */
  onOpenChat?: (bookingId: string, vendorName?: string, vendorPhoto?: string) => void;
}

interface CustomerPackage {
  id: string;
  packageId: string;
  packageName: string;
  packageType: 'bundle' | 'time_based' | 'appointment' | 'membership' | 'subscription';
  
  // Vendor info
  vendorId: string;
  vendorName: string;
  vendorPhoto?: string;
  
  // Usage tracking
  usageType: 'sessions' | 'appointments' | 'unlimited';
  totalSessions: number | 'unlimited';
  usedSessions: number;
  remainingSessions: number | 'unlimited';
  
  // Validity
  purchasedAt: string;
  expiresAt: string | null;
  validityDays: number | null;
  daysRemaining: number | null;
  
  // Services
  includedServices: PackageService[];
  
  // Status
  status: 'active' | 'expired' | 'exhausted' | 'cancelled';
  isExpiringSoon: boolean; // Within 7 days
  
  // Subscription specific
  isRecurring: boolean;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate?: string;
  
  // Financial
  originalPrice: number;
  paidPrice: number;
  discount: number;
  
  // Sessions history
  sessionsHistory?: SessionRecord[];
  
  // Next session
  nextSession?: {
    scheduledDate: string;
    scheduledTime: string;
    serviceName: string;
  };
}

interface PackageService {
  id: string;
  serviceId: string;
  name: string;
  usedCount: number;
  maxCount: number | 'unlimited';
}

interface SessionRecord {
  id: string;
  serviceName: string;
  completedAt: string;
  rating?: number;
  providerName?: string;
}

type TabType = 'active' | 'history' | 'expired';

/** Normalize GET /customer/:phone/packages and GET /customer/:id/packages/active rows into dashboard model. */
function mapApiPackageRowToCustomerPackage(row: any): CustomerPackage {
  const unlimited = row.isUnlimited === true || row.unlimited_usage === true || row.remainingSessions === 'unlimited';
  const totalNum = Number(row.totalSessions ?? row.total_sessions ?? 0) || 0;
  const used = Number(row.sessionsUsed ?? row.sessions_used ?? 0);
  const remRaw = row.remainingSessions ?? row.remaining_sessions;
  const remNum = unlimited ? 0 : Number(remRaw ?? Math.max(0, totalNum - used));
  const included: PackageService[] = Array.isArray(row.includedServices)
    ? row.includedServices.map((s: any, i: number) => ({
        id: String(s.id || `inc-${i}`),
        serviceId: String(s.id || s.vendor_service_id || ''),
        name: String(s.name || s.serviceName || 'Service'),
        usedCount: 0,
        maxCount: 1,
      }))
    : [];
  const next = row.nextSession;
  const nextSession =
    next && (next.scheduled_date || next.scheduledDate)
      ? {
          scheduledDate: String(next.scheduled_date || next.scheduledDate || ''),
          scheduledTime: String(next.scheduled_time || next.scheduledTime || ''),
          serviceName: String(next.service_name || next.serviceName || 'Session'),
        }
      : undefined;

  return {
    id: String(row.id),
    packageId: String(row.packageId || row.package_id || row.id),
    packageName: String(row.packageName || row.package_name || 'Package'),
    packageType: (row.packageType || row.package_type || 'appointment') as CustomerPackage['packageType'],
    vendorId: String(row.vendorId || row.vendor_id || ''),
    vendorName: String(row.vendorName || row.vendor_name || ''),
    usageType: unlimited ? 'unlimited' : 'sessions',
    totalSessions: unlimited ? 'unlimited' : totalNum,
    usedSessions: used,
    remainingSessions: unlimited ? 'unlimited' : remNum,
    purchasedAt: row.purchasedAt || row.created_at || new Date().toISOString(),
    expiresAt: row.expiresAt || row.expires_at || null,
    validityDays: null,
    daysRemaining: null,
    includedServices:
      included.length > 0
        ? included
        : [
            {
              id: 'sessions',
              serviceId: '',
              name: 'Sessions',
              usedCount: used,
              maxCount: unlimited ? 'unlimited' : totalNum,
            },
          ],
    status: (row.status || row.computed_status || 'active') as CustomerPackage['status'],
    isExpiringSoon: false,
    isRecurring: false,
    originalPrice: 0,
    paidPrice: 0,
    discount: 0,
    nextSession,
  };
}

export function PackageTrackingDashboard({
  phone,
  customerId,
  onBack,
  onNavigate,
  onOpenChat,
}: PackageTrackingDashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<CustomerPackage | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadPackages();
  }, [phone, customerId]);

  const loadPackages = async () => {
    try {
      setLoading(true);

      const byPhone = await apiClient
        .get<any>(`/customer/${encodeURIComponent(phone)}/packages`)
        .catch(() => null);
      let merged: any[] = Array.isArray(byPhone?.packages) ? [...byPhone.packages] : [];

      const uuid =
        customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)
          ? customerId
          : null;
      if (uuid) {
        const active = await apiClient
          .get<any>(`/customer/${encodeURIComponent(uuid)}/packages/active`)
          .catch(() => null);
        const extra: any[] = Array.isArray(active?.packages) ? active.packages : [];
        const seen = new Set(merged.map((p: any) => String(p.id ?? p.packagePurchaseId ?? '')));
        for (const p of extra) {
          const id = String(p.id ?? '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          merged.push({
            id: p.id,
            packageName: p.package_name || p.packageName,
            vendorId: p.vendor_id || p.vendorId,
            vendorName: p.vendor_name || p.vendorName,
            totalSessions: p.total_sessions ?? p.totalSessions,
            remainingSessions: p.unlimited_usage ? 'unlimited' : p.remaining_sessions ?? p.remainingSessions,
            sessionsUsed: p.sessions_used ?? p.sessionsUsed,
            expiresAt: p.expires_at || p.expiresAt,
            isUnlimited: p.unlimited_usage,
            packageType: p.package_type || p.packageType,
            status: p.computed_status || p.status,
            includedServices: [],
            nextSession: p.nextSession,
          });
        }
      }

      const mapped = merged.map(mapApiPackageRowToCustomerPackage);
      mapped.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        if (a.expiresAt && b.expiresAt) {
          return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
        }
        return 0;
      });
      setPackages(mapped);
    } catch (error) {
      console.error('Error loading packages:', error);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter packages by tab
  const filteredPackages = packages.filter(pkg => {
    if (activeTab === 'active') {
      return pkg.status === 'active';
    } else if (activeTab === 'expired') {
      return pkg.status === 'expired' || pkg.status === 'exhausted';
    } else {
      return true; // history shows all
    }
  });

  // Calculate usage percentage
  const getUsagePercentage = (pkg: CustomerPackage): number => {
    if (pkg.totalSessions === 'unlimited' || pkg.remainingSessions === 'unlimited') {
      return 100; // Always show full for unlimited
    }
    return Math.round((pkg.usedSessions / (pkg.totalSessions as number)) * 100);
  };

  // Get status color
  const getStatusColor = (pkg: CustomerPackage) => {
    if (pkg.status === 'expired' || pkg.status === 'exhausted') {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    if (pkg.isExpiringSoon) {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    }
    if (pkg.usageType === 'unlimited') {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    return 'bg-green-100 text-green-700 border-green-200';
  };

  // Get package type icon
  const getPackageIcon = (type: string) => {
    switch (type) {
      case 'bundle': return '📦';
      case 'time_based': return '⏰';
      case 'appointment': return '📅';
      case 'membership': return '👑';
      case 'subscription': return '🔄';
      default: return '📦';
    }
  };

  // Open chat on the package's canonical parent booking (one thread per purchase).
  const handleMessageVendor = async (pkg: CustomerPackage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let bookingId = '';
      try {
        const ses = (await apiClient.get(
          `/packages/${encodeURIComponent(pkg.id)}/sessions`
        )) as {
          package?: {
            package_booking_id?: string;
            packageBookingId?: string;
            booking_id?: string;
            bookingId?: string;
          };
        };
        bookingId = String(
          ses?.package?.package_booking_id ??
            ses?.package?.packageBookingId ??
            ses?.package?.booking_id ??
            ses?.package?.bookingId ??
            ''
        ).trim();
      } catch (err) {
        console.warn('[PackageTracking] failed to resolve parent bookingId via /packages/:id/sessions', err);
      }

      if (!bookingId) {
        const res = await apiClient.get<{ booking: { bookingId: string; vendorName?: string; vendorPhoto?: string } | null }>(
          `/customer/${encodeURIComponent(phone)}/latest-booking-by-vendor?vendorId=${encodeURIComponent(pkg.vendorId)}`
        );
        bookingId = String(res?.booking?.bookingId || '').trim();
      }

      if (!bookingId) {
        toast.info('Book a session with this vendor first to unlock chat.');
        return;
      }

      const vendorName = pkg.vendorName;
      const vendorPhoto = pkg.vendorPhoto;
      if (onOpenChat) {
        onOpenChat(bookingId, vendorName, vendorPhoto);
      } else {
        onNavigate('open-chat', { bookingId, vendorName, vendorPhoto });
      }
    } catch (err) {
      console.error('Error opening chat:', err);
      toast.error('Could not open chat.');
    }
  };

  // ✅ FIX GAP-11.1: Handle book with package - checks subscription for zero payment
  const handleBookWithPackage = async (pkg: CustomerPackage) => {
    try {
      // Check for active subscription first
      const subscriptionCheck = await apiClient.get<any>(
        `/customer/${phone}/subscriptions/active?serviceId=${pkg.includedServices[0]?.id || ''}`
      );

      const hasActiveSubscription = subscriptionCheck.hasActiveSubscription || false;
      
      // Navigate to booking with package context
      const serviceType = pkg.includedServices[0]?.name?.toLowerCase().includes('walk') ? 'walking' :
                         pkg.includedServices[0]?.name?.toLowerCase().includes('groom') ? 'grooming' :
                         pkg.includedServices[0]?.name?.toLowerCase().includes('train') ? 'training' :
                         pkg.includedServices[0]?.name?.toLowerCase().includes('vet') ? 'veterinary' : 'walking';
      
      onNavigate('home-service-booking', {
        serviceType,
        vendorId: pkg.vendorId,
        packageId: pkg.id,
        packageName: pkg.packageName,
        hasActiveSubscription, // Pass subscription status for zero-payment booking
      });
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      // Proceed with package booking anyway
      const serviceType = pkg.includedServices[0]?.name?.toLowerCase().includes('walk') ? 'walking' :
                         pkg.includedServices[0]?.name?.toLowerCase().includes('groom') ? 'grooming' :
                         pkg.includedServices[0]?.name?.toLowerCase().includes('train') ? 'training' :
                         pkg.includedServices[0]?.name?.toLowerCase().includes('vet') ? 'veterinary' : 'walking';
      
      onNavigate('home-service-booking', {
        serviceType,
        vendorId: pkg.vendorId,
        packageId: pkg.id,
        packageName: pkg.packageName,
      });
    }
  };

  // Handle package renewal
  const handleRenewPackage = async (pkg: CustomerPackage) => {
    onNavigate('purchase-package', {
      vendorId: pkg.vendorId,
      packageId: pkg.packageId,
      renewFrom: pkg.id
    });
  };

  // Render package card
  const renderPackageCard = (pkg: CustomerPackage) => {
    const usagePercent = getUsagePercentage(pkg);
    const isActive = pkg.status === 'active';
    
    return (
      <Card 
        key={pkg.id}
        className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
          !isActive ? 'opacity-75' : ''
        }`}
        onClick={() => {
          setSelectedPackage(pkg);
          setShowDetails(true);
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-2xl">
              {getPackageIcon(pkg.packageType)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{pkg.packageName}</h3>
              <p className="text-sm text-gray-500">{pkg.vendorName}</p>
            </div>
          </div>
          <Badge className={getStatusColor(pkg)}>
            {pkg.status === 'active' ? (pkg.isExpiringSoon ? 'Expiring Soon' : 'Active') :
             pkg.status === 'expired' ? 'Expired' : 
             pkg.status === 'exhausted' ? 'Used Up' : pkg.status}
          </Badge>
        </div>

        {/* Usage Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">
              {pkg.usageType === 'unlimited' ? 'Unlimited Usage' : 'Sessions Used'}
            </span>
            <span className="font-semibold">
              {pkg.usageType === 'unlimited' 
                ? '∞ Remaining'
                : `${pkg.usedSessions} / ${pkg.totalSessions}`}
            </span>
          </div>
          {pkg.usageType !== 'unlimited' && (
            <Progress 
              value={usagePercent} 
              className="h-2"
            />
          )}
        </div>

        {/* Validity Info */}
        <div className="flex items-center justify-between text-sm pt-3 border-t">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            {pkg.expiresAt ? (
              <span>
                {pkg.daysRemaining && pkg.daysRemaining > 0
                  ? `${pkg.daysRemaining} days left`
                  : `Expired ${new Date(pkg.expiresAt).toLocaleDateString()}`}
              </span>
            ) : (
              <span>No Expiry</span>
            )}
          </div>
          
          {isActive && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/packages/${encodeURIComponent(pkg.id)}`);
                }}
                className="border-purple-300 text-purple-800 hover:bg-purple-50"
              >
                Track
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => handleMessageVendor(pkg, e)}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Message
              </Button>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleBookWithPackage(pkg);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-3 h-3 mr-1" />
                Book Now
              </Button>
            </div>
          )}
        </div>

        {/* Next Session */}
        {pkg.nextSession && (
          <div className="mt-3 pt-3 border-t bg-blue-50 -mx-4 -mb-4 p-4 rounded-b-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Next: {pkg.nextSession.serviceName}</p>
                  <p className="text-xs text-blue-700">
                    {new Date(pkg.nextSession.scheduledDate).toLocaleDateString()} at {pkg.nextSession.scheduledTime}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        )}
      </Card>
    );
  };

  // Render detailed view
  const renderPackageDetails = () => {
    if (!selectedPackage) return null;
    
    const pkg = selectedPackage;
    const usagePercent = getUsagePercentage(pkg);
    const isActive = pkg.status === 'active';
    
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowDetails(false)}>
        <div 
          className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-3xl text-white">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-white/10 rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Badge className="bg-white/20 text-white border-white/30">
                {pkg.packageType.replace('_', ' ')}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                {getPackageIcon(pkg.packageType)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{pkg.packageName}</h2>
                <p className="text-white/80">{pkg.vendorName}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Usage Stats */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Usage Overview
              </h3>
              
              {pkg.usageType === 'unlimited' ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">∞</div>
                  <p className="text-gray-600">Unlimited Sessions</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Used: {pkg.usedSessions} sessions so far
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-bold text-purple-600">
                      {pkg.remainingSessions}
                    </span>
                    <span className="text-gray-500">of {pkg.totalSessions} remaining</span>
                  </div>
                  <Progress value={usagePercent} className="h-3 mb-4" />
                  
                  {/* Service-wise breakdown */}
                  {pkg.includedServices.map(service => (
                    <div key={service.id} className="flex items-center justify-between py-2 border-t">
                      <span className="text-sm text-gray-700">{service.name}</span>
                      <span className="text-sm font-medium">
                        {service.usedCount} / {service.maxCount === 'unlimited' ? '∞' : service.maxCount}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </Card>

            {/* Validity Info */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Validity
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Purchased</span>
                  <span className="font-medium">
                    {new Date(pkg.purchasedAt).toLocaleDateString()}
                  </span>
                </div>
                
                {pkg.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expires</span>
                    <span className={`font-medium ${pkg.isExpiringSoon ? 'text-amber-600' : ''}`}>
                      {new Date(pkg.expiresAt).toLocaleDateString()}
                      {pkg.daysRemaining && pkg.daysRemaining > 0 && (
                        <span className="text-sm text-gray-500 ml-1">
                          ({pkg.daysRemaining} days left)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                
                {pkg.isRecurring && pkg.nextBillingDate && (
                  <div className="flex justify-between pt-3 border-t">
                    <span className="text-gray-600">Next Billing</span>
                    <span className="font-medium">
                      {new Date(pkg.nextBillingDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Session History */}
            {pkg.sessionsHistory && pkg.sessionsHistory.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-600" />
                  Recent Sessions
                </h3>
                
                <div className="space-y-3">
                  {pkg.sessionsHistory.slice(0, 5).map(session => (
                    <div key={session.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium text-gray-900">{session.serviceName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(session.completedAt).toLocaleDateString()}
                          {session.providerName && ` • ${session.providerName}`}
                        </p>
                      </div>
                      {session.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm">{session.rating}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Payment Info */}
            <Card className="p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Price</span>
                  <span
                    className={
                      hasEffectivePriceReduction(pkg.originalPrice, pkg.paidPrice)
                        ? 'text-gray-400 line-through'
                        : 'text-gray-600'
                    }
                  >
                    ₹{pkg.originalPrice}
                  </span>
                </div>
                {pkg.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{pkg.discount}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Amount Paid</span>
                  <span>₹{pkg.paidPrice}</span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="space-y-3 pb-6">
              {isActive && (
                <Button
                  onClick={() => {
                    setShowDetails(false);
                    handleBookWithPackage(pkg);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 py-6"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Book Next Session
                </Button>
              )}
              
              {(pkg.status === 'expired' || pkg.status === 'exhausted' || pkg.isExpiringSoon) && (
                <Button
                  onClick={() => {
                    setShowDetails(false);
                    handleRenewPackage(pkg);
                  }}
                  variant={isActive ? 'outline' : 'default'}
                  className={`w-full py-6 ${!isActive ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Renew Package
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading your packages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">My Packages</h1>
            <p className="text-sm text-white/80">Track your service packages</p>
          </div>
          <button
            onClick={() => onNavigate('browse-packages')}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'active', label: 'Active', icon: Zap },
            { id: 'history', label: 'All', icon: Package },
            { id: 'expired', label: 'Expired', icon: Clock }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === tab.id
                  ? 'bg-white text-purple-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Stats Summary */}
        {activeTab === 'active' && packages.filter(p => p.status === 'active').length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center bg-purple-50 border-purple-200">
              <p className="text-2xl font-bold text-purple-600">
                {packages.filter(p => p.status === 'active').length}
              </p>
              <p className="text-xs text-purple-700">Active</p>
            </Card>
            <Card className="p-3 text-center bg-green-50 border-green-200">
              <p className="text-2xl font-bold text-green-600">
                {packages.filter(p => p.status === 'active')
                  .reduce((sum, p) => sum + (typeof p.remainingSessions === 'number' ? p.remainingSessions : 100), 0)}
              </p>
              <p className="text-xs text-green-700">Sessions</p>
            </Card>
            <Card className="p-3 text-center bg-amber-50 border-amber-200">
              <p className="text-2xl font-bold text-amber-600">
                {packages.filter(p => p.isExpiringSoon).length}
              </p>
              <p className="text-xs text-amber-700">Expiring</p>
            </Card>
          </div>
        )}

        {/* Expiring Soon Alert */}
        {activeTab === 'active' && packages.some(p => p.isExpiringSoon && p.status === 'active') && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">Packages Expiring Soon</p>
                <p className="text-sm text-amber-700">
                  {packages.filter(p => p.isExpiringSoon && p.status === 'active').length} package(s) expire within 7 days
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Package List */}
        {filteredPackages.length > 0 ? (
          <div className="space-y-4">
            {filteredPackages.map(pkg => renderPackageCard(pkg))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {activeTab === 'active' ? 'No Active Packages' : 
               activeTab === 'expired' ? 'No Expired Packages' : 'No Packages Found'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {activeTab === 'active' 
                ? 'Purchase a package to save on services!'
                : 'Your package history will appear here'}
            </p>
            {activeTab === 'active' && (
              <Button
                onClick={() => onNavigate('browse-packages')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Gift className="w-4 h-4 mr-2" />
                Browse Packages
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Package Details Modal */}
      {showDetails && renderPackageDetails()}
    </div>
  );
}

export default PackageTrackingDashboard;
