'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, MapPin, AlertCircle, CheckCircle2, X } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file' | 'map_pin';
  section: string;
  placeholder?: string;
  helpText?: string;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  options?: { value: string; label: string }[];
  requiresDocument?: boolean;
  documentType?: string;
  documentLabel?: string;
  acceptedFileTypes?: string[];
  order: number;
  isActive: boolean;
}

interface FormSection {
  id: string;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  fields: FormField[];
}

interface OnboardingForm {
  id: string;
  roleId: string;
  roleName: string;
  version: number;
  status: string;
  sections: FormSection[];
  documentSections: FormSection[];
}

interface DynamicVendorOnboardingFormProps {
  roleId: string;
  onSubmit: (data: any) => void;
  onBack?: () => void;
  serviceStyles?: string[];
  initialData?: any;
  vendorId?: string;
  isEditMode?: boolean;
}

export function DynamicVendorOnboardingForm({ 
  roleId, 
  onSubmit, 
  onBack,
  serviceStyles = [],
  initialData,
  vendorId,
  isEditMode
}: DynamicVendorOnboardingFormProps) {
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [documents, setDocuments] = useState<Record<string, File | null>>({});
  const [documentPreviews, setDocumentPreviews] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [availableSpecializations, setAvailableSpecializations] = useState<any[]>([]);
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);

  useEffect(() => {
    if (initialData) {
      if (initialData.formData) {
        setFormData(prev => ({ ...prev, ...initialData.formData }));
      }
      if (initialData.location) {
        setCoordinates(initialData.location);
      }
      if (initialData.specializations) {
        setSelectedSpecializations(initialData.specializations);
      }
    }
    fetchForm();
    loadSpecializations();
  }, [roleId]);

  const loadSpecializations = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/problem-grid-specializations/${roleId}`);
      if (response.specializations) {
        setAvailableSpecializations(response.specializations);
      }
    } catch (error) {
      console.error('Error loading specializations:', error);
    }
  };

  const fetchForm = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/onboarding-form/${roleId}`);
      if (response.form) {
        setForm(response.form);
      }
    } catch (error) {
      console.error('Error fetching form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileUpload = (fieldName: string, file: File) => {
    setDocuments(prev => ({ ...prev, [fieldName]: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocumentPreviews(prev => ({ ...prev, [fieldName]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!form) return false;

    const allFields = [...form.sections, ...form.documentSections]
      .flatMap(section => section.fields)
      .filter(field => field.isActive);

    allFields.forEach(field => {
      const value = formData[field.name];
      const validation = field.validation;

      if (validation?.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        newErrors[field.name] = `${field.label} is required`;
      }

      if (value && validation?.minLength && value.length < validation.minLength) {
        newErrors[field.name] = `${field.label} must be at least ${validation.minLength} characters`;
      }

      if (value && validation?.maxLength && value.length > validation.maxLength) {
        newErrors[field.name] = `${field.label} must be no more than ${validation.maxLength} characters`;
      }

      if (field.type === 'file' && validation?.required && !documents[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!agreedToTerms) {
      setErrors({ terms: 'You must agree to the terms and conditions' });
      return;
    }

    setSubmitting(true);

    try {
      // Upload documents
      const uploadedDocuments: Record<string, string> = {};
      
      for (const [key, file] of Object.entries(documents)) {
        if (file) {
          try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('documentType', key);
            
            // Use fetch directly for file uploads
            const baseUrl = apiClient['baseUrl'] || '';
            const token = apiClient['getAuthToken']?.() || '';
            
            const uploadResponse = await fetch(`${baseUrl}/vendor/upload-document`, {
              method: 'POST',
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              body: uploadFormData
            });
            
            if (uploadResponse.ok) {
              const uploadData = await uploadResponse.json();
              if (uploadData.url) {
                uploadedDocuments[key] = uploadData.url;
              }
            }
          } catch (error) {
            console.error(`Error uploading ${key}:`, error);
          }
        }
      }

      const submissionData = {
        roleId,
        formData: {
          ...formData,
          coordinates,
          location: coordinates,
        },
        documents: uploadedDocuments,
        serviceStyles,
        location: coordinates,
        specializations: selectedSpecializations,
        agreedToTerms,
        formVersion: form?.version,
        vendorId,
        isEditMode,
      };

      await onSubmit(submissionData);
    } catch (error) {
      console.error('Submission error:', error);
      setErrors({ submit: 'Failed to submit form. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const commonClasses = `w-full rounded-xl border ${
      error ? 'border-red-300' : 'border-gray-200'
    } px-4 py-0 text-gray-800 focus:border-primary focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-gray-400 bg-white`;

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={`${commonClasses} min-h-[100px] resize-none`}
            rows={3}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
          >
            <option value="">{field.placeholder || `Select ${field.label}`}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.name, e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label className="text-sm font-medium text-gray-700">{field.label}</label>
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.name, e.target.value)}
            className={commonClasses}
          />
        );

      case 'file':
        return (
          <div className="mt-0">
            {documentPreviews[field.name] ? (
              <div className="relative group overflow-hidden rounded-xl border border-gray-200">
                <img 
                  src={documentPreviews[field.name]} 
                  alt={field.label}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setDocuments({ ...documents, [field.name]: null });
                      setDocumentPreviews({ ...documentPreviews, [field.name]: '' });
                    }}
                    className="bg-white/20 backdrop-blur-md border border-white/50 text-white rounded-full p-0 hover:bg-white/40"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-0 right-3 bg-green-500 text-white px-0 py-0 rounded-full text-xs font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Uploaded
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-orange-50/50 transition-all">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-0">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Tap to upload document</span>
                <span className="text-xs text-gray-400 mt-0">{field.documentLabel || field.label}</span>
                <input
                  type="file"
                  accept={field.acceptedFileTypes?.join(',') || 'image/*'}
                  className="hidden"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(field.name, file);
                  }}
                />
              </label>
            )}
          </div>
        );

      case 'map_pin':
        return (
          <div className="space-y-4 mt-0">
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((position) => {
                    const pos = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    };
                    setCoordinates(pos);
                  });
                }
              }}
              className="w-full py-0 bg-white border-2 border-primary text-primary rounded-xl font-bold flex items-center justify-center gap-0"
            >
              <MapPin className="w-5 h-5" />
              <span>Detect Location</span>
            </button>
            <div className="w-full h-64 rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
              <p className="text-gray-500 text-sm">Map integration will be available in production</p>
            </div>
            {coordinates && (
              <p className="text-xs text-gray-600">
                Location: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </p>
            )}
          </div>
        );

      default:
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Form not found</p>
          {onBack && (
            <button onClick={onBack} className="text-primary hover:underline">
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const allSections = [...form.sections, ...form.documentSections].filter(s => s.isActive).sort((a, b) => a.order - b.order);
  const currentSectionData = allSections[currentSection];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-0 py-4 flex items-center gap-0">
          {onBack && (
            <button onClick={onBack} className="p-0 -ml-0 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="font-bold text-lg">{form.roleName} Registration</h1>
            <p className="text-sm text-gray-600">
              Step {currentSection + 1} of {allSections.length}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-0 pb-4">
          <div className="flex gap-0">
            {allSections.map((_, index) => (
              <div
                key={index}
                className={`flex-1 h-2 rounded-full ${
                  index <= currentSection ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-0 space-y-6">
        {/* Section Title */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-0">{currentSectionData.title}</h2>
          {currentSectionData.description && (
            <p className="text-gray-600">{currentSectionData.description}</p>
          )}
        </div>

        {/* Fields */}
        {currentSectionData.fields
          .filter(field => field.isActive)
          .sort((a, b) => a.order - b.order)
          .map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                {field.label}
                {field.validation?.required && <span className="text-red-500 ml-0">*</span>}
              </label>
              {renderField(field)}
              {field.helpText && (
                <p className="text-xs text-gray-500 mt-0">{field.helpText}</p>
              )}
              {errors[field.name] && (
                <p className="text-xs text-red-500 mt-0">{errors[field.name]}</p>
              )}
            </div>
          ))}

        {/* Specializations (if available) */}
        {availableSpecializations.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Specializations
            </label>
            <div className="grid grid-cols-2 gap-0">
              {availableSpecializations.map((spec) => (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => {
                    setSelectedSpecializations(prev =>
                      prev.includes(spec.id)
                        ? prev.filter(id => id !== spec.id)
                        : [...prev, spec.id]
                    );
                  }}
                  className={`p-0 rounded-xl border-2 transition-all ${
                    selectedSpecializations.includes(spec.id)
                      ? 'border-primary bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-0">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedSpecializations.includes(spec.id)
                        ? 'bg-primary border-primary'
                        : 'border-gray-300'
                    }`}>
                      {selectedSpecializations.includes(spec.id) && (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="text-sm">{spec.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-0 pt-4">
          {currentSection > 0 && (
            <button
              type="button"
              onClick={() => setCurrentSection(currentSection - 1)}
              className="flex-1 py-0 px-4 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
            >
              Previous
            </button>
          )}
          {currentSection < allSections.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentSection(currentSection + 1)}
              className="flex-1 py-0 px-4 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark"
            >
              Next
            </button>
          ) : (
            <>
              <div className="flex-1">
                <label className="flex items-center gap-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgreedToTerms(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the terms and conditions
                  </span>
                </label>
                {errors.terms && (
                  <p className="text-xs text-red-500 mt-0">{errors.terms}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-0 px-4 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </>
          )}
        </div>

        {errors.submit && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {errors.submit}
          </div>
        )}
      </form>
    </div>
  );
}

