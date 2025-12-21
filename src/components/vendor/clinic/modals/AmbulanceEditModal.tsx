import { useState, useEffect } from 'react';
import { X, Ambulance, Save } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { toast } from 'sonner@2.0.3';

interface AmbulanceService {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  basePrice: number;
  pricePerKm: number;
  availability: 'available' | 'busy' | 'offline';
  currentLocation?: string;
}

interface AmbulanceEditModalProps {
  ambulance: AmbulanceService | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<AmbulanceService>) => Promise<void>;
}

export function AmbulanceEditModal({ 
  ambulance, 
  isOpen, 
  onClose, 
  onSave 
}: AmbulanceEditModalProps) {
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    basePrice: 0,
    pricePerKm: 0,
    availability: 'available' as 'available' | 'busy' | 'offline',
    currentLocation: ''
  });
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens or ambulance changes
  useEffect(() => {
    if (isOpen) {
      if (ambulance) {
        setFormData({
          vehicleNumber: ambulance.vehicleNumber,
          driverName: ambulance.driverName,
          driverPhone: ambulance.driverPhone,
          basePrice: ambulance.basePrice,
          pricePerKm: ambulance.pricePerKm,
          availability: ambulance.availability,
          currentLocation: ambulance.currentLocation || ''
        });
      } else {
        // Reset for new ambulance
        setFormData({
          vehicleNumber: '',
          driverName: '',
          driverPhone: '',
          basePrice: 500,
          pricePerKm: 15,
          availability: 'available',
          currentLocation: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, ambulance]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Vehicle number validation
    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = 'Vehicle number is required';
    } else if (formData.vehicleNumber.trim().length < 3) {
      newErrors.vehicleNumber = 'Vehicle number must be at least 3 characters';
    } else if (formData.vehicleNumber.trim().length > 20) {
      newErrors.vehicleNumber = 'Vehicle number must be less than 20 characters';
    }

    // Driver name validation
    if (!formData.driverName.trim()) {
      newErrors.driverName = 'Driver name is required';
    } else if (formData.driverName.trim().length < 2) {
      newErrors.driverName = 'Driver name must be at least 2 characters';
    } else if (formData.driverName.trim().length > 50) {
      newErrors.driverName = 'Driver name must be less than 50 characters';
    } else if (!/^[a-zA-Z\s\.\-']+$/.test(formData.driverName.trim())) {
      newErrors.driverName = 'Driver name can only contain letters, spaces, dots, hyphens, and apostrophes';
    }

    // Driver phone validation
    if (!formData.driverPhone.trim()) {
      newErrors.driverPhone = 'Driver phone is required';
    } else {
      const phoneRegex = /^[\d\s\-\+\(\)]{10,15}$/;
      const cleanPhone = formData.driverPhone.replace(/[\s\-\+\(\)]/g, '');
      if (!phoneRegex.test(formData.driverPhone)) {
        newErrors.driverPhone = 'Invalid phone number format';
      } else if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        newErrors.driverPhone = 'Phone number must be between 10 and 15 digits';
      }
    }

    // Base price validation
    if (formData.basePrice <= 0) {
      newErrors.basePrice = 'Base price must be greater than 0';
    } else if (formData.basePrice > 10000) {
      newErrors.basePrice = 'Base price cannot exceed ₹10,000';
    }

    // Price per KM validation
    if (formData.pricePerKm <= 0) {
      newErrors.pricePerKm = 'Price per KM must be greater than 0';
    } else if (formData.pricePerKm > 100) {
      newErrors.pricePerKm = 'Price per KM cannot exceed ₹100';
    }

    // Current location validation (optional but if provided, should be reasonable)
    if (formData.currentLocation && formData.currentLocation.length > 100) {
      newErrors.currentLocation = 'Location must be less than 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      toast.success(ambulance ? 'Ambulance updated successfully' : 'Ambulance added successfully');
      onClose();
    } catch (error: any) {
      console.error('Error saving ambulance:', error);
      const errorMessage = error?.message || 'Failed to save ambulance. Please try again.';
      toast.error(errorMessage);
      // Don't close modal on error so user can fix and retry
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Ambulance className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">
                {ambulance ? 'Edit Ambulance' : 'Add Ambulance'}
              </h2>
              <p className="text-xs opacity-90">Emergency service details</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Vehicle Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value})}
              placeholder="e.g., DL-01-AB-1234"
              className={errors.vehicleNumber ? 'border-red-500' : ''}
              disabled={saving}
            />
            {errors.vehicleNumber && (
              <p className="text-xs text-red-500 mt-1">{errors.vehicleNumber}</p>
            )}
          </div>

          {/* Driver Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.driverName}
              onChange={(e) => setFormData({...formData, driverName: e.target.value})}
              placeholder="e.g., John Doe"
              className={errors.driverName ? 'border-red-500' : ''}
              disabled={saving}
            />
            {errors.driverName && (
              <p className="text-xs text-red-500 mt-1">{errors.driverName}</p>
            )}
          </div>

          {/* Driver Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Phone <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.driverPhone}
              onChange={(e) => setFormData({...formData, driverPhone: e.target.value})}
              placeholder="e.g., +91 9876543210"
              className={errors.driverPhone ? 'border-red-500' : ''}
              disabled={saving}
            />
            {errors.driverPhone && (
              <p className="text-xs text-red-500 mt-1">{errors.driverPhone}</p>
            )}
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.basePrice}
                onChange={(e) => setFormData({...formData, basePrice: parseFloat(e.target.value) || 0})}
                min="0"
                step="50"
                className={errors.basePrice ? 'border-red-500' : ''}
                disabled={saving}
              />
              {errors.basePrice && (
                <p className="text-xs text-red-500 mt-1">{errors.basePrice}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price/KM (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.pricePerKm}
                onChange={(e) => setFormData({...formData, pricePerKm: parseFloat(e.target.value) || 0})}
                min="0"
                step="5"
                className={errors.pricePerKm ? 'border-red-500' : ''}
                disabled={saving}
              />
              {errors.pricePerKm && (
                <p className="text-xs text-red-500 mt-1">{errors.pricePerKm}</p>
              )}
            </div>
          </div>

          {/* Availability Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Availability Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.availability}
              onChange={(e) => setFormData({...formData, availability: e.target.value as any})}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={saving}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {/* Current Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Location <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <Input
              value={formData.currentLocation}
              onChange={(e) => setFormData({...formData, currentLocation: e.target.value})}
              placeholder="e.g., Sector 12, Gurgaon"
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">Where is the ambulance currently located?</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {ambulance ? 'Update' : 'Add'} Ambulance
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
