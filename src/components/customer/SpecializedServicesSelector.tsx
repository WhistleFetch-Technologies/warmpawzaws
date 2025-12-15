import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { FileText, MessageSquare, Plus, ClipboardList, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SpecializedServicesSelectorProps {
  bookingId: string;
  vendorId: string;
  onServicesAdded?: (services: any) => void;
}

export function SpecializedServicesSelector({ 
  bookingId, 
  vendorId,
  onServicesAdded 
}: SpecializedServicesSelectorProps) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [addOnServices, setAddOnServices] = useState<any[]>([]);
  
  // Form state
  const [prescriptionRequested, setPrescriptionRequested] = useState(false);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [shareMedicalRecords, setShareMedicalRecords] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  useEffect(() => {
    fetchConfig();
    fetchAddOnServices();
  }, [bookingId, vendorId]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/specialized-services/config`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchAddOnServices = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/add-on-services`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setAddOnServices(data.addOnServices || []);
      }
    } catch (error) {
      console.error('Error fetching add-on services:', error);
    }
  };

  const handleAddServices = async () => {
    try {
      setLoading(true);

      const selectedAddOnObjects = addOnServices.filter(service => 
        selectedAddOns.includes(service.serviceId)
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/add-specialized-services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            prescriptionRequested,
            prescriptionNotes,
            shareMedicalRecords,
            addOnServices: selectedAddOnObjects
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Specialized services added successfully!');
        onServicesAdded?.(data.specializedServices);
      } else {
        toast.error('Failed to add services');
      }
    } catch (error) {
      console.error('Error adding services:', error);
      toast.error('Error adding services');
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const hasAnyOption = config.prescriptionAllowed || config.medicalRecordsRequired || 
                        config.chatEnabled || addOnServices.length > 0;

  if (!hasAnyOption) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Plus className="w-5 h-5 text-orange-600" />
        <h3 className="font-semibold text-gray-900">Additional Services</h3>
      </div>

      {/* Prescription Request */}
      {config.prescriptionAllowed && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="prescription"
              checked={prescriptionRequested}
              onChange={(e) => setPrescriptionRequested(e.target.checked)}
              className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <label htmlFor="prescription" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-gray-900">Request Prescription</span>
              </div>
              <p className="text-sm text-gray-600">
                Get a prescription from the veterinarian during consultation
              </p>
            </label>
          </div>

          {prescriptionRequested && (
            <textarea
              value={prescriptionNotes}
              onChange={(e) => setPrescriptionNotes(e.target.value)}
              placeholder="Any specific notes for the prescription..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
          )}
        </div>
      )}

      {/* Medical Records Sharing */}
      {config.medicalRecordsRequired && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="records"
            checked={shareMedicalRecords}
            onChange={(e) => setShareMedicalRecords(e.target.checked)}
            className="mt-1 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
          />
          <label htmlFor="records" className="flex-1 cursor-pointer">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-orange-600" />
              <span className="font-medium text-gray-900">Share Medical Records</span>
            </div>
            <p className="text-sm text-gray-600">
              Share your pet's medical history with the service provider
            </p>
          </label>
        </div>
      )}

      {/* Chat Feature */}
      {config.chatEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 mb-1">Real-time Chat Available</p>
              <p className="text-sm text-blue-700">
                Chat with {config.allowedRoles.join(', ')} during your appointment
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add-on Services */}
      {addOnServices.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Add-on Services</h4>
          <div className="space-y-2">
            {addOnServices.map((service) => (
              <div
                key={service.serviceId}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedAddOns.includes(service.serviceId)
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedAddOns(prev => 
                    prev.includes(service.serviceId)
                      ? prev.filter(id => id !== service.serviceId)
                      : [...prev, service.serviceId]
                  );
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {selectedAddOns.includes(service.serviceId) && (
                        <CheckCircle className="w-4 h-4 text-orange-600" />
                      )}
                      <span className="font-medium text-gray-900">{service.serviceName}</span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      {service.duration && <span>{service.duration} min</span>}
                      {service.category && <span>• {service.category}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">₹{service.price}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {(prescriptionRequested || shareMedicalRecords || selectedAddOns.length > 0) && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-gray-900 mb-2">Selected Services:</h4>
          <ul className="space-y-1 text-sm">
            {prescriptionRequested && (
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Prescription Request
              </li>
            )}
            {shareMedicalRecords && (
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Medical Records Shared
              </li>
            )}
            {selectedAddOns.map(id => {
              const service = addOnServices.find(s => s.serviceId === id);
              return service ? (
                <li key={id} className="flex items-center justify-between text-gray-700">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    {service.serviceName}
                  </span>
                  <span className="font-medium">₹{service.price}</span>
                </li>
              ) : null;
            })}
          </ul>
          
          {selectedAddOns.length > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="font-medium text-gray-900">Add-on Total:</span>
              <span className="font-semibold text-orange-600">
                ₹{addOnServices
                  .filter(s => selectedAddOns.includes(s.serviceId))
                  .reduce((sum, s) => sum + s.price, 0)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleAddServices}
        disabled={loading || (!prescriptionRequested && !shareMedicalRecords && selectedAddOns.length === 0)}
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        {loading ? 'Adding Services...' : 'Add Selected Services'}
      </Button>
    </div>
  );
}
