'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { TestTube, Calendar, Clock, FileText } from 'lucide-react';

interface DiagnosticsBookingFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

interface DiagnosticTest {
  id: string;
  test_name: string;
  test_code?: string;
  category: string;
  description?: string;
  price: number;
  duration_minutes: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available: boolean;
}

export function DiagnosticsBookingFlow({ vendorId, customerPhone, onSuccess, onCancel }: DiagnosticsBookingFlowProps) {
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
  // Booking details
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [address, setAddress] = useState('');
  const [preferredSampleType, setPreferredSampleType] = useState<'home' | 'center'>('center');

  useEffect(() => {
    loadTests();
  }, [vendorId]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests`);
      
      if (response.success && response.tests) {
        setTests(response.tests.filter((t: DiagnosticTest) => t.is_available));
      }
    } catch (err: any) {
      console.error('Error loading tests:', err);
      setError('Failed to load diagnostic tests');
    } finally {
      setLoading(false);
    }
  };

  const toggleTest = (testId: string) => {
    setSelectedTests(prev => 
      prev.includes(testId) 
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const getTotalPrice = () => {
    return selectedTests.reduce((total, testId) => {
      const test = tests.find(t => t.id === testId);
      return total + (test?.price || 0);
    }, 0);
  };

  const getCategories = () => {
    const categories = new Set(tests.map(t => t.category).filter(Boolean));
    return Array.from(categories);
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         test.test_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || test.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedTests.length === 0) {
      setError('Please select at least one test');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }

    if (!patientName.trim()) {
      setError('Patient name is required');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;

      if (!customerId) {
        throw new Error('Customer not found');
      }

      const selectedTestDetails = selectedTests.map(id => tests.find(t => t.id === id)).filter(Boolean);
      
      const bookingData = {
        serviceId: 'diagnostics',
        vendorId,
        customerId,
        serviceType: preferredSampleType === 'home' ? 'at_home' : 'at_center',
        bookingType: 'scheduled',
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        address: preferredSampleType === 'home' ? address : undefined,
        notes: JSON.stringify({
          tests: selectedTestDetails.map(t => ({
            id: t?.id,
            name: t?.test_name,
            code: t?.test_code,
            category: t?.category,
            price: t?.price,
          })),
          patientName,
          patientAge,
          preferredSampleType,
          preparationInstructions: selectedTestDetails.map(t => t?.preparation_instructions).filter(Boolean),
        }),
        totalAmount: getTotalPrice(),
      };

      const bookingResponse = await apiClient.post<any>('/bookings/create', bookingData);

      if (bookingResponse.success && bookingResponse.booking) {
        if (onSuccess) {
          onSuccess(bookingResponse.booking.id);
        }
      } else {
        throw new Error(bookingResponse.error || 'Failed to create booking');
      }
    } catch (err: any) {
      console.error('Error creating booking:', err);
      setError(err.message || 'Failed to book diagnostic tests');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-02">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-0">
      <h2 className="text-2xl font-bold text-gray-900 mb-0">Book Diagnostic Tests</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search tests..."
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <select
              value={categoryFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategoryFilter(e.target.value)}
              className="px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All Categories</option>
              {getCategories().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Test Selection */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Select Tests ({selectedTests.length} selected)</h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {filteredTests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No tests found
              </div>
            ) : (
              filteredTests.map((test) => (
                <label
                  key={test.id}
                  className={`p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-50 ${
                    selectedTests.includes(test.id) ? 'bg-orange-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test.id)}
                    onChange={() => toggleTest(test.id)}
                    className="mt-0 w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-0">
                          <TestTube className="text-orange-500" size={18} />
                          <span className="font-semibold text-gray-900">{test.test_name}</span>
                          {test.test_code && (
                            <span className="px-0 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {test.test_code}
                            </span>
                          )}
                        </div>
                        {test.category && (
                          <span className="text-sm text-gray-500 mt-0 block">{test.category}</span>
                        )}
                        {test.description && (
                          <p className="text-sm text-gray-600 mt-0">{test.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-0 text-sm text-gray-500">
                          {test.sample_type && (
                            <span>Sample: {test.sample_type}</span>
                          )}
                          {test.duration_minutes && (
                            <span className="flex items-center gap-0">
                              <Clock size={14} />
                              {test.duration_minutes} min
                            </span>
                          )}
                        </div>
                        {test.preparation_instructions && (
                          <div className="mt-0 p-0 bg-blue-50 rounded text-xs text-blue-700">
                            <FileText size={12} className="inline mr-0" />
                            {test.preparation_instructions}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-orange-600">₹{test.price}</p>
                      </div>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Selected Tests Summary */}
        {selectedTests.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selectedTests.length} test(s) selected</p>
                <p className="text-sm text-gray-600 mt-0">
                  {selectedTests.map(id => tests.find(t => t.id === id)?.test_name).filter(Boolean).join(', ')}
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-600">₹{getTotalPrice()}</p>
            </div>
          </div>
        )}

        {/* Patient Details */}
        <div className="bg-white rounded-xl p-1 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 mb-4">Patient Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientName(e.target.value)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Age
              </label>
              <input
                type="number"
                value={patientAge}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientAge(e.target.value)}
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Sample Collection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Sample Collection
            </label>
            <div className="grid grid-cols-2 gap-0">
              <button
                type="button"
                onClick={() => setPreferredSampleType('center')}
                className={`px-4 py-0 rounded-lg border-2 transition ${
                  preferredSampleType === 'center'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                At Diagnostic Center
              </button>
              <button
                type="button"
                onClick={() => setPreferredSampleType('home')}
                className={`px-4 py-0 rounded-lg border-2 transition ${
                  preferredSampleType === 'home'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Home Collection
              </button>
            </div>
          </div>

          {preferredSampleType === 'home' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Home Address *
              </label>
              <textarea
                value={address}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAddress(e.target.value)}
                required={preferredSampleType === 'home'}
                rows={3}
                placeholder="Enter complete address for home collection"
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          )}

          {/* Date and Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Calendar className="inline mr-0" size={16} />
                Preferred Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Clock className="inline mr-0" size={16} />
                Preferred Time *
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedTime(e.target.value)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-0">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-0 py-0 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={processing || selectedTests.length === 0}
            className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Booking...' : `Book Tests - ₹${getTotalPrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

