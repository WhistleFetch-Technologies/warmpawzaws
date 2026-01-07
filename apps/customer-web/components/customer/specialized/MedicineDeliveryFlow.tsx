'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Pill, FileText, MapPin, Clock, Upload } from 'lucide-react';

interface MedicineDeliveryFlowProps {
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

interface Medicine {
  id: string;
  name: string;
  brand?: string;
  dosage?: string;
  quantity: number;
  price: number;
  prescription_required: boolean;
  in_stock: boolean;
}

export function MedicineDeliveryFlow({ vendorId, customerPhone, onSuccess, onCancel }: MedicineDeliveryFlowProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedicines, setSelectedMedicines] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Booking details
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const [hasPrescription, setHasPrescription] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadMedicines();
  }, [vendorId]);

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/pharmacy/medicines`);
      
      if (response.success && response.medicines) {
        setMedicines(response.medicines.filter((m: Medicine) => m.in_stock));
      }
    } catch (err: any) {
      console.error('Error loading medicines:', err);
      setError('Failed to load medicines');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (medicineId: string, quantity: number) => {
    if (quantity <= 0) {
      const newSelected = { ...selectedMedicines };
      delete newSelected[medicineId];
      setSelectedMedicines(newSelected);
    } else {
      setSelectedMedicines(prev => ({ ...prev, [medicineId]: quantity }));
    }
  };

  const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Prescription file size should be less than 5MB');
      return;
    }

    setPrescriptionFile(file);
    
    try {
      // Upload prescription
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'prescription');
      
      // API client automatically handles FormData (no Content-Type header needed)
      const uploadResponse = await apiClient.post<any>('/file-upload/prescription', formData);

      if (uploadResponse.success) {
        setPrescriptionUploaded(true);
      }
    } catch (err: any) {
      console.error('Error uploading prescription:', err);
      setError('Failed to upload prescription');
    }
  };

  const getTotalPrice = () => {
    return Object.entries(selectedMedicines).reduce((total, [medicineId, quantity]) => {
      const medicine = medicines.find(m => m.id === medicineId);
      return total + (medicine?.price || 0) * quantity;
    }, 0);
  };

  const requiresPrescription = () => {
    return Object.keys(selectedMedicines).some(id => {
      const medicine = medicines.find(m => m.id === id);
      return medicine?.prescription_required;
    });
  };

  const filteredMedicines = medicines.filter(medicine =>
    medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    medicine.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Object.keys(selectedMedicines).length === 0) {
      setError('Please select at least one medicine');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError('Delivery address is required');
      return;
    }

    if (!deliveryDate || !deliveryTime) {
      setError('Please select delivery date and time');
      return;
    }

    if (requiresPrescription() && !prescriptionUploaded) {
      setError('Prescription is required for selected medicines');
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

      const selectedMedicineDetails = Object.entries(selectedMedicines).map(([id, qty]) => {
        const medicine = medicines.find(m => m.id === id);
        return {
          id: medicine?.id,
          name: medicine?.name,
          brand: medicine?.brand,
          dosage: medicine?.dosage,
          quantity: qty,
          price: medicine?.price,
        };
      });

      const bookingData = {
        serviceId: 'pharmacy',
        vendorId,
        customerId,
        serviceType: 'at_home',
        bookingType: 'scheduled',
        bookingDate: deliveryDate,
        bookingTime: deliveryTime,
        address: deliveryAddress,
        notes: JSON.stringify({
          medicines: selectedMedicineDetails,
          patientName,
          hasPrescription: prescriptionUploaded,
          prescriptionFile: prescriptionFile?.name,
          notes,
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
      setError(err.message || 'Failed to place order');
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
      <h2 className="text-2xl font-bold text-gray-900 mb-0">Order Medicines</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Search */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search medicines..."
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Medicine Selection */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Select Medicines</h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {filteredMedicines.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No medicines found
              </div>
            ) : (
              filteredMedicines.map((medicine) => {
                const quantity = selectedMedicines[medicine.id] || 0;
                return (
                  <div
                    key={medicine.id}
                    className={`p-4 ${quantity > 0 ? 'bg-orange-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-0">
                          <Pill className="text-orange-500" size={18} />
                          <span className="font-semibold text-gray-900">{medicine.name}</span>
                          {medicine.prescription_required && (
                            <span className="px-0 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              Rx Required
                            </span>
                          )}
                        </div>
                        {medicine.brand && (
                          <span className="text-sm text-gray-500 mt-0 block">Brand: {medicine.brand}</span>
                        )}
                        {medicine.dosage && (
                          <span className="text-sm text-gray-500">Dosage: {medicine.dosage}</span>
                        )}
                      </div>
                      <div className="ml-4 flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-orange-600">₹{medicine.price}</p>
                          {quantity > 0 && (
                            <p className="text-sm text-gray-500">× {quantity} = ₹{medicine.price * quantity}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(medicine.id, quantity - 1)}
                            disabled={quantity === 0}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-medium">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(medicine.id, quantity + 1)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Medicines Summary */}
        {Object.keys(selectedMedicines).length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {Object.values(selectedMedicines).reduce((a, b) => a + b, 0)} item(s) selected
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-600">₹{getTotalPrice()}</p>
            </div>
          </div>
        )}

        {/* Prescription Upload */}
        {requiresPrescription() && (
          <div className="bg-white rounded-xl p-0 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-0">
              <FileText className="text-orange-500" size={20} />
              Prescription Required
            </h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-0 text-center">
              <Upload className="mx-auto text-gray-400 mb-0" size={32} />
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handlePrescriptionUpload}
                className="hidden"
                id="prescription-upload"
              />
              <label
                htmlFor="prescription-upload"
                className="cursor-pointer text-orange-600 hover:text-orange-700 font-medium"
              >
                {prescriptionUploaded ? '✓ Prescription Uploaded' : 'Upload Prescription'}
              </label>
              {prescriptionFile && (
                <p className="text-sm text-gray-500 mt-0">{prescriptionFile.name}</p>
              )}
              <p className="text-xs text-gray-400 mt-0">Max file size: 5MB</p>
            </div>
          </div>
        )}

        {/* Delivery Details */}
        <div className="bg-white rounded-xl p-1 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900 mb-4">Delivery Details</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Patient Name
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientName(e.target.value)}
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              <MapPin className="inline mr-0" size={16} />
              Delivery Address *
            </label>
            <textarea
              value={deliveryAddress}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDeliveryAddress(e.target.value)}
              required
              rows={3}
              placeholder="Enter complete delivery address"
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                <Clock className="inline mr-0" size={16} />
                Delivery Date *
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Delivery Time *
              </label>
              <input
                type="time"
                value={deliveryTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeliveryTime(e.target.value)}
                required
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions..."
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
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
            disabled={processing || Object.keys(selectedMedicines).length === 0}
            className="flex-1 px-0 py-0 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {processing ? 'Placing Order...' : `Place Order - ₹${getTotalPrice()}`}
          </button>
        </div>
      </form>
    </div>
  );
}

