'use client';

/**
 * ============================================================================
 * PACKAGE TRACKING DASHBOARD
 * ============================================================================
 * 
 * Dashboard for tracking multi-visit package bookings
 * - Shows package progress
 * - Individual session status
 * - Upcoming & completed sessions
 * - Package validity & expiration
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, Calendar, Clock, Check, X, AlertCircle,
  ChevronRight, ChevronLeft, RefreshCw, Star, User,
  MapPin, Phone, MessageSquare, CalendarPlus, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PackageTrackingDashboardProps {
  customerPhone: string;
  customerId?: string;
  packageBookingId?: string; // If viewing specific package
  onBack: () => void;
  onScheduleSession?: (packageId: string, sessionNumber: number) => void;
  onViewSession?: (sessionId: string) => void;
}

interface PackageBooking {
  id: string;
  packageId: string;
  packageName: string;
  vendorId: string;
  vendorName: string;
  vendorLogo?: string;
  petId?: string;
  petName?: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  totalSessions: number;
  completedSessions: number;
  scheduledSessions: number;
  remainingSessions: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'flexible';
  price: number;
  purchasedAt: string;
  expiresAt?: string;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
}

interface PackageSession {
  id: string;
  sessionNumber: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'missed' | 'pending';
  scheduledDate?: string;
  scheduledTime?: string;
  completedAt?: string;
  staffId?: string;
  staffName?: string;
  rating?: number;
  notes?: string;
}

export function PackageTrackingDashboard({
  customerPhone,
  customerId,
  packageBookingId,
  onBack,
  onScheduleSession,
  onViewSession,
}: PackageTrackingDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageBooking[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PackageBooking | null>(null);
  const [sessions, setSessions] = useState<PackageSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('active');

  useEffect(() => {
    loadPackages();
  }, [customerPhone]);

  useEffect(() => {
    if (packageBookingId && packages.length > 0) {
      const pkg = packages.find(p => p.id === packageBookingId);
      if (pkg) {
        selectPackage(pkg);
      }
    }
  }, [packageBookingId, packages]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>(`/customer/${customerPhone}/package-bookings`);
      
      const packageList = (res.packages || res.bookings || []).map((p: any) => ({
        id: p.id || p.booking_id,
        packageId: p.package_id || p.packageId,
        packageName: p.package_name || p.packageName || 'Package',
        vendorId: p.vendor_id || p.vendorId,
        vendorName: p.vendor_name || p.vendorName || 'Vendor',
        vendorLogo: p.vendor_logo || p.vendorLogo,
        petId: p.pet_id || p.petId,
        petName: p.pet_name || p.petName,
        serviceStyle: p.service_style || p.serviceStyle || 'at_center',
        totalSessions: p.total_sessions || p.totalSessions || 1,
        completedSessions: p.completed_sessions || p.completedSessions || 0,
        scheduledSessions: p.scheduled_sessions || p.scheduledSessions || 0,
        remainingSessions: (p.total_sessions || p.totalSessions || 1) - 
                          (p.completed_sessions || p.completedSessions || 0),
        frequency: p.frequency || 'flexible',
        price: parseFloat(p.price || p.total_amount || 0),
        purchasedAt: p.purchased_at || p.purchasedAt || p.created_at,
        expiresAt: p.expires_at || p.expiresAt,
        status: p.status || 'active',
      }));

      setPackages(packageList);
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const selectPackage = async (pkg: PackageBooking) => {
    setSelectedPackage(pkg);
    await loadSessions(pkg.id);
  };

  const loadSessions = async (packageBookingId: string) => {
    try {
      setLoadingSessions(true);
      const res = await apiClient.get<any>(`/package-bookings/${packageBookingId}/sessions`);
      
      const sessionList = (res.sessions || res.occurrences || []).map((s: any) => ({
        id: s.id || s.occurrence_id,
        sessionNumber: s.session_number || s.sessionNumber || 1,
        status: s.status || 'pending',
        scheduledDate: s.scheduled_date || s.scheduledDate,
        scheduledTime: s.scheduled_time || s.scheduledTime,
        completedAt: s.completed_at || s.completedAt,
        staffId: s.staff_id || s.staffId,
        staffName: s.staff_name || s.staffName,
        rating: s.rating,
        notes: s.notes,
      }));

      // Sort by session number
      sessionList.sort((a: PackageSession, b: PackageSession) => a.sessionNumber - b.sessionNumber);
      
      setSessions(sessionList);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-orange-100 text-orange-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'missed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getPackageProgress = (pkg: PackageBooking) => {
    return (pkg.completedSessions / pkg.totalSessions) * 100;
  };

  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Every 2 weeks';
      case 'monthly': return 'Monthly';
      default: return 'Flexible';
    }
  };

  const filteredPackages = packages.filter(pkg => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return pkg.status === 'active';
    if (activeTab === 'completed') return pkg.status === 'completed';
    return true;
  });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  // Package detail view
  if (selectedPackage) {
    const progress = getPackageProgress(selectedPackage);
    const daysLeft = getDaysUntilExpiry(selectedPackage.expiresAt);

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
            <button 
              onClick={() => setSelectedPackage(null)} 
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">{selectedPackage.packageName}</h1>
              <p className="text-sm text-gray-500">{selectedPackage.vendorName}</p>
            </div>
            <button onClick={() => loadSessions(selectedPackage.id)} className="p-2">
              <RefreshCw className={`w-5 h-5 ${loadingSessions ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-24">
          {/* Progress Card */}
          <Card className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white rounded-2xl p-5 border-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">Package Progress</h2>
                <p className="text-white/80 text-sm">
                  {selectedPackage.completedSessions} of {selectedPackage.totalSessions} sessions
                </p>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="bg-white/20 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex justify-between mt-3 text-sm text-white/80">
              <span>{selectedPackage.remainingSessions} remaining</span>
              {daysLeft !== null && (
                <span className={daysLeft <= 7 ? 'text-yellow-300' : ''}>
                  {daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Expired'}
                </span>
              )}
            </div>
          </Card>

          {/* Package Info */}
          <Card className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Frequency</p>
                <p className="font-medium">{formatFrequency(selectedPackage.frequency)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Service Type</p>
                <p className="font-medium capitalize">
                  {selectedPackage.serviceStyle.replace('_', ' ')}
                </p>
              </div>
              {selectedPackage.petName && (
                <div>
                  <p className="text-sm text-gray-500">Pet</p>
                  <p className="font-medium">{selectedPackage.petName}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Purchased</p>
                <p className="font-medium">
                  {new Date(selectedPackage.purchasedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Card>

          {/* Sessions List */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Sessions</h3>
            
            {loadingSessions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
              </div>
            ) : sessions.length === 0 ? (
              <Card className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
                <CalendarPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-1">No sessions scheduled</p>
                <p className="text-gray-500 text-sm mb-4">
                  Schedule your first session to get started
                </p>
                <Button 
                  onClick={() => onScheduleSession?.(selectedPackage.id, 1)}
                  className="bg-[#FF8C42] hover:bg-[#E67A35]"
                >
                  Schedule Session
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Card 
                    key={session.id}
                    className={`bg-white rounded-xl p-4 border cursor-pointer hover:border-[#FF8C42] transition ${
                      session.status === 'completed' ? 'border-gray-100' : 'border-gray-200'
                    }`}
                    onClick={() => onViewSession?.(session.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          session.status === 'completed' 
                            ? 'bg-green-100 text-green-600' 
                            : session.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {session.status === 'completed' ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            session.sessionNumber
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Session {session.sessionNumber}
                          </p>
                          {session.scheduledDate ? (
                            <p className="text-sm text-gray-500">
                              {new Date(session.scheduledDate).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                              {session.scheduledTime && ` at ${session.scheduledTime}`}
                            </p>
                          ) : session.completedAt ? (
                            <p className="text-sm text-gray-500">
                              Completed on {new Date(session.completedAt).toLocaleDateString()}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">Not scheduled</p>
                          )}
                          {session.staffName && (
                            <p className="text-xs text-gray-400 mt-1">
                              <User className="w-3 h-3 inline mr-1" />
                              {session.staffName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(session.status)}>
                          {session.status.replace('_', ' ')}
                        </Badge>
                        {session.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">{session.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Schedule next session button */}
          {selectedPackage.remainingSessions > 0 && 
           sessions.filter(s => s.status === 'pending').length < selectedPackage.remainingSessions && (
            <Button
              onClick={() => onScheduleSession?.(
                selectedPackage.id, 
                sessions.length > 0 ? sessions[sessions.length - 1].sessionNumber + 1 : 1
              )}
              className="w-full bg-[#FF8C42] hover:bg-[#E67A35] py-6"
            >
              <CalendarPlus className="w-5 h-5 mr-2" />
              Schedule Next Session
            </Button>
          )}
        </main>
      </div>
    );
  }

  // Packages list view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">My Packages</h1>
            <p className="text-sm text-gray-500">{packages.length} packages</p>
          </div>
          <button onClick={loadPackages} className="p-2">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3 max-w-lg mx-auto">
          {[
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
            { id: 'all', label: 'All' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm transition ${
                activeTab === tab.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {filteredPackages.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No packages found</h3>
            <p className="text-gray-500 text-sm">
              {activeTab === 'active' 
                ? 'You have no active packages' 
                : 'Purchase a package to get started'}
            </p>
          </div>
        ) : (
          filteredPackages.map((pkg) => {
            const progress = getPackageProgress(pkg);
            const daysLeft = getDaysUntilExpiry(pkg.expiresAt);

            return (
              <Card
                key={pkg.id}
                onClick={() => selectPackage(pkg)}
                className="bg-white rounded-2xl p-5 border border-gray-100 cursor-pointer hover:border-[#FF8C42] hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Package className="w-6 h-6 text-[#FF8C42]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{pkg.packageName}</h3>
                      <p className="text-sm text-gray-500">{pkg.vendorName}</p>
                    </div>
                  </div>
                  <Badge className={
                    pkg.status === 'active' ? 'bg-green-100 text-green-700' :
                    pkg.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }>
                    {pkg.status}
                  </Badge>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">
                      {pkg.completedSessions}/{pkg.totalSessions} sessions
                    </span>
                    <span className="font-medium text-[#FF8C42]">{Math.round(progress)}%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-[#FF8C42] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Info row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {pkg.remainingSessions} sessions remaining
                  </span>
                  {daysLeft !== null && daysLeft > 0 && (
                    <span className={daysLeft <= 7 ? 'text-red-500' : 'text-gray-400'}>
                      {daysLeft} days left
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}

export default PackageTrackingDashboard;
