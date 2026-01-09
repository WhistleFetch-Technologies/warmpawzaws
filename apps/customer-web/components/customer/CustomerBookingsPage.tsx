'use client';

import { useState, useEffect } from 'react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Phone } from 'lucide-react';
import { projectId, publicAnonKey } from '@/lib/supabase/info';

interface Booking {
  id: string;
  bookingId: string;
  vendorName: string;
  serviceName: string;
  petName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amount: number;
}

interface CustomerBookingsPageProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function CustomerBookingsPage({ phone, onBack, onNavigate }: CustomerBookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  
  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    if (phone) {
      fetchBookings();
    }
  }, [phone]);
  
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_BASE}/customer/bookings?phone=${encodeURIComponent(phone)}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch bookings');
      }
      
      const data = await response.json();
      setBookings(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredBookings = activeTab === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">My Bookings</h1>
        </div>
        <Button 
          size="sm" 
          className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          onClick={() => onNavigate('services')}
        >
          New Booking
        </Button>
      </div>
      
      {/* Tabs */}
      <div className="bg-white px-4 border-b overflow-x-auto">
        <div className="flex space-x-6">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status as any)}
              className={`py-3 text-sm font-medium capitalize border-b-2 transition-colors whitespace-nowrap ${
                activeTab === status
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <LoadingState message="Loading your bookings..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchBookings} />
        ) : filteredBookings.length === 0 ? (
          <EmptyState 
            message={activeTab === 'all' ? "You haven't made any bookings yet." : `No ${activeTab} bookings found.`}
            action={activeTab === 'all' ? (
              <Button onClick={() => onNavigate('services')} className="bg-[#FF8C42]">
                Book a Service
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <BookingCard 
                key={booking.id} 
                booking={booking} 
                onViewDetails={() => onNavigate('booking-details', { bookingId: booking.id })} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, onViewDetails }: { booking: Booking; onViewDetails: () => void }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-gray-900">{booking.serviceName}</h3>
            <p className="text-sm text-gray-500">{booking.vendorName}</p>
          </div>
          <Badge variant="outline" className={`${getStatusColor(booking.status)} border`}>
            {booking.status}
          </Badge>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            {new Date(booking.scheduledDate).toLocaleDateString()}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2 text-gray-400" />
            {booking.scheduledTime}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium mr-2">Pet:</span> {booking.petName}
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="font-bold text-lg">₹{booking.amount}</span>
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            View Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
