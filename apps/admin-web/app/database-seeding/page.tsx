'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Database, RefreshCw, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@warmpawz/ui';

export default function DatabaseSeedingPage() {
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<Record<string, any>>({});

  const seedOperations = [
    {
      id: 'vendors',
      label: 'Seed Vendors',
      description: 'Create sample vendor applications across all roles',
      endpoint: '/admin/seed-vendors',
      method: 'POST',
      color: 'blue'
    },
    {
      id: 'regions',
      label: 'Seed Regions',
      description: 'Seed default regions (Mumbai, Delhi, Bangalore, etc.)',
      endpoint: '/admin/regions/seed-all',
      method: 'POST',
      color: 'green'
    },
    {
      id: 'reset',
      label: 'Reset & Seed All',
      description: 'Clear all data and seed fresh test data',
      endpoint: '/admin/seed/reset-and-seed',
      method: 'POST',
      color: 'orange',
      warning: true
    },
    {
      id: 'clear-vendors',
      label: 'Clear Vendors',
      description: 'Remove all vendor data (use with caution)',
      endpoint: '/admin/seed/clear-vendors',
      method: 'POST',
      color: 'red',
      warning: true
    },
    {
      id: 'fix-categories',
      label: 'Fix Vendor Categories',
      description: 'Fix and normalize vendor category assignments',
      endpoint: '/admin/fix-vendor-categories',
      method: 'POST',
      color: 'purple'
    },
    {
      id: 'fix-indexes',
      label: 'Fix Database Indexes',
      description: 'Rebuild and optimize database indexes',
      endpoint: '/admin/vendors/fix-indexes',
      method: 'POST',
      color: 'indigo'
    }
  ];

  const handleSeed = async (operation: typeof seedOperations[0]) => {
    if (operation.warning) {
      const confirmed = window.confirm(
        `⚠️ Warning: ${operation.label}\n\n${operation.description}\n\nThis action cannot be undone. Are you sure you want to proceed?`
      );
      if (!confirmed) return;
    }

    try {
      setLoading(true);
      const result = await apiClient.post<any>(operation.endpoint, {});
      
      if (result.success !== false) {
        setSeedStatus(prev => ({
          ...prev,
          [operation.id]: {
            success: true,
            message: result.message || `${operation.label} completed successfully`,
            data: result
          }
        }));
        toast.success(`${operation.label} completed successfully`);
      } else {
        throw new Error(result.error || 'Operation failed');
      }
    } catch (error: any) {
      console.error(`Error in ${operation.label}:`, error);
      setSeedStatus(prev => ({
        ...prev,
        [operation.id]: {
          success: false,
          message: error.message || `Failed to ${operation.label.toLowerCase()}`
        }
      }));
      toast.error(`Failed: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-[#FF8C42]" />
            <h1 className="text-3xl font-bold text-gray-900">Database Seeding</h1>
          </div>
          <p className="text-gray-600">
            Manage database seeding operations for testing and development
          </p>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">⚠️ Development Only</h3>
              <p className="text-sm text-yellow-800">
                These operations are intended for development and testing environments only.
                Use with caution in production environments.
              </p>
            </div>
          </div>
        </div>

        {/* Seed Operations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seedOperations.map((operation) => {
            const status = seedStatus[operation.id];
            const isProcessing = loading;

            return (
              <div
                key={operation.id}
                className={`bg-white rounded-lg border-2 ${
                  operation.warning
                    ? 'border-red-200 hover:border-red-300'
                    : 'border-gray-200 hover:border-gray-300'
                } p-6 shadow-sm transition-all`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {operation.label}
                    </h3>
                    <p className="text-sm text-gray-600">{operation.description}</p>
                  </div>
                  {status?.success && (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                  {status?.success === false && (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                </div>

                {status && (
                  <div
                    className={`mb-4 p-3 rounded-md text-sm ${
                      status.success
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {status.message}
                  </div>
                )}

                <Button
                  onClick={() => handleSeed(operation)}
                  disabled={isProcessing}
                  variant={operation.warning ? 'destructive' : 'default'}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Execute
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Status Summary */}
        {Object.keys(seedStatus).length > 0 && (
          <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Operation History</h2>
            <div className="space-y-2">
              {Object.entries(seedStatus).map(([id, status]: [string, any]) => {
                const operation = seedOperations.find(op => op.id === id);
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-3 rounded-md ${
                      status.success
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {operation?.label || id}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">{status.message}</p>
                    </div>
                    {status.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
