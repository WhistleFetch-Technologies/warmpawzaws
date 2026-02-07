"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, LogIn, LogOut, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface CheckInCheckOutPageProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

export function CheckInCheckOutPage(props: CheckInCheckOutPageProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (props.bookingId) {
      loadBooking();
    } else {
      setLoading(false);
    }
  }, [props.bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/bookings/${props.bookingId}`);
      setBooking(response.booking || response);
    } catch (error: any) {
      console.error('Error loading booking:', error);
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setProcessing(true);
      await apiClient.post(`/bookings/${props.bookingId}/checkin`, {
        timestamp: new Date().toISOString(),
      });
      toast.success('Checked in successfully!');
      loadBooking();
    } catch (error: any) {
      console.error('Error checking in:', error);
      toast.error('Failed to check in');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setProcessing(true);
      await apiClient.post(`/bookings/${props.bookingId}/checkout`, {
        timestamp: new Date().toISOString(),
      });
      toast.success('Checked out successfully!');
      loadBooking();
    } catch (error: any) {
      console.error('Error checking out:', error);
      toast.error('Failed to check out');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Check In/Out</h1>
          </div>
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </Card>
        </div>
      </div>
    );
  }

  const isCheckedIn = booking?.checkInTime && !booking?.checkOutTime;
  const isCheckedOut = booking?.checkOutTime;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Check In/Out</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {booking && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Booking Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking ID</span>
                  <span className="font-medium">{booking.id?.slice(0, 8).toUpperCase()}</span>
                </div>
                {booking.petName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pet</span>
                    <span className="font-medium">{booking.petName}</span>
                  </div>
                )}
                {booking.serviceType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service</span>
                    <span className="font-medium capitalize">{booking.serviceType}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="space-y-4">
              {!isCheckedIn && !isCheckedOut && (
                <Button
                  onClick={handleCheckIn}
                  disabled={processing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Check In
                </Button>
              )}

              {isCheckedIn && (
                <>
                  <div className="flex items-center gap-2 text-green-600 mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Checked In</span>
                    {booking.checkInTime && (
                      <span className="text-sm text-gray-500 ml-auto">
                        {new Date(booking.checkInTime).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={handleCheckOut}
                    disabled={processing}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Check Out
                  </Button>
                </>
              )}

              {isCheckedOut && (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-gray-900 mb-1">Checked Out</p>
                  {booking.checkOutTime && (
                    <p className="text-sm text-gray-500">
                      {new Date(booking.checkOutTime).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
