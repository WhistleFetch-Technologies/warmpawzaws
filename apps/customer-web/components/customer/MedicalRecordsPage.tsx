"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Calendar, Stethoscope, Pill, Syringe, Download, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { downloadFromUrl, getDownloadMessage } from '@/lib/download-file';

interface MedicalRecordsPageProps {
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

interface MedicalRecord {
  id: string;
  pet_id: string;
  pet_name?: string;
  record_type: 'vaccination' | 'checkup' | 'treatment' | 'prescription' | 'surgery' | 'diagnostic_report' | 'other';
  title: string;
  description?: string;
  veterinarian_name?: string;
  clinic_name?: string;
  date: string;
  attachments?: string[];
  notes?: string;
  document_url?: string | null;
  booking_id?: string | null;
}

export function MedicalRecordsPage(props: MedicalRecordsPageProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadRecords();
    } else {
      setLoading(false);
    }
  }, [phone, filterType]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/${phone}/medical-records`);
      setRecords(response.records || response || []);
    } catch (error: any) {
      console.error('Error loading medical records:', error);
      toast.error('Failed to load medical records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const getRecordIcon = (type: string) => {
    const icons: Record<string, any> = {
      vaccination: Syringe,
      checkup: Stethoscope,
      treatment: Pill,
      prescription: FileText,
      surgery: Stethoscope,
      diagnostic_report: FileText,
      other: FileText,
    };
    return icons[type] || FileText;
  };

  const getRecordColor = (type: string) => {
    const colors: Record<string, string> = {
      vaccination: 'bg-blue-100 text-blue-700 border-blue-200',
      checkup: 'bg-green-100 text-green-700 border-green-200',
      treatment: 'bg-orange-100 text-orange-700 border-orange-200',
      prescription: 'bg-purple-100 text-purple-700 border-purple-200',
      surgery: 'bg-red-100 text-red-700 border-red-200',
      diagnostic_report: 'bg-teal-100 text-teal-700 border-teal-200',
      other: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = !searchQuery || 
      record.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.pet_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || record.record_type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Medical Records</h1>
          </div>
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to view medical records</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Medical Records</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['all', 'vaccination', 'checkup', 'treatment', 'prescription', 'surgery', 'diagnostic_report'].map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className={`flex-shrink-0 ${
                    filterType === type ? 'bg-[#FF8C42] text-white' : ''
                  }`}
                >
                  {type === 'diagnostic_report' ? 'Lab Reports' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Records List */}
          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading records...</p>
            </Card>
          ) : filteredRecords.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No medical records found</p>
              <p className="text-sm text-gray-500">
                {searchQuery || filterType !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Medical records will appear here after visits'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record) => {
                const RecordIcon = getRecordIcon(record.record_type);
                return (
                  <Card key={record.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getRecordColor(record.record_type)}`}>
                        <RecordIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{record.title}</h3>
                            {record.pet_name && (
                              <p className="text-sm text-gray-500 mt-1">Pet: {record.pet_name}</p>
                            )}
                          </div>
                          <Badge className={getRecordColor(record.record_type)}>
                            {record.record_type}
                          </Badge>
                        </div>
                        {record.description && (
                          <p className="text-sm text-gray-600 mb-2">{record.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(record.date).toLocaleDateString()}
                          </div>
                          {record.veterinarian_name && (
                            <div className="flex items-center gap-1">
                              <Stethoscope className="w-4 h-4" />
                              {record.veterinarian_name}
                            </div>
                          )}
                        </div>
                        {record.clinic_name && (
                          <p className="text-xs text-gray-500 mt-1">At: {record.clinic_name}</p>
                        )}
                        {(record.document_url || record.record_type === 'diagnostic_report') && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={async () => {
                                const url = record.document_url;
                                if (!url) {
                                  toast.error('Report link not available');
                                  return;
                                }
                                try {
                                  const { saveResult } = await downloadFromUrl({
                                    url,
                                    title: record.title || 'Medical report',
                                    previewHtmlInBrowser: false,
                                  });
                                  if (saveResult === 'failed') {
                                    toast.error(getDownloadMessage(saveResult, 'report'));
                                  } else {
                                    toast.success(getDownloadMessage(saveResult, 'report'));
                                  }
                                } catch {
                                  toast.error('Failed to download report');
                                }
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download report
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
