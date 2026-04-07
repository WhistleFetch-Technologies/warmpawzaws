'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { FileText, Calendar, User, Search, Filter, Plus, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface MedicalRecord {
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
  pet?: { name: string };
  booking?: { booking_date: string; booking_time: string };
}

export default function MedicalRecordsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadRecords();
  }, [router]);

  const loadRecords = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      // Get vendor's bookings first, then fetch medical records for those bookings
      const bookingsRes = await apiClient.get<any>(`/vendor/${vendorId}/bookings`);
      const bookings = bookingsRes.bookings || [];
      
      // Fetch medical records for each booking
      const recordPromises = bookings.map((booking: any) =>
        apiClient.get<any>(`/bookings/${booking.id}/medical-records`).catch(() => ({ success: false, records: [] }))
      );
      
      const recordResults = await Promise.all(recordPromises);
      const allRecords: MedicalRecord[] = [];
      
      recordResults.forEach((result) => {
        if (result.success && result.records) {
          allRecords.push(...result.records);
        }
      });
      
      // Sort by created_at descending
      allRecords.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setRecords(allRecords);
    } catch (err: any) {
      console.error('Error loading medical records:', err);
      toast.error(err.message || 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  const recordTypes = Array.from(new Set(records.map(r => r.record_type))).filter(Boolean);

  const filteredRecords = records.filter((record) => {
    if (filterType !== 'all' && record.record_type !== filterType) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        record.title?.toLowerCase().includes(query) ||
        record.description?.toLowerCase().includes(query) ||
        record.pet?.name?.toLowerCase().includes(query) ||
        record.record_type?.toLowerCase().includes(query)
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

  const getRecordTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'consultation': return '💊';
      case 'examination': return '🔍';
      case 'test_result': return '🧪';
      case 'vaccination': return '💉';
      case 'surgery': return '⚕️';
      case 'treatment': return '🏥';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Medical Records"
          subtitle="View and manage medical records"
          onBack={() => router.back()}
        />

        <div className="w-full px-4 py-6 sm:px-6">
        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search by title, description, pet name, or record type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                className={filterType === 'all' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              >
                All Types
              </Button>
              {recordTypes.map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  onClick={() => setFilterType(type)}
                  className={filterType === type ? 'bg-orange-500 hover:bg-orange-600' : ''}
                >
                  {getRecordTypeIcon(type)} {type}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Records List */}
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No medical records found</h3>
            <p className="text-gray-500">
              {searchQuery || filterType !== 'all' 
                ? 'Try adjusting your search criteria' 
                : 'Medical records will appear here when created'}
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
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                      {getRecordTypeIcon(record.record_type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {record.title || record.record_type}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        {record.pet && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {record.pet.name}
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
                  <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    {record.record_type}
                  </span>
                </div>

                {record.description && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.description}</p>
                  </div>
                )}

                {record.attachments && record.attachments.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Attachments</h4>
                    <div className="flex flex-wrap gap-2">
                      {record.attachments.map((attachment, index) => (
                        <a
                          key={index}
                          href={attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                        >
                          <File className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-700">Attachment {index + 1}</span>
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
    </div>
  );
}
