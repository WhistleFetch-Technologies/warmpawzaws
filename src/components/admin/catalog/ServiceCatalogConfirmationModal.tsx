/**
 * Service Catalog Confirmation Modal
 * 
 * Provides UI for confirming service seeding and price updates
 * with AI-researched data preview
 */

import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface ServicePreview {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  currentPrice?: number;
  suggestedPrice?: number;
  change?: number;
  changePercent?: string;
  reasoning?: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: 'seed' | 'price_update';
  data: {
    services?: ServicePreview[];
    stats?: {
      totalServices?: number;
      categoriesSeeded?: number;
      breakdown?: Array<{ category: string; services: number }>;
      updated?: number;
      skipped?: number;
    };
  };
  isLoading?: boolean;
}

export function ServiceCatalogConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  mode,
  data,
  isLoading = false
}: ConfirmationModalProps) {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(data.services?.map(s => s.serviceId) || [])
  );

  if (!isOpen) return null;

  const handleToggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedServices.size === data.services?.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(data.services?.map(s => s.serviceId) || []));
    }
  };

  const selectedCount = selectedServices.size;
  const totalPriceChange = data.services
    ?.filter(s => selectedServices.has(s.serviceId))
    .reduce((sum, s) => sum + (s.change || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold">
              {mode === 'seed' ? '📦 Seed Service Catalog' : '💰 Update Market Prices'}
            </h2>
            <p className="text-gray-600 mt-1">
              {mode === 'seed'
                ? 'Review services before seeding the catalog'
                : 'Review AI-researched prices before updating'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Stats Summary */}
        {data.stats && (
          <div className="p-6 bg-blue-50 border-b">
            <div className="grid grid-cols-3 gap-4">
              {mode === 'seed' ? (
                <>
                  <div>
                    <div className="text-sm text-gray-600">Total Services</div>
                    <div className="text-2xl font-bold">{data.stats.totalServices || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Categories</div>
                    <div className="text-2xl font-bold">{data.stats.categoriesSeeded || 0}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Breakdown</div>
                    <div className="text-sm">
                      {data.stats.breakdown?.map(b => `${b.category}: ${b.services}`).join(', ')}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-sm text-gray-600">Selected Services</div>
                    <div className="text-2xl font-bold">{selectedCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Price Change</div>
                    <div className={`text-2xl font-bold ${totalPriceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{totalPriceChange.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <div className="text-sm font-medium">Ready to Update</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Services List */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'price_update' && (
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedServices.size === data.services?.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gray-600">
                {selectedCount} of {data.services?.length || 0} selected
              </span>
            </div>
          )}

          <div className="space-y-3">
            {data.services?.map((service) => {
              const isSelected = selectedServices.has(service.serviceId);
              const priceChange = service.change || 0;
              const isPriceIncrease = priceChange > 0;

              return (
                <div
                  key={service.serviceId}
                  className={`border rounded-lg p-4 transition ${
                    mode === 'price_update' && !isSelected ? 'opacity-50' : ''
                  } ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  {mode === 'price_update' && (
                    <div className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleService(service.serviceId)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {service.serviceName}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Category</div>
                      <div className="text-sm font-medium">{service.categoryName}</div>
                    </div>

                    {mode === 'price_update' && (
                      <>
                        <div>
                          <div className="text-xs text-gray-500">Current Price</div>
                          <div className="text-sm font-medium">₹{service.currentPrice?.toFixed(2) || '0.00'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Suggested Price</div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">₹{service.suggestedPrice?.toFixed(2) || '0.00'}</span>
                            {priceChange !== 0 && (
                              <span className={`text-xs flex items-center gap-1 ${
                                isPriceIncrease ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {isPriceIncrease ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {service.changePercent}%
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {mode === 'seed' && (
                      <div>
                        <div className="text-xs text-gray-500">Price</div>
                        <div className="text-sm font-medium">₹{service.suggestedPrice?.toFixed(2) || '0.00'}</div>
                      </div>
                    )}
                  </div>

                  {service.reasoning && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      <strong>AI Reasoning:</strong> {service.reasoning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <AlertCircle size={16} />
            <span>
              {mode === 'seed'
                ? 'This will add all services to the catalog'
                : `This will update prices for ${selectedCount} selected services`}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading || (mode === 'price_update' && selectedCount === 0)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  {mode === 'seed' ? 'Confirm & Seed' : `Confirm & Update ${selectedCount} Services`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

