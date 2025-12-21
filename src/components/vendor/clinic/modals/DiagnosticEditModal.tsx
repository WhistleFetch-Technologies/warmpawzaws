import { useState, useEffect } from 'react';
import { X, Microscope, Save } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { toast } from 'sonner@2.0.3';

interface DiagnosticTest {
  id: string;
  testName: string;
  category: 'blood' | 'urine' | 'xray' | 'ultrasound' | 'other';
  price: number;
  duration: number;
  requiresFasting: boolean;
  description: string;
  isActive: boolean;
}

interface DiagnosticEditModalProps {
  diagnostic: DiagnosticTest | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<DiagnosticTest>) => Promise<void>;
}

export function DiagnosticEditModal({ 
  diagnostic, 
  isOpen, 
  onClose, 
  onSave 
}: DiagnosticEditModalProps) {
  const [formData, setFormData] = useState({
    testName: '',
    category: 'blood' as 'blood' | 'urine' | 'xray' | 'ultrasound' | 'other',
    price: 0,
    duration: 30,
    requiresFasting: false,
    description: '',
    isActive: true
  });
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (diagnostic) {
        setFormData({
          testName: diagnostic.testName,
          category: diagnostic.category,
          price: diagnostic.price,
          duration: diagnostic.duration,
          requiresFasting: diagnostic.requiresFasting,
          description: diagnostic.description,
          isActive: diagnostic.isActive
        });
      } else {
        // Reset for new test
        setFormData({
          testName: '',
          category: 'blood',
          price: 500,
          duration: 30,
          requiresFasting: false,
          description: '',
          isActive: true
        });
      }
      setErrors({});
    }
  }, [isOpen, diagnostic]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Test name validation
    if (!formData.testName.trim()) {
      newErrors.testName = 'Test name is required';
    } else if (formData.testName.trim().length < 3) {
      newErrors.testName = 'Test name must be at least 3 characters';
    } else if (formData.testName.trim().length > 100) {
      newErrors.testName = 'Test name must be less than 100 characters';
    }

    // Price validation
    if (formData.price <= 0) {
      newErrors.price = 'Price must be greater than 0';
    } else if (formData.price > 100000) {
      newErrors.price = 'Price cannot exceed ₹1,00,000';
    }

    // Duration validation
    if (formData.duration <= 0) {
      newErrors.duration = 'Duration must be greater than 0';
    } else if (formData.duration > 1440) {
      newErrors.duration = 'Duration cannot exceed 1440 minutes (24 hours)';
    }

    // Description validation (optional but if provided, should be reasonable)
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
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
      toast.success(diagnostic ? 'Diagnostic test updated successfully' : 'Diagnostic test added successfully');
      onClose();
    } catch (error: any) {
      console.error('Error saving diagnostic test:', error);
      const errorMessage = error?.message || 'Failed to save diagnostic test. Please try again.';
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
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Microscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">
                {diagnostic ? 'Edit Diagnostic Test' : 'Add Diagnostic Test'}
              </h2>
              <p className="text-xs opacity-90">Laboratory test details</p>
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
          {/* Test Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.testName}
              onChange={(e) => setFormData({...formData, testName: e.target.value})}
              placeholder="e.g., Complete Blood Count (CBC)"
              className={errors.testName ? 'border-red-500' : ''}
              disabled={saving}
            />
            {errors.testName && (
              <p className="text-xs text-red-500 mt-1">{errors.testName}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value as any})}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={saving}
            >
              <option value="blood">Blood Test</option>
              <option value="urine">Urine Test</option>
              <option value="xray">X-Ray</option>
              <option value="ultrasound">Ultrasound</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Price and Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (₹) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                min="0"
                step="50"
                className={errors.price ? 'border-red-500' : ''}
                disabled={saving}
              />
              {errors.price && (
                <p className="text-xs text-red-500 mt-1">{errors.price}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (mins) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value) || 0})}
                min="0"
                step="5"
                className={errors.duration ? 'border-red-500' : ''}
                disabled={saving}
              />
              {errors.duration && (
                <p className="text-xs text-red-500 mt-1">{errors.duration}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe what this test is for and any special instructions..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={saving}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresFasting}
                onChange={(e) => setFormData({...formData, requiresFasting: e.target.checked})}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={saving}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Requires Fasting</span>
                <p className="text-xs text-gray-500">Patient must fast before this test</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={saving}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Active</span>
                <p className="text-xs text-gray-500">Test is available for booking</p>
              </div>
            </label>
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
              className="flex-1 bg-blue-600 hover:bg-blue-700"
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
                  {diagnostic ? 'Update' : 'Add'} Test
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
