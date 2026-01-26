'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Global error handler to catch and log errors
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
      if (event.error?.message?.includes('toLowerCase')) {
        console.error('toLowerCase error detected:', {
          message: event.error.message,
          stack: event.error.stack,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      }
    };

    window.addEventListener('error', handleError);
    
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [router]);

  useEffect(() => {
    if (vendorId) {
      loadPrescriptions();
    }
  }, [vendorId, filterDate]);

  const loadPrescriptions = async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      setError(null);
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
        try {
          if (result && result.success && result.prescriptions) {
            const prescriptions = Array.isArray(result.prescriptions) ? result.prescriptions : [];
            prescriptions.forEach((prescription: any) => {
              if (prescription && typeof prescription === 'object' && prescription.id) {
                allPrescriptions.push(prescription);
              }
            });
          }
        } catch (error) {
          console.error('Error processing prescription result:', error);
        }
      });
      
      // Sort by created_at descending (with safety checks)
      const validPrescriptions = allPrescriptions.filter((p: any) => {
        return p && typeof p === 'object' && p.id;
      });
      
      validPrescriptions.sort((a, b) => {
        try {
          const dateA = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b?.created_at ? new Date(b.created_at).getTime() : 0;
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          return dateB - dateA;
        } catch {
          return 0;
        }
      });
      
      setPrescriptions(validPrescriptions);
    } catch (err: any) {
      console.error('Error loading prescriptions:', err);
      const errorMsg = err?.message || 'Failed to load prescriptions';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrescriptions = useMemo(() => {
    // Ensure prescriptions is always an array
    if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
      return [];
    }
    
    return prescriptions.filter((prescription) => {
      try {
        if (!prescription || typeof prescription !== 'object') return true;
        
        if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
          const query = String(searchQuery || '').toLowerCase();
          
          // Helper to safely get medications array
          const getMedications = () => {
            try {
              if (!prescription.medications) return [];
              if (Array.isArray(prescription.medications)) return prescription.medications;
              if (typeof prescription.medications === 'string') {
                try {
                  const parsed = JSON.parse(prescription.medications);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              }
              return [];
            } catch {
              return [];
            }
          };
          
          const medications = getMedications();
          
          // Check other fields first
          const matchesOtherFields = (
            (prescription.diagnosis && typeof prescription.diagnosis === 'string' && String(prescription.diagnosis).toLowerCase().includes(query)) ||
            (prescription.instructions && typeof prescription.instructions === 'string' && String(prescription.instructions).toLowerCase().includes(query)) ||
            (prescription.pet?.name && typeof prescription.pet.name === 'string' && String(prescription.pet.name).toLowerCase().includes(query))
          );
          
          // Only check medications if it's a valid array
          if (!Array.isArray(medications) || medications.length === 0) {
            return matchesOtherFields;
          }
          
          // Safely check medications with extra defensive coding
          try {
            const matchesMedications = medications.some((med: any) => {
              try {
                // Validate med is not null/undefined
                if (!med || (typeof med !== 'string' && typeof med !== 'object')) {
                  return false;
                }
                
                // Handle string medications
                if (typeof med === 'string') {
                  const medStr = String(med || '');
                  if (medStr && typeof medStr === 'string') {
                    return medStr.toLowerCase().includes(query);
                  }
                  return false;
                }
                
                // Handle object medications
                if (typeof med === 'object' && med !== null) {
                  if (med.name) {
                    const medName = String(med.name || '');
                    if (medName && typeof medName === 'string') {
                      return medName.toLowerCase().includes(query);
                    }
                  }
                }
                
                return false;
              } catch (err) {
                console.error('Error in medications.some callback:', err, med);
                return false;
              }
            });
            
            return matchesOtherFields || matchesMedications;
          } catch (err) {
            console.error('Error checking medications:', err, medications);
            return matchesOtherFields;
          }
        }
        return true;
      } catch (error) {
        console.error('Error filtering prescription:', error, prescription);
        return true; // Include in results if filter fails
      }
    });
  }, [prescriptions, searchQuery]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Prescriptions</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => { setError(null); loadPrescriptions(); }}>
            Retry
          </Button>
        </div>
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
              {(['all', 'today', 'week', 'month'] as const).map((filter) => {
                const filterStr = String(filter);
                return (
                  <Button
                    key={filterStr}
                    variant={filterDate === filter ? 'default' : 'outline'}
                    onClick={() => setFilterDate(filter)}
                    className={filterDate === filter ? 'bg-orange-500 hover:bg-orange-600' : ''}
                  >
                    {(() => {
                      if (filterStr === 'all') return 'All Time';
                      if (filterStr && typeof filterStr === 'string' && filterStr.length > 0) {
                        try {
                          const firstChar = filterStr.charAt(0);
                          if (firstChar && typeof firstChar === 'string') {
                            return firstChar.toUpperCase() + filterStr.slice(1);
                          }
                        } catch (e) {
                          console.error('Error formatting filter:', e);
                        }
                      }
                      return filterStr || 'Unknown';
                    })()}
                  </Button>
                );
              })}
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

                {(() => {
                  // Safely parse medications
                  let medications: any[] = [];
                  if (prescription.medications) {
                    if (Array.isArray(prescription.medications)) {
                      medications = prescription.medications;
                    } else if (typeof prescription.medications === 'string') {
                      try {
                        const parsed = JSON.parse(prescription.medications);
                        medications = Array.isArray(parsed) ? parsed : [];
                      } catch {
                        medications = [];
                      }
                    }
                  }
                  
                  return medications.length > 0 ? (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Medications</h4>
                      <div className="space-y-2">
                        {medications.map((med: any, index: number) => {
                          // Handle both object and string medication formats
                          const medName = typeof med === 'string' ? med : (med?.name || 'Unknown');
                          const medDosage = typeof med === 'object' ? med?.dosage : null;
                          const medFrequency = typeof med === 'object' ? med?.frequency : null;
                          const medDuration = typeof med === 'object' ? med?.duration : null;
                          
                          return (
                            <div key={index} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{medName}</span>
                                {medDosage && (
                                  <span className="text-sm text-gray-600">{medDosage}</span>
                                )}
                              </div>
                              {medFrequency && (
                                <p className="text-sm text-gray-500 mt-1">{medFrequency}</p>
                              )}
                              {medDuration && (
                                <p className="text-sm text-gray-500">{medDuration}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                })()}

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
