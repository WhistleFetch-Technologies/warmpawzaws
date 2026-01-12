'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Syringe, Calendar, User, Search, Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface VaccinationRecord {
  id: string;
  pet_id?: string;
  customer_id: string;
  vendor_id: string;
  booking_id?: string;
  record_type: string;
  title?: string;
  description?: string;
  attachments?: string[];
  created_at: string;
  pet?: { name: string; breed?: string };
  booking?: { booking_date: string; booking_time: string };
}

export default function VaccinationPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadVaccinationRecords();
  }, [router]);

  const loadVaccinationRecords = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      // Get vendor's bookings first, then fetch medical records for those bookings
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`);
      const bookings = bookingsRes.bookings || [];
      
      // Fetch medical records for each booking, filter for vaccination type
      const recordPromises = bookings.map((booking: any) =>
        apiClient.get<any>(`/bookings/${booking.id}/medical-records`).catch(() => ({ success: false, records: [] }))
      );
      
      const recordResults = await Promise.all(recordPromises);
      const allRecords: VaccinationRecord[] = [];
      
      recordResults.forEach((result) => {
        if (result.success && result.records) {
          // Filter for vaccination records
          const vaccinationRecords = result.records.filter((record: any) => 
            record.record_type?.toLowerCase().includes('vaccination') ||
            record.record_type?.toLowerCase().includes('vaccine')
          );
          allRecords.push(...vaccinationRecords);
        }
      });
      
      // Sort by created_at descending
      allRecords.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setRecords(allRecords);
    } catch (err: any) {
      console.error('Error loading vaccination records:', err);
      toast.error(err.message || 'Failed to load vaccination records');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        record.title?.toLowerCase().includes(query) ||
        record.description?.toLowerCase().includes(query) ||
        record.pet?.name?.toLowerCase().includes(query) ||
        record.pet?.breed?.toLowerCase().includes(query)
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

  const extractVaccineName = (record: VaccinationRecord): string => {
    // Try to extract vaccine name from title or description
    if (record.title) {
      return record.title;
    }
    if (record.description) {
      // Common vaccine names
      const vaccines = ['Rabies', 'Distemper', 'Parvovirus', 'Hepatitis', 'Bordetella', 'Leptospirosis'];
      const found = vaccines.find(v => record.description!.toLowerCase().includes(v.toLowerCase()));
      return found || 'Vaccination';
    }
    return 'Vaccination';
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Vaccination Records</h1>
                <p className="text-sm text-gray-500 mt-1">View and manage pet vaccination records</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search by vaccine name, pet name, or breed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Records List */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Syringe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No vaccination records found</h3>
            <p className="text-gray-500">
              {searchQuery 
                ? 'Try adjusting your search criteria' 
                : 'Vaccination records will appear here when created'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Syringe className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {extractVaccineName(record)}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        {record.pet && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {record.pet.name}
                            {record.pet.breed && ` (${record.pet.breed})`}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(record.created_at)} at {formatTime(record.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {record.booking_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/bookings/${record.booking_id}`)}
                    >
                      View Booking
                    </Button>
                  )}
                </div>

                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    💉 Vaccination
                  </span>
                </div>

                {record.description && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Details</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.description}</p>
                  </div>
                )}

                {record.attachments && record.attachments.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Certificates/Documents</h4>
                    <div className="flex flex-wrap gap-2">
                      {record.attachments.map((attachment, index) => (
                        <a
                          key={index}
                          href={attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                        >
                          <span className="text-sm text-gray-700">📄 Document {index + 1}</span>
                        </a>
                      ))}
                    </div>
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
