'use client';

/**
 * VendorPackageCustomers - Shows vendor's customers with active packages
 * 
 * Features:
 * - List of customers with active packages
 * - Sessions remaining for each
 * - Quick schedule next session
 * - Package expiry alerts
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Package, Calendar, Clock, User, Phone, Mail,
  ChevronRight, AlertTriangle, CheckCircle, Plus,
  Search, Filter, TrendingUp, Gift
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';

interface UpcomingSession {
  id: string;
  sessionNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
}

interface PackageCustomer {
  id: string;
  purchaseId: string;
  packageName: string;
  packageType: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerImage?: string;
  totalSessions: number;
  remainingSessions: number;
  sessionsUsed: number;
  expiresAt: string | null;
  unlimitedUsage: boolean;
  upcomingSessions: UpcomingSession[] | null;
  autoAssignSameProvider: boolean;
  createdAt: string;
}

interface VendorPackageCustomersProps {
  vendorId: string;
  onScheduleSession?: (customer: PackageCustomer) => void;
  onViewCustomer?: (customerId: string) => void;
  compact?: boolean;
}

export function VendorPackageCustomers({
  vendorId,
  onScheduleSession,
  onViewCustomer,
  compact = false
}: VendorPackageCustomersProps) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<PackageCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExpiring, setFilterExpiring] = useState(false);

  useEffect(() => {
    fetchPackageCustomers();
  }, [vendorId]);

  const fetchPackageCustomers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/package-customers`);
      
      if (response?.customers) {
        setCustomers(response.customers);
      }
    } catch (error) {
      console.error('Error fetching package customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (expiresAt: string | null) => {
    const days = getDaysUntilExpiry(expiresAt);
    if (days === null) return { status: 'none', label: 'No expiry' };
    if (days <= 0) return { status: 'expired', label: 'Expired' };
    if (days <= 7) return { status: 'urgent', label: `${days}d left` };
    if (days <= 30) return { status: 'warning', label: `${days}d left` };
    return { status: 'ok', label: `${days}d left` };
  };

  const filteredCustomers = customers.filter(customer => {
    // Search filter
    const matchesSearch = !searchQuery || 
      customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.customerPhone.includes(searchQuery);
    
    // Expiring filter
    const matchesExpiring = !filterExpiring || 
      (getDaysUntilExpiry(customer.expiresAt) !== null && getDaysUntilExpiry(customer.expiresAt)! <= 7);

    return matchesSearch && matchesExpiring;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (compact && customers.length === 0) {
    return null;
  }

  if (compact) {
    const expiringCount = customers.filter(c => 
      getDaysUntilExpiry(c.expiresAt) !== null && getDaysUntilExpiry(c.expiresAt)! <= 7
    ).length;

    return (
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900">Package Customers</h3>
          </div>
          <span className="text-sm text-purple-600 font-medium">{customers.length} active</span>
        </div>
        
        {expiringCount > 0 && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg text-sm text-yellow-700 mb-3">
            <AlertTriangle className="w-4 h-4" />
            {expiringCount} package(s) expiring soon
          </div>
        )}

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {customers.slice(0, 3).map(customer => (
            <button
              key={customer.id}
              onClick={() => onViewCustomer?.(customer.customerId)}
              className="w-full p-2 bg-white rounded-lg flex items-center justify-between hover:shadow-md transition"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">
                  {customer.customerName.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 text-sm">{customer.customerName}</p>
                  <p className="text-xs text-gray-500">
                    {customer.unlimitedUsage 
                      ? '∞ sessions' 
                      : `${customer.remainingSessions}/${customer.totalSessions} left`}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>

        {customers.length > 3 && (
          <button 
            onClick={() => onViewCustomer?.('')}
            className="w-full mt-2 text-sm text-purple-600 hover:text-purple-700"
          >
            View all {customers.length} customers
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Package Customers
          </h2>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
            {customers.length} active
          </span>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={filterExpiring ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterExpiring(!filterExpiring)}
            className={filterExpiring ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Expiring
          </Button>
        </div>
      </div>

      {/* Customer List */}
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchQuery || filterExpiring 
                ? 'No customers match your filters' 
                : 'No active package customers'}
            </p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const expiry = getExpiryStatus(customer.expiresAt);
            const progressPercent = customer.unlimitedUsage 
              ? 100 
              : ((customer.sessionsUsed / customer.totalSessions) * 100);

            return (
              <div 
                key={customer.id}
                className="p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-4">
                  {/* Customer Avatar */}
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {customer.customerImage ? (
                      <img 
                        src={customer.customerImage} 
                        alt={customer.customerName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      customer.customerName.charAt(0)
                    )}
                  </div>

                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold text-gray-900">{customer.customerName}</h3>
                        <p className="text-sm text-gray-500">{customer.packageName}</p>
                      </div>
                      
                      {/* Expiry Badge */}
                      {expiry.status !== 'none' && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          expiry.status === 'expired' ? 'bg-red-100 text-red-700' :
                          expiry.status === 'urgent' ? 'bg-yellow-100 text-yellow-700' :
                          expiry.status === 'warning' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {expiry.status === 'expired' || expiry.status === 'urgent' ? (
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 inline mr-1" />
                          )}
                          {expiry.label}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">Sessions</span>
                        <span className="font-medium text-gray-900">
                          {customer.unlimitedUsage 
                            ? 'Unlimited' 
                            : `${customer.sessionsUsed}/${customer.totalSessions} used`}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        {customer.unlimitedUsage 
                          ? 'Unlimited remaining' 
                          : `${customer.remainingSessions} sessions remaining`}
                      </p>
                    </div>

                    {/* Next Session */}
                    {customer.upcomingSessions && customer.upcomingSessions.length > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg text-sm mb-2">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        <span className="text-purple-700">
                          Next: {formatDate(customer.upcomingSessions[0].scheduledDate)} at {customer.upcomingSessions[0].scheduledTime}
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => onScheduleSession?.(customer)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Schedule Session
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `tel:${customer.customerPhone}`}
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                      {customer.customerEmail && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = `mailto:${customer.customerEmail}`}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Same Provider Badge */}
                    {customer.autoAssignSameProvider && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Prefers same provider for all sessions
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      {customers.length > 0 && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Total pending sessions: {' '}
              <strong className="text-gray-900">
                {customers.reduce((sum, c) => sum + (c.unlimitedUsage ? 10 : c.remainingSessions), 0)}
              </strong>
            </span>
            <span className="text-gray-600">
              Expiring in 7 days: {' '}
              <strong className="text-yellow-600">
                {customers.filter(c => getDaysUntilExpiry(c.expiresAt) !== null && getDaysUntilExpiry(c.expiresAt)! <= 7).length}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorPackageCustomers;
