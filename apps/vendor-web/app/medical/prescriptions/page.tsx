'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, FileText, Calendar, User, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Prescription {
  id: string;
  booking_id: string;
  customer_id: string;
  pet_id?: string;
  vendor_id: string;
  medications: any[];
  instructions?: string;
  diagnosis?: string;
  follow_up_date?: string;
  created_at: string;
  pet?: { name: string };
  booking?: { booking_date: string; booking_time: string };
}

export default function PrescriptionsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadPrescriptions();
  }, [router, filterDate]);

  const loadPrescriptions = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      // Get vendor's bookings first, then fetch prescriptions for those bookings
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`);
      const bookings = bookingsRes.bookings || [];
      
      // Fetch prescriptions for each booking
      const prescriptionPromises = bookings.map((booking: any) =>
        apiClient.get<any>(`/prescriptions/booking/${booking.id}`).catch(() => ({ success: false, prescriptions: [] }))
      );
      
      const prescriptionResults = await Promise.all(prescriptionPromises);
      const allPrescriptions: Prescription[] = [];
      
      prescriptionResults.forEach((result) => {
        if (result.success && result.prescriptions) {
          allPrescriptions.push(...result.prescriptions);
        }
      });
      
      // Sort by created_at descending
      allPrescriptions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setPrescriptions(allPrescriptions);
    } catch (err: any) {
      console.error('Error loading prescriptions:', err);
      toast.error(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter((prescription) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        prescription.diagnosis?.toLowerCase().includes(query) ||
        prescription.instructions?.toLowerCase().includes(query) ||
        prescription.pet?.name?.toLowerCase().includes(query) ||
        prescription.medications?.some((med: any) => 
          med.name?.toLowerCase().includes(query)
        )
      );
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Prescriptions</h1>
              <p className="text-sm text-gray-500 mt-1">Manage and view all prescriptions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by diagnosis, instructions, pet name, or medication..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={filterDate === filter ? 'default' : 'outline'}
                  onClick={() => setFilterDate(filter)}
                  className={filterDate === filter ? 'bg-orange-500 hover:bg-orange-600' : ''}
                >
                  {filter === 'all' ? 'All Time' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Prescriptions List */}
        {filteredPrescriptions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No prescriptions found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search criteria' : 'Prescriptions will appear here when created'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPrescriptions.map((prescription) => (
              <div
                key={prescription.id}
                className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {prescription.pet?.name || 'Pet'}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDate(prescription.created_at)} at {formatTime(prescription.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/bookings/${prescription.booking_id}`)}
                  >
                    View Booking
                  </Button>
                </div>

                {prescription.diagnosis && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Diagnosis</h4>
                    <p className="text-sm text-gray-900">{prescription.diagnosis}</p>
                  </div>
                )}

                {prescription.medications && prescription.medications.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Medications</h4>
                    <div className="space-y-2">
                      {prescription.medications.map((med: any, index: number) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{med.name}</span>
                            {med.dosage && (
                              <span className="text-sm text-gray-600">{med.dosage}</span>
                            )}
                          </div>
                          {med.frequency && (
                            <p className="text-sm text-gray-500 mt-1">{med.frequency}</p>
                          )}
                          {med.duration && (
                            <p className="text-sm text-gray-500">{med.duration}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {prescription.instructions && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Instructions</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{prescription.instructions}</p>
                  </div>
                )}

                {prescription.follow_up_date && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>Follow-up:</strong> {formatDate(prescription.follow_up_date)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
