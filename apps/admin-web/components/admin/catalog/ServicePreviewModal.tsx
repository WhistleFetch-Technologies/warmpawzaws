'use client';

import { X, Package, DollarSign, Clock, MapPin } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { StatusBadge } from './StatusBadge';

interface ServicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: {
    id: string;
    name: string;
    description?: string;
    category: string;
    price: number;
    duration?: string;
    status: 'active' | 'inactive' | 'pending' | 'draft';
    serviceType?: 'at-home' | 'at-center';
    createdAt: string;
  } | null;
}

export function ServicePreviewModal({
  isOpen,
  onClose,
  service
}: ServicePreviewModalProps) {
  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-0 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900">Service Preview</h3>
          <button
            onClick={onClose}
            className="p-0 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-0 space-y-6">
          <div>
            <div className="flex items-center gap-0 mb-0">
              <Package className="w-5 h-5 text-gray-400" />
              <h4 className="text-xl font-bold text-gray-900">{service.name}</h4>
              <StatusBadge status={service.status} />
            </div>
            <p className="text-sm text-gray-500 mb-0">ID: {service.id}</p>
            {service.description && (
              <p className="text-gray-600">{service.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-0 mb-0">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Price</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">₹{service.price}</p>
            </div>

            {service.duration && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-0 mb-0">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Duration</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{service.duration}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-0">
              <span className="text-sm font-medium text-gray-700">Category:</span>
              <span className="px-0 py-0 text-xs bg-blue-100 text-blue-700 rounded-full">
                {service.category}
              </span>
            </div>

            {service.serviceType && (
              <div className="flex items-center gap-0">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Service Type:</span>
                <span className="text-sm text-gray-600 capitalize">{service.serviceType}</span>
              </div>
            )}

            <div className="flex items-center gap-0">
              <span className="text-sm font-medium text-gray-700">Created:</span>
              <span className="text-sm text-gray-600">
                {new Date(service.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-0 p-0 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

