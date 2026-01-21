'use client';

import { useState, useEffect } from 'react';
import { Plus, Truck, MapPin, Calendar, DollarSign, Edit, Trash2, CheckCircle2, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RelocationVendorDashboardProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface Quote {
  id?: string;
  customerName: string;
  customerPhone: string;
  fromLocation: string;
  toLocation: string;
  petCount: number;
  distance: number;
  estimatedPrice: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: string;
}

export function RelocationVendorDashboard({ vendorId, vendorData, onBack }: RelocationVendorDashboardProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'quotes' | 'bookings'>('overview');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [finalPrice, setFinalPrice] = useState(0);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadQuotes(),
        loadBookings(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadQuotes = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/relocation/quotes`);
      setQuotes(response.quotes || response || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
      setQuotes([]);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bookings?category=relocation`);
      setBookings(response.bookings || response || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    }
  };

  const handleAcceptQuote = async (quote: Quote) => {
    setSelectedQuote(quote);
    setFinalPrice(quote.estimatedPrice);
    setShowQuoteModal(true);
  };

  const handleRejectQuote = async (quoteId: string) => {
    if (!confirm('Are you sure you want to reject this quote?')) return;

    try {
      await apiClient.put<any>(`/vendor/${vendorId}/relocation/quotes/${quoteId}`, { status: 'rejected' });
      toast.success('Quote rejected');
      loadQuotes();
    } catch (error: any) {
      toast.error('Failed to reject quote');
    }
  };

  const handleSubmitFinalQuote = async () => {
    if (!selectedQuote || finalPrice <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put<any>(`/vendor/${vendorId}/relocation/quotes/${selectedQuote.id}`, {
        status: 'accepted',
        finalPrice: finalPrice,
      });
      toast.success('Quote accepted and sent to customer!');
      setShowQuoteModal(false);
      setSelectedQuote(null);
      loadQuotes();
    } catch (error: any) {
      toast.error('Failed to accept quote');
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    pendingQuotes: quotes.filter(q => q.status === 'pending').length,
    acceptedQuotes: quotes.filter(q => q.status === 'accepted').length,
    totalBookings: bookings.length,
    activeBookings: bookings.filter(b => b.status === 'active' || b.status === 'in_transit').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relocation Services</h1>
            <p className="text-gray-600 mt-1">Manage quotes and relocation bookings</p>
          </div>
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              ← Back
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Quotes</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingQuotes}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Accepted</p>
                <p className="text-2xl font-bold text-green-600">{stats.acceptedQuotes}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
              <Truck className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-purple-600">{stats.activeBookings}</p>
              </div>
              <MapPin className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Truck },
            { id: 'quotes', label: 'Quotes', icon: DollarSign },
            { id: 'bookings', label: 'Bookings', icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'quotes' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Relocation Quotes</h2>
            {quotes.length === 0 ? (
              <Card className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quotes</h3>
                <p className="text-gray-600">Quotes will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">{quote.customerName}</h3>
                          <Badge variant="outline">{quote.status}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>From: {quote.fromLocation}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>To: {quote.toLocation}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Distance: {quote.distance} km</span>
                            <span>•</span>
                            <span>Pets: {quote.petCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span className="font-semibold">Estimated: ₹{quote.estimatedPrice?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      {quote.status === 'pending' && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleAcceptQuote(quote)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => quote.id && handleRejectQuote(quote.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Relocation Bookings</h2>
            {bookings.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings</h3>
                <p className="text-gray-600">Bookings will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">Relocation Booking</h3>
                          <Badge variant="outline">{booking.status || 'pending'}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Customer: {booking.customerName || booking.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{booking.fromLocation} → {booking.toLocation}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Date: {booking.bookingDate || booking.scheduled_date}</span>
                          </div>
                          {booking.totalAmount && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>Total: ₹{booking.totalAmount.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {showQuoteModal && selectedQuote && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Accept Quote</h2>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">From: {selectedQuote.fromLocation}</p>
                    <p className="text-sm text-gray-600">To: {selectedQuote.toLocation}</p>
                    <p className="text-sm text-gray-600">Distance: {selectedQuote.distance} km</p>
                    <p className="text-sm text-gray-600">Pets: {selectedQuote.petCount}</p>
                    <p className="text-sm font-semibold mt-2">Estimated: ₹{selectedQuote.estimatedPrice?.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label>Final Price (₹) *</Label>
                    <Input
                      type="number"
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(Number(e.target.value))}
                      placeholder={selectedQuote.estimatedPrice?.toString()}
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowQuoteModal(false); setSelectedQuote(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      onClick={handleSubmitFinalQuote}
                      disabled={loading}
                    >
                      Accept & Send Quote
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
