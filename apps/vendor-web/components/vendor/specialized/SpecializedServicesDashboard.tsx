"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Users, Package, Plane, Calendar, Check, X, Eye, Phone, MessageCircle, Clock, Star, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SpecializedServicesDashboardProps {
  vendorId: string;
  vendorRole: string;
  onBack: () => void;
}

export function SpecializedServicesDashboard({ vendorId, vendorRole, onBack }: SpecializedServicesDashboardProps) {
  const [activeTab, setActiveTab] = useState('applications');
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [holidayRequests, setHolidayRequests] = useState<any[]>([]);
  const [matingRequests, setMatingRequests] = useState<any[]>([]);

  // Determine which tabs to show based on vendor role
  const roleCapabilities: Record<string, string[]> = {
    'ngo': ['applications'],
    'shelter': ['applications'],
    'breeder': ['applications', 'inquiries', 'mating'],
    'pet_breeder': ['applications', 'inquiries', 'mating'],
    'pet_relocation': ['quotes'],
    'relocation': ['quotes'],
    'pet_holiday': ['holidays'],
    'pet_tour': ['holidays'],
    // Add more role mappings as needed
  };

  const availableTabs = roleCapabilities[vendorRole] || ['applications', 'inquiries'];

  useEffect(() => {
    loadData();
  }, [vendorId, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (activeTab === 'applications' || availableTabs.includes('applications')) {
        const appResponse = await apiClient.get<any>(`/vendor/${vendorId}/adoption-applications`);
        setApplications(appResponse.applications || []);
      }

      if (activeTab === 'inquiries' || availableTabs.includes('inquiries')) {
        const bookingsResponse = await apiClient.get<any>(`/vendor/bookings?vendorId=${vendorId}&status=inquiry`);
        setInquiries(bookingsResponse.bookings?.filter((b: any) => b.service_type === 'breeder_inquiry') || []);
      }

      if (activeTab === 'quotes' || availableTabs.includes('quotes')) {
        const quotesResponse = await apiClient.get<any>(`/vendor/${vendorId}/relocation-quotes`);
        setQuotes(quotesResponse.quotes || []);
      }

      if (activeTab === 'holidays' || availableTabs.includes('holidays')) {
        const holidaysResponse = await apiClient.get<any>(`/vendor/${vendorId}/holiday-custom-requests`);
        setHolidayRequests(holidaysResponse.requests || []);
      }

      if (activeTab === 'mating' || availableTabs.includes('mating')) {
        const matingResponse = await apiClient.get<any>(`/vendor/${vendorId}/mating-requests`);
        setMatingRequests(matingResponse.requests || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplicationAction = async (applicationId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/adoption-applications/${applicationId}`, {
        status,
        reviewerNotes: notes,
      });
      toast.success(`Application ${status}!`);
      loadData();
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('Failed to update application');
    }
  };

  const handleQuoteResponse = async (quoteId: string, finalPrice: number) => {
    try {
      await apiClient.post(`/vendor/${vendorId}/relocation-quotes/${quoteId}/respond`, {
        finalPrice,
      });
      toast.success('Quote response sent!');
      loadData();
    } catch (error) {
      console.error('Error responding to quote:', error);
      toast.error('Failed to respond');
    }
  };

  const renderApplicationCard = (app: any) => (
    <Card key={app.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{app.customer_name || 'Applicant'}</h3>
              <p className="text-sm text-gray-500">{app.pet_name ? `For: ${app.pet_name}` : 'General Application'}</p>
            </div>
          </div>
          <Badge variant={app.status === 'pending' ? 'outline' : app.status === 'approved' ? 'default' : 'destructive'}>
            {app.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <span className="text-gray-500">Experience:</span>
            <span className="ml-2 font-medium">{app.experience || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">Living:</span>
            <span className="ml-2 font-medium">{app.living_situation || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">Other Pets:</span>
            <span className="ml-2 font-medium">{app.other_pets || 'None'}</span>
          </div>
          <div>
            <span className="text-gray-500">Time:</span>
            <span className="ml-2 font-medium">{app.time_commitment || 'N/A'}</span>
          </div>
        </div>

        {app.reason && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700 italic">"{app.reason}"</p>
          </div>
        )}

        {app.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleApplicationAction(app.id, 'rejected')}
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleApplicationAction(app.id, 'approved')}
            >
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderInquiryCard = (inquiry: any) => (
    <Card key={inquiry.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{inquiry.customer_name || 'Customer'}</h3>
              <p className="text-sm text-gray-500">{inquiry.customer_phone || 'No phone'}</p>
            </div>
          </div>
          <Badge variant="outline">{inquiry.status}</Badge>
        </div>

        {inquiry.notes && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700">{inquiry.notes}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(`tel:${inquiry.customer_phone}`)}
          >
            <Phone className="w-4 h-4 mr-1" /> Call
          </Button>
          <Button
            size="sm"
            className="flex-1"
          >
            <MessageCircle className="w-4 h-4 mr-1" /> Respond
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderQuoteCard = (quote: any) => (
    <Card key={quote.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Plane className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{quote.origin} → {quote.destination}</h3>
              <p className="text-sm text-gray-500">{quote.transport_type} • {quote.number_of_pets} pets</p>
            </div>
          </div>
          <Badge variant={quote.status === 'pending' ? 'outline' : 'default'}>
            {quote.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <span className="text-gray-500">Pet Type:</span>
            <span className="ml-2 font-medium">{quote.pet_type || 'Dog'}</span>
          </div>
          <div>
            <span className="text-gray-500">Size:</span>
            <span className="ml-2 font-medium">{quote.pet_size || 'Medium'}</span>
          </div>
          <div>
            <span className="text-gray-500">Date:</span>
            <span className="ml-2 font-medium">{quote.preferred_date || 'Flexible'}</span>
          </div>
          <div>
            <span className="text-gray-500">Current Quote:</span>
            <span className="ml-2 font-medium text-blue-600">₹{(quote.total_quote || 0).toLocaleString()}</span>
          </div>
        </div>

        {quote.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleQuoteResponse(quote.id, quote.total_quote || 10000)}
            >
              Accept & Send Quote
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderHolidayRequestCard = (request: any) => (
    <Card key={request.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{request.destination}</h3>
              <p className="text-sm text-gray-500">{request.duration_days} days • {request.number_of_pets} pets</p>
            </div>
          </div>
          <Badge variant="outline">{request.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <span className="text-gray-500">Start:</span>
            <span className="ml-2 font-medium">{request.start_date || 'TBD'}</span>
          </div>
          <div>
            <span className="text-gray-500">End:</span>
            <span className="ml-2 font-medium">{request.end_date || 'TBD'}</span>
          </div>
          <div>
            <span className="text-gray-500">Accommodation:</span>
            <span className="ml-2 font-medium capitalize">{request.accommodation_type || 'Standard'}</span>
          </div>
          <div>
            <span className="text-gray-500">Est. Price:</span>
            <span className="ml-2 font-medium text-orange-600">₹{(request.estimated_price || 0).toLocaleString()}</span>
          </div>
        </div>

        {request.status === 'pending_quote' && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-orange-600 hover:bg-orange-700">
              Send Custom Quote
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderMatingRequestCard = (request: any) => (
    <Card key={request.id} className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{request.from_pet_name} ❤️ {request.to_pet_name}</h3>
              <p className="text-sm text-gray-500">From: {request.from_owner_name}</p>
            </div>
          </div>
          <Badge variant={request.status === 'pending' ? 'outline' : request.status === 'accepted' ? 'default' : 'destructive'}>
            {request.status}
          </Badge>
        </div>

        {request.message && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-700 italic">"{request.message}"</p>
          </div>
        )}

        {request.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" /> Decline
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-pink-600 hover:bg-pink-700"
            >
              <Check className="w-4 h-4 mr-1" /> Accept
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const getTabData = () => {
    switch (activeTab) {
      case 'applications':
        return applications;
      case 'inquiries':
        return inquiries;
      case 'quotes':
        return quotes;
      case 'holidays':
        return holidayRequests;
      case 'mating':
        return matingRequests;
      default:
        return [];
    }
  };

  const renderTabContent = () => {
    const data = getTabData();

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {activeTab === 'applications' && <Heart className="w-8 h-8 text-gray-400" />}
            {activeTab === 'inquiries' && <MessageCircle className="w-8 h-8 text-gray-400" />}
            {activeTab === 'quotes' && <Plane className="w-8 h-8 text-gray-400" />}
            {activeTab === 'holidays' && <Calendar className="w-8 h-8 text-gray-400" />}
            {activeTab === 'mating' && <Heart className="w-8 h-8 text-gray-400" />}
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">No {activeTab} yet</h3>
          <p className="text-sm text-gray-500">New {activeTab} will appear here</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {activeTab === 'applications' && data.map(renderApplicationCard)}
        {activeTab === 'inquiries' && data.map(renderInquiryCard)}
        {activeTab === 'quotes' && data.map(renderQuoteCard)}
        {activeTab === 'holidays' && data.map(renderHolidayRequestCard)}
        {activeTab === 'mating' && data.map(renderMatingRequestCard)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Service Requests</h1>
            <p className="text-sm text-gray-500">Manage customer requests</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {availableTabs.includes('applications') && (
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeTab === 'applications'
                  ? 'bg-pink-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Adoption ({applications.length})
            </button>
          )}
          {availableTabs.includes('inquiries') && (
            <button
              onClick={() => setActiveTab('inquiries')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeTab === 'inquiries'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Inquiries ({inquiries.length})
            </button>
          )}
          {availableTabs.includes('quotes') && (
            <button
              onClick={() => setActiveTab('quotes')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeTab === 'quotes'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Quotes ({quotes.length})
            </button>
          )}
          {availableTabs.includes('holidays') && (
            <button
              onClick={() => setActiveTab('holidays')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeTab === 'holidays'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Holidays ({holidayRequests.length})
            </button>
          )}
          {availableTabs.includes('mating') && (
            <button
              onClick={() => setActiveTab('mating')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                activeTab === 'mating'
                  ? 'bg-pink-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              Peer to Peer ({matingRequests.length})
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {renderTabContent()}
      </div>
    </div>
  );
}
