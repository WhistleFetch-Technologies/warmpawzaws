import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Package,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  FileText,
  Heart,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface AddOn {
  addOnId: string;
  name: string;
  price: number;
  description: string;
}

interface SpecializedService {
  serviceId: string;
  serviceName: string;
  category: string;
  basePrice: number;
  description: string;
  duration: number;
  requiresPrescription: boolean;
  requiresMedicalRecords: boolean;
  allowsAddOns: boolean;
  addOns?: AddOn[];
  vendorId: string;
  isActive: boolean;
}

interface SpecializedServicesSelectorProps {
  vendorId: string;
  category?: string;
  petId: string;
  onServiceSelect: (service: SpecializedService, addOnIds: string[], totalPrice: number) => void;
  onPrescriptionRequired: () => void;
  onMedicalRecordsRequired: () => void;
}

export function SpecializedServicesSelector({
  vendorId,
  category,
  petId,
  onServiceSelect,
  onPrescriptionRequired,
  onMedicalRecordsRequired
}: SpecializedServicesSelectorProps) {
  const [services, setServices] = useState<SpecializedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<SpecializedService | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const [totalPrice, setTotalPrice] = useState(0);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);

  // Fetch services
  useEffect(() => {
    fetchServices();
    fetchPrescriptions();
    fetchMedicalRecords();
  }, [vendorId, category]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const url = category
        ? `${BASE_URL}/specialized-services/vendor/${vendorId}?category=${category}`
        : `${BASE_URL}/specialized-services/vendor/${vendorId}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescriptions = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/prescription/pet/${petId}?active=true`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPrescriptions(data.prescriptions || []);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/medical-record/pet/${petId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMedicalRecords(data.records || []);
      }
    } catch (error) {
      console.error('Error fetching medical records:', error);
    }
  };

  // Select service
  const handleServiceSelect = (service: SpecializedService) => {
    setSelectedService(service);
    setSelectedAddOns(new Set());
    setTotalPrice(service.basePrice);
  };

  // Toggle add-on
  const toggleAddOn = (addOnId: string, price: number) => {
    const newSelection = new Set(selectedAddOns);
    
    if (newSelection.has(addOnId)) {
      newSelection.delete(addOnId);
      setTotalPrice(totalPrice - price);
    } else {
      newSelection.add(addOnId);
      setTotalPrice(totalPrice + price);
    }
    
    setSelectedAddOns(newSelection);
  };

  // Confirm selection
  const handleConfirm = () => {
    if (!selectedService) {
      toast.error('Please select a service');
      return;
    }

    // Check prescription requirement
    if (selectedService.requiresPrescription && prescriptions.length === 0) {
      toast.warning('Prescription required for this service');
      onPrescriptionRequired();
      return;
    }

    // Check medical records requirement
    if (selectedService.requiresMedicalRecords && medicalRecords.length === 0) {
      toast.warning('Medical records required for this service');
      onMedicalRecordsRequired();
      return;
    }

    onServiceSelect(selectedService, Array.from(selectedAddOns), totalPrice);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Services List */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-600" />
          Specialized Services
        </h3>

        {services.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No specialized services available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.serviceId}
                onClick={() => handleServiceSelect(service)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedService?.serviceId === service.serviceId
                    ? 'border-orange-600 bg-orange-50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {service.serviceName}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      {service.description}
                    </p>
                    
                    {/* Requirements */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {service.requiresPrescription && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                          <FileText className="w-3 h-3" />
                          Prescription Required
                        </span>
                      )}
                      {service.requiresMedicalRecords && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          <Heart className="w-3 h-3" />
                          Medical Records Required
                        </span>
                      )}
                      {service.allowsAddOns && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <Plus className="w-3 h-3" />
                          Add-ons Available
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500">
                      Duration: {service.duration} minutes
                    </p>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="font-bold text-gray-900 text-lg">
                      ₹{service.basePrice}
                    </p>
                    <p className="text-xs text-gray-500">Base Price</p>
                  </div>
                </div>

                {selectedService?.serviceId === service.serviceId && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <CheckCircle className="w-4 h-4" />
                      Selected
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add-ons Selection */}
      {selectedService && selectedService.allowsAddOns && selectedService.addOns && selectedService.addOns.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Available Add-ons
          </h3>

          <div className="space-y-3">
            {selectedService.addOns.map((addOn) => {
              const isSelected = selectedAddOns.has(addOn.addOnId);

              return (
                <div
                  key={addOn.addOnId}
                  onClick={() => toggleAddOn(addOn.addOnId, addOn.price)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-green-600 border-green-600'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {addOn.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {addOn.description}
                        </p>
                      </div>
                    </div>
                    
                    <p className="font-bold text-gray-900 ml-4">
                      +₹{addOn.price}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Requirements Alert */}
      {selectedService && (selectedService.requiresPrescription || selectedService.requiresMedicalRecords) && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-2">
                Requirements for this service:
              </h4>
              <ul className="space-y-1 text-sm text-blue-700">
                {selectedService.requiresPrescription && (
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Valid prescription required
                    {prescriptions.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs ml-2">
                        {prescriptions.length} available
                      </span>
                    )}
                  </li>
                )}
                {selectedService.requiresMedicalRecords && (
                  <li className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Medical records required
                    {medicalRecords.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs ml-2">
                        {medicalRecords.length} available
                      </span>
                    )}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Price Summary */}
      {selectedService && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4">Price Summary</h3>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Base Service</span>
              <span className="font-medium text-gray-900">
                ₹{selectedService.basePrice}
              </span>
            </div>

            {Array.from(selectedAddOns).length > 0 && (
              <>
                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600 mb-2">Add-ons:</p>
                  {Array.from(selectedAddOns).map((addOnId) => {
                    const addOn = selectedService.addOns?.find(a => a.addOnId === addOnId);
                    if (!addOn) return null;

                    return (
                      <div key={addOnId} className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">• {addOn.name}</span>
                        <span className="font-medium text-gray-900">
                          ₹{addOn.price}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-medium text-gray-900">Total Amount</span>
              <span className="text-2xl font-bold text-orange-600">
                ₹{totalPrice}
              </span>
            </div>
          </div>

          <Button
            onClick={handleConfirm}
            className="w-full bg-orange-600 hover:bg-orange-700"
            size="lg"
          >
            Add to Booking
          </Button>
        </div>
      )}
    </div>
  );
}
