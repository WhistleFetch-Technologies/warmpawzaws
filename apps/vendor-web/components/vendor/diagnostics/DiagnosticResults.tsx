'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { FileText, Upload, Search, Calendar } from 'lucide-react';
import { CapabilityGate } from '../CapabilityGate';
import { UploadResults } from './UploadResults';

interface DiagnosticTest {
  id: string;
  vendor_id: string;
  test_name: string;
  test_code?: string;
  category?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available: boolean;
}

interface DiagnosticResultsProps {
  vendorId: string;
  onBack?: () => void;
}

export function DiagnosticResults({ vendorId, onBack }: DiagnosticResultsProps) {
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTests();
  }, [vendorId]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests`);
      
      if (response.success) {
        setTests(response.tests || []);
      }
    } catch (error) {
      console.error('Error loading diagnostic tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = tests.filter(test => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      test.test_name?.toLowerCase().includes(term) ||
      test.test_code?.toLowerCase().includes(term) ||
      test.category?.toLowerCase().includes(term)
    );
  });

  if (showUpload) {
    return (
      <UploadResults
        vendorId={vendorId}
        onBack={() => setShowUpload(false)}
        onSuccess={() => {
          setShowUpload(false);
          loadTests();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <CapabilityGate capability="diagnostic_results" showDisabledMessage>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Diagnostic Tests</h1>
            <p className="text-gray-500 mt-1">Manage your diagnostic test catalog</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-5 h-5" />
            Add Test
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tests..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tests List */}
        {filteredTests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No diagnostic tests</h3>
            <p className="text-gray-500 mb-4">Add your first diagnostic test to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Test
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredTests.map((test) => (
              <div
                key={test.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{test.test_name}</h3>
                    {test.test_code && (
                      <p className="text-sm text-gray-500">Code: {test.test_code}</p>
                    )}
                  </div>
                  {test.is_available ? (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                      Available
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                      Unavailable
                    </span>
                  )}
                </div>

                {test.category && (
                  <p className="text-sm text-gray-600 mb-2">Category: {test.category}</p>
                )}

                {test.description && (
                  <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                )}

                <div className="flex items-center gap-4 text-sm text-gray-500 mt-3 pt-3 border-t">
                  {test.price && (
                    <span className="font-medium text-gray-900">₹{test.price}</span>
                  )}
                  {test.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {test.duration_minutes} min
                    </span>
                  )}
                  {test.sample_type && (
                    <span>Sample: {test.sample_type}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CapabilityGate>
  );
}
