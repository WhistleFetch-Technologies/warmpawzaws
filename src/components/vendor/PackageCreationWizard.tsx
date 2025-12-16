import { useState, useEffect } from 'react';
import {
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface PackageData {
  // Step 1: Basic Info
  serviceType: 'grooming' | 'training' | 'walker' | '';
  name: string;
  description: string;
  
  // Step 2: Session Config
  totalSessions: number;
  sessionDuration: number; // minutes
  sessionFrequency: string;
  validityDays: number;
  
  // Step 3: Pricing
  price: number;
  discountPercent: number;
  pricePerSession: number;
  
  // Step 4: Service Details
  serviceStyle: 'home' | 'center' | 'both';
  includes: string[];
  requirements: string[];
  suitableFor: string[];
  
  // Step 5: Special Config
  walkerConfig?: {
    defaultDistance: number;
    routeTracking: boolean;
  };
  trainingConfig?: {
    skillLevel: string;
    certificateProvided: boolean;
  };
  groomingConfig?: {
    services: string[];
    productsIncluded: boolean;
  };
  
  // Step 6: Media
  images: string[];
  thumbnailUrl: string;
}

interface PackageCreationWizardProps {
  vendorId: string;
  onComplete?: (packageId: string) => void;
  onCancel?: () => void;
}

const STEPS = [
  { id: 1, name: 'Basic Info', icon: Package },
  { id: 2, name: 'Sessions', icon: Calendar },
  { id: 3, name: 'Pricing', icon: DollarSign },
  { id: 4, name: 'Details', icon: FileText },
  { id: 5, name: 'Special Config', icon: CheckCircle },
  { id: 6, name: 'Media', icon: ImageIcon }
];

const SERVICE_TYPES = [
  { id: 'grooming', name: 'Grooming Package', color: 'pink', icon: '✨' },
  { id: 'training', name: 'Training Package', color: 'purple', icon: '🎓' },
  { id: 'walker', name: 'Walking Package', color: 'green', icon: '🐕' }
];

const SUITABLE_FOR = ['puppy', 'adult', 'senior', 'all_ages'];
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const GROOMING_SERVICES = [
  'Bath & Dry',
  'Hair Cut',
  'Nail Trim',
  'Ear Cleaning',
  'Teeth Cleaning',
  'De-matting',
  'Flea Treatment'
];

export function PackageCreationWizard({
  vendorId,
  onComplete,
  onCancel
}: PackageCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [packageData, setPackageData] = useState<PackageData>({
    serviceType: '',
    name: '',
    description: '',
    totalSessions: 6,
    sessionDuration: 60,
    sessionFrequency: '2x per week',
    validityDays: 90,
    price: 0,
    discountPercent: 0,
    pricePerSession: 0,
    serviceStyle: 'both',
    includes: [],
    requirements: [],
    suitableFor: [],
    images: [],
    thumbnailUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newInclude, setNewInclude] = useState('');
  const [newRequirement, setNewRequirement] = useState('');

  // Auto-calculate price per session
  useEffect(() => {
    if (packageData.totalSessions > 0) {
      const discountedPrice = packageData.price * (1 - packageData.discountPercent / 100);
      setPackageData(prev => ({
        ...prev,
        pricePerSession: parseFloat((discountedPrice / prev.totalSessions).toFixed(2))
      }));
    }
  }, [packageData.price, packageData.totalSessions, packageData.discountPercent]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!packageData.serviceType) newErrors.serviceType = 'Service type is required';
        if (!packageData.name.trim()) newErrors.name = 'Package name is required';
        if (!packageData.description.trim()) newErrors.description = 'Description is required';
        break;

      case 2:
        if (packageData.totalSessions < 1) newErrors.totalSessions = 'At least 1 session required';
        if (packageData.sessionDuration < 15) newErrors.sessionDuration = 'Minimum 15 minutes';
        if (packageData.validityDays < 1) newErrors.validityDays = 'Validity must be positive';
        break;

      case 3:
        if (packageData.price <= 0) newErrors.price = 'Price must be greater than 0';
        if (packageData.discountPercent < 0 || packageData.discountPercent > 50) {
          newErrors.discountPercent = 'Discount must be 0-50%';
        }
        break;

      case 4:
        if (packageData.includes.length === 0) {
          newErrors.includes = 'Add at least one included item';
        }
        if (packageData.suitableFor.length === 0) {
          newErrors.suitableFor = 'Select suitable ages';
        }
        break;

      case 5:
        // Service-specific validation
        if (packageData.serviceType === 'walker') {
          if (!packageData.walkerConfig?.defaultDistance || packageData.walkerConfig.defaultDistance <= 0) {
            newErrors.walkerConfig = 'Default distance required';
          }
        }
        if (packageData.serviceType === 'training') {
          if (!packageData.trainingConfig?.skillLevel) {
            newErrors.trainingConfig = 'Skill level required';
          }
        }
        if (packageData.serviceType === 'grooming') {
          if (!packageData.groomingConfig?.services || packageData.groomingConfig.services.length === 0) {
            newErrors.groomingConfig = 'Select at least one grooming service';
          }
        }
        break;

      case 6:
        if (packageData.images.length === 0) {
          newErrors.images = 'Add at least one image';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/service-packages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(packageData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('✅ Package created successfully!');
        if (onComplete) onComplete(data.package.id);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create package');
      }
    } catch (error) {
      console.error('Package creation error:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addInclude = () => {
    if (newInclude.trim()) {
      setPackageData(prev => ({
        ...prev,
        includes: [...prev.includes, newInclude.trim()]
      }));
      setNewInclude('');
    }
  };

  const addRequirement = () => {
    if (newRequirement.trim()) {
      setPackageData(prev => ({
        ...prev,
        requirements: [...prev.requirements, newRequirement.trim()]
      }));
      setNewRequirement('');
    }
  };

  const removeInclude = (index: number) => {
    setPackageData(prev => ({
      ...prev,
      includes: prev.includes.filter((_, i) => i !== index)
    }));
  };

  const removeRequirement = (index: number) => {
    setPackageData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const uploadImage = async (file: File) => {
    // Simulate image upload
    toast.info('Image upload integration needed');
    const mockUrl = `https://via.placeholder.com/400x300?text=${encodeURIComponent(file.name)}`;
    
    setPackageData(prev => ({
      ...prev,
      images: [...prev.images, mockUrl],
      thumbnailUrl: prev.thumbnailUrl || mockUrl
    }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Service Type *
              </label>
              <div className="grid grid-cols-3 gap-4">
                {SERVICE_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setPackageData(prev => ({ ...prev, serviceType: type.id as any }))}
                    className={`p-6 border-2 rounded-xl transition-all ${
                      packageData.serviceType === type.id
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-4xl mb-2">{type.icon}</div>
                    <div className="font-semibold text-gray-900">{type.name}</div>
                  </button>
                ))}
              </div>
              {errors.serviceType && (
                <p className="mt-2 text-sm text-red-600">{errors.serviceType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Package Name *
              </label>
              <input
                type="text"
                value={packageData.name}
                onChange={(e) => setPackageData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Premium Grooming Package"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={packageData.description}
                onChange={(e) => setPackageData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what's included in this package..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Total Sessions *
                </label>
                <input
                  type="number"
                  min="1"
                  value={packageData.totalSessions}
                  onChange={(e) => setPackageData(prev => ({ ...prev, totalSessions: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                {errors.totalSessions && <p className="mt-1 text-sm text-red-600">{errors.totalSessions}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Session Duration (minutes) *
                </label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={packageData.sessionDuration}
                  onChange={(e) => setPackageData(prev => ({ ...prev, sessionDuration: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                {errors.sessionDuration && <p className="mt-1 text-sm text-red-600">{errors.sessionDuration}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Session Frequency
              </label>
              <select
                value={packageData.sessionFrequency}
                onChange={(e) => setPackageData(prev => ({ ...prev, sessionFrequency: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="1x per week">Once per week</option>
                <option value="2x per week">Twice per week</option>
                <option value="3x per week">3 times per week</option>
                <option value="Daily">Daily</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Package Validity (days) *
              </label>
              <input
                type="number"
                min="1"
                value={packageData.validityDays}
                onChange={(e) => setPackageData(prev => ({ ...prev, validityDays: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <p className="mt-1 text-sm text-gray-600">
                Customer must complete all sessions within this period
              </p>
              {errors.validityDays && <p className="mt-1 text-sm text-red-600">{errors.validityDays}</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Total Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={packageData.price}
                  onChange={(e) => setPackageData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={packageData.discountPercent}
                  onChange={(e) => setPackageData(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
                {errors.discountPercent && <p className="mt-1 text-sm text-red-600">{errors.discountPercent}</p>}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Pricing Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Price:</span>
                  <span className="font-semibold">₹{packageData.price.toFixed(2)}</span>
                </div>
                {packageData.discountPercent > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({packageData.discountPercent}%):</span>
                      <span className="font-semibold">
                        -₹{(packageData.price * packageData.discountPercent / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold">Final Price:</span>
                      <span className="font-bold text-xl text-green-700">
                        ₹{(packageData.price * (1 - packageData.discountPercent / 100)).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Price per Session:</span>
                  <span className="font-semibold text-orange-600">
                    ₹{packageData.pricePerSession.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sessions:</span>
                  <span className="font-semibold">{packageData.totalSessions}</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Service Style
              </label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'home', label: 'Home Service', icon: '🏠' },
                  { value: 'center', label: 'At Center', icon: '🏢' },
                  { value: 'both', label: 'Both Options', icon: '🔄' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setPackageData(prev => ({ ...prev, serviceStyle: option.value as any }))}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      packageData.serviceStyle === option.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.icon}</div>
                    <div className="text-sm font-semibold">{option.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                What's Included *
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newInclude}
                  onChange={(e) => setNewInclude(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInclude())}
                  placeholder="e.g., Equipment provided"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <Button onClick={addInclude} className="bg-green-600">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {packageData.includes.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{item}</span>
                    <button onClick={() => removeInclude(index)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {errors.includes && <p className="mt-2 text-sm text-red-600">{errors.includes}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Requirements
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newRequirement}
                  onChange={(e) => setNewRequirement(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                  placeholder="e.g., Vaccinated pets only"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <Button onClick={addRequirement} className="bg-green-600">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {packageData.requirements.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{item}</span>
                    <button onClick={() => removeRequirement(index)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Suitable For *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SUITABLE_FOR.map(age => (
                  <button
                    key={age}
                    onClick={() => {
                      setPackageData(prev => ({
                        ...prev,
                        suitableFor: prev.suitableFor.includes(age)
                          ? prev.suitableFor.filter(a => a !== age)
                          : [...prev.suitableFor, age]
                      }));
                    }}
                    className={`p-3 border-2 rounded-lg capitalize transition-all ${
                      packageData.suitableFor.includes(age)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200'
                    }`}
                  >
                    {age.replace('_', ' ')}
                  </button>
                ))}
              </div>
              {errors.suitableFor && <p className="mt-2 text-sm text-red-600">{errors.suitableFor}</p>}
            </div>
          </div>
        );

      case 5:
        // Service-specific configuration
        if (packageData.serviceType === 'walker') {
          return (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Walker Package Configuration</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Default Walk Distance (km) *
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={packageData.walkerConfig?.defaultDistance || 1.5}
                  onChange={(e) => setPackageData(prev => ({
                    ...prev,
                    walkerConfig: {
                      ...prev.walkerConfig,
                      defaultDistance: parseFloat(e.target.value) || 1.5,
                      routeTracking: prev.walkerConfig?.routeTracking ?? true
                    }
                  }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                />
                {errors.walkerConfig && <p className="mt-1 text-sm text-red-600">{errors.walkerConfig}</p>}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="routeTracking"
                  checked={packageData.walkerConfig?.routeTracking ?? true}
                  onChange={(e) => setPackageData(prev => ({
                    ...prev,
                    walkerConfig: {
                      ...prev.walkerConfig,
                      defaultDistance: prev.walkerConfig?.defaultDistance || 1.5,
                      routeTracking: e.target.checked
                    }
                  }))}
                  className="w-5 h-5"
                />
                <label htmlFor="routeTracking" className="text-sm font-medium text-gray-700">
                  Enable GPS route tracking for walks
                </label>
              </div>
            </div>
          );
        } else if (packageData.serviceType === 'training') {
          return (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Training Package Configuration</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Skill Level *
                </label>
                <select
                  value={packageData.trainingConfig?.skillLevel || ''}
                  onChange={(e) => setPackageData(prev => ({
                    ...prev,
                    trainingConfig: {
                      ...prev.trainingConfig,
                      skillLevel: e.target.value,
                      certificateProvided: prev.trainingConfig?.certificateProvided ?? false
                    }
                  }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                >
                  <option value="">Select skill level</option>
                  {SKILL_LEVELS.map(level => (
                    <option key={level} value={level} className="capitalize">
                      {level}
                    </option>
                  ))}
                </select>
                {errors.trainingConfig && <p className="mt-1 text-sm text-red-600">{errors.trainingConfig}</p>}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="certificate"
                  checked={packageData.trainingConfig?.certificateProvided ?? false}
                  onChange={(e) => setPackageData(prev => ({
                    ...prev,
                    trainingConfig: {
                      ...prev.trainingConfig,
                      skillLevel: prev.trainingConfig?.skillLevel || 'beginner',
                      certificateProvided: e.target.checked
                    }
                  }))}
                  className="w-5 h-5"
                />
                <label htmlFor="certificate" className="text-sm font-medium text-gray-700">
                  Certificate provided upon completion
                </label>
              </div>
            </div>
          );
        } else if (packageData.serviceType === 'grooming') {
          return (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Grooming Package Configuration</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Grooming Services Included *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {GROOMING_SERVICES.map(service => (
                    <button
                      key={service}
                      onClick={() => {
                        setPackageData(prev => ({
                          ...prev,
                          groomingConfig: {
                            ...prev.groomingConfig,
                            services: prev.groomingConfig?.services?.includes(service)
                              ? prev.groomingConfig.services.filter(s => s !== service)
                              : [...(prev.groomingConfig?.services || []), service],
                            productsIncluded: prev.groomingConfig?.productsIncluded ?? false
                          }
                        }));
                      }}
                      className={`p-3 border-2 rounded-lg text-left transition-all ${
                        packageData.groomingConfig?.services?.includes(service)
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-gray-200'
                      }`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
                {errors.groomingConfig && <p className="mt-2 text-sm text-red-600">{errors.groomingConfig}</p>}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="products"
                  checked={packageData.groomingConfig?.productsIncluded ?? false}
                  onChange={(e) => setPackageData(prev => ({
                    ...prev,
                    groomingConfig: {
                      ...prev.groomingConfig,
                      services: prev.groomingConfig?.services || [],
                      productsIncluded: e.target.checked
                    }
                  }))}
                  className="w-5 h-5"
                />
                <label htmlFor="products" className="text-sm font-medium text-gray-700">
                  Premium grooming products included
                </label>
              </div>
            </div>
          );
        }
        
        return (
          <div className="text-center py-12 text-gray-500">
            No special configuration needed for this service type
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Package Images *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      Array.from(e.target.files).forEach(uploadImage);
                    }
                  }}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to 5MB
                  </p>
                </label>
              </div>
              {errors.images && <p className="mt-2 text-sm text-red-600">{errors.images}</p>}
            </div>

            {packageData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {packageData.images.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Package ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setPackageData(prev => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== index)
                      }))}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {url === packageData.thumbnailUrl && (
                      <Badge className="absolute bottom-2 left-2 bg-green-600">
                        Thumbnail
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Package</h1>
          <p className="text-gray-600">Follow the steps to create a comprehensive service package</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-orange-600 text-white'
                          : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'font-semibold' : ''}`}>
                      {step.name}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Card */}
        <Card className="p-8 shadow-xl">
          {renderStepContent()}
        </Card>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            onClick={onCancel}
            variant="outline"
            className="border-gray-300"
          >
            Cancel
          </Button>

          <div className="flex gap-4">
            {currentStep > 1 && (
              <Button onClick={handleBack} variant="outline">
                <ChevronLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
            )}

            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} className="bg-orange-600">
                Next
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-gradient-to-r from-orange-500 to-pink-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Create Package
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
