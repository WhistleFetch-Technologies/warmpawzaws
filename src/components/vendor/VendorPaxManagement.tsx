/**
 * VENDOR PAX (GUEST) MANAGEMENT
 * 
 * Manages guest and pet count for cafe bookings with:
 * - Guest capacity limits
 * - Pet count limits
 * - Booking validation
 * - Table assignment based on capacity
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Users, 
  Dog,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { authenticatedFetch } from '../../utils/session-manager';

interface VendorPaxManagementProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface PaxConfig {
  maxGuestsPerTable: number;
  maxPetsPerTable: number;
  maxGuestsPerBooking: number;
  maxPetsPerBooking: number;
  requirePetCount: boolean;
  requireGuestCount: boolean;
  allowPetOnlyBookings: boolean;
  petSizeRestrictions: {
    small: boolean;
    medium: boolean;
    large: boolean;
    extraLarge: boolean;
  };
  guestToPetRatio: number; // e.g., 2 means 2 guests per pet
}

interface Booking {
  id: string;
  bookingId: string;
  customerName: string;
  petName: string;
  guestCount: number;
  petCount: number;
  tableId?: string;
  tableNumber?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  validationStatus?: 'valid' | 'invalid' | 'warning';
  validationMessage?: string;
}

export function VendorPaxManagement({ 
  vendorId, 
  vendorData, 
  onBack 
}: VendorPaxManagementProps) {
  const [config, setConfig] = useState<PaxConfig>({
    maxGuestsPerTable: 8,
    maxPetsPerTable: 4,
    maxGuestsPerBooking: 20,
    maxPetsPerBooking: 10,
    requirePetCount: true,
    requireGuestCount: true,
    allowPetOnlyBookings: false,
    petSizeRestrictions: {
      small: true,
      medium: true,
      large: true,
      extraLarge: false
    },
    guestToPetRatio: 2
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch pax configuration
      const configResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/cafe/${vendorId}/pax-config`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (configResponse.ok) {
        const data = await configResponse.json();
        if (data.config) {
          setConfig({ ...config, ...data.config });
        }
      }

      // Fetch recent bookings with pax data
      await fetchBookings();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/bookings?serviceType=cafe&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const bookingsList = data.bookings || data.data?.bookings || [];
        
        // Validate bookings against current config
        const validatedBookings = bookingsList.map((booking: Booking) => {
          const validation = validateBooking(booking);
          return {
            ...booking,
            validationStatus: validation.status,
            validationMessage: validation.message
          };
        });
        
        setBookings(validatedBookings);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const validateBooking = (booking: Booking): { status: 'valid' | 'invalid' | 'warning', message: string } => {
    // Check guest count
    if (booking.guestCount > config.maxGuestsPerBooking) {
      return {
        status: 'invalid',
        message: `Guest count (${booking.guestCount}) exceeds maximum (${config.maxGuestsPerBooking})`
      };
    }

    // Check pet count
    if (booking.petCount > config.maxPetsPerBooking) {
      return {
        status: 'invalid',
        message: `Pet count (${booking.petCount}) exceeds maximum (${config.maxPetsPerBooking})`
      };
    }

    // Check guest-to-pet ratio
    if (booking.guestCount > 0 && booking.petCount > 0) {
      const ratio = booking.guestCount / booking.petCount;
      if (ratio < config.guestToPetRatio) {
        return {
          status: 'warning',
          message: `Low guest-to-pet ratio (${ratio.toFixed(1)}). Recommended: ${config.guestToPetRatio}+`
        };
      }
    }

    // Check if pet-only booking is allowed
    if (booking.guestCount === 0 && booking.petCount > 0 && !config.allowPetOnlyBookings) {
      return {
        status: 'invalid',
        message: 'Pet-only bookings are not allowed'
      };
    }

    return {
      status: 'valid',
      message: 'Booking meets all requirements'
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/cafe/${vendorId}/pax-config`,
        {
          method: 'PUT',
          body: JSON.stringify(config)
        }
      );

      if (response.ok) {
        toast.success('Pax configuration saved successfully');
        // Re-validate bookings
        await fetchBookings();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save configuration');
      }
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getValidationIcon = (status?: string) => {
    switch (status) {
      case 'valid': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'invalid': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Pax (Guest) Management</h1>
            <p className="text-xs text-gray-500">Configure guest and pet capacity limits</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Capacity Limits
            </h2>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Table Limits */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Per Table Limits</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Max Guests per Table</label>
                <Input
                  type="number"
                  value={config.maxGuestsPerTable}
                  onChange={(e) => setConfig({ ...config, maxGuestsPerTable: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Pets per Table</label>
                <Input
                  type="number"
                  value={config.maxPetsPerTable}
                  onChange={(e) => setConfig({ ...config, maxPetsPerTable: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="20"
                />
              </div>
            </div>

            {/* Booking Limits */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Per Booking Limits</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Max Guests per Booking</label>
                <Input
                  type="number"
                  value={config.maxGuestsPerBooking}
                  onChange={(e) => setConfig({ ...config, maxGuestsPerBooking: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Pets per Booking</label>
                <Input
                  type="number"
                  value={config.maxPetsPerBooking}
                  onChange={(e) => setConfig({ ...config, maxPetsPerBooking: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="50"
                />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Advanced Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Require Guest Count</label>
                  <p className="text-xs text-gray-500">Customers must specify number of guests</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.requireGuestCount}
                  onChange={(e) => setConfig({ ...config, requireGuestCount: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Require Pet Count</label>
                  <p className="text-xs text-gray-500">Customers must specify number of pets</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.requirePetCount}
                  onChange={(e) => setConfig({ ...config, requirePetCount: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Allow Pet-Only Bookings</label>
                  <p className="text-xs text-gray-500">Allow bookings with pets but no human guests</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.allowPetOnlyBookings}
                  onChange={(e) => setConfig({ ...config, allowPetOnlyBookings: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Guest-to-Pet Ratio</label>
                <Input
                  type="number"
                  value={config.guestToPetRatio}
                  onChange={(e) => setConfig({ ...config, guestToPetRatio: parseFloat(e.target.value) || 1 })}
                  min="0.5"
                  max="10"
                  step="0.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Recommended ratio of guests to pets (e.g., 2 means 2 guests per pet)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Validation */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Bookings Validation</h2>
          
          {bookings.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No bookings to validate</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(booking => (
                <div
                  key={booking.id}
                  className={`p-4 rounded-lg border ${
                    booking.validationStatus === 'valid'
                      ? 'border-green-200 bg-green-50'
                      : booking.validationStatus === 'invalid'
                      ? 'border-red-200 bg-red-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{booking.customerName}</h3>
                        {getValidationIcon(booking.validationStatus)}
                        {booking.tableNumber && (
                          <Badge variant="outline" className="text-xs">
                            Table {booking.tableNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{booking.petName}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {booking.guestCount} guests
                        </span>
                        <span className="flex items-center gap-1">
                          <Dog className="w-4 h-4" />
                          {booking.petCount} pets
                        </span>
                      </div>
                      {booking.validationMessage && (
                        <p className={`text-xs mt-2 ${
                          booking.validationStatus === 'valid'
                            ? 'text-green-700'
                            : booking.validationStatus === 'invalid'
                            ? 'text-red-700'
                            : 'text-yellow-700'
                        }`}>
                          {booking.validationMessage}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        booking.validationStatus === 'valid'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : booking.validationStatus === 'invalid'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      }
                    >
                      {booking.validationStatus || 'pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

