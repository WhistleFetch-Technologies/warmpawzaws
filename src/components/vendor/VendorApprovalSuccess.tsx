import { useState, useEffect } from 'react';
import { Check, MapPin, Plus, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorApprovalSuccessProps {
  vendorId: string;
  vendorType: string;
  serviceStyle: 'at_home' | 'at_center' | 'both';
  onSetupComplete: () => void;
}

interface CatalogService {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  categoryName: string;
  subCategoryName: string;
}

interface CustomService {
  name: string;
  description: string;
  duration: number;
  price: number;
}

export function VendorApprovalSuccess({ vendorId, vendorType, serviceStyle, onSetupComplete }: VendorApprovalSuccessProps) {
  const [step, setStep] = useState<'welcome' | 'area' | 'services'>('welcome');
  const [serviceRadius, setServiceRadius] = useState(2);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [enabledServices, setEnabledServices] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [newService, setNewService] = useState<CustomService>({
    name: '',
    description: '',
    duration: 30,
    price: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 'services' && (serviceStyle === 'at_home' || serviceStyle === 'both')) {
      loadCatalogServices();
    }
  }, [step]);

  const loadCatalogServices = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/catalog/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCatalogServices(data.services || []);
      }
    } catch (error) {
      console.error('Error loading catalog services:', error);
    }
  };

  const toggleService = async (serviceId: string) => {
    const isEnabled = enabledServices.includes(serviceId);
    
    try {
      const endpoint = isEnabled ? 'disable' : 'enable';
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ vendorId, serviceId })
        }
      );

      if (response.ok) {
        if (isEnabled) {
          setEnabledServices(enabledServices.filter(id => id !== serviceId));
        } else {
          setEnabledServices([...enabledServices, serviceId]);
        }
      }
    } catch (error) {
      console.error('Error toggling service:', error);
      toast.error('Failed to update service');
    }
  };

  const handleCreateCustomService = async () => {
    if (!newService.name || !newService.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            vendorId,
            ...newService
          })
        }
      );

      if (response.ok) {
        setCustomServices([...customServices, newService]);
        setNewService({ name: '', description: '', duration: 30, price: 0 });
        setIsCreatingService(false);
        toast.success('Service created successfully!');
      } else {
        toast.error('Failed to create service');
      }
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error('Error creating service');
    }
  };

  const handleCompleteSetup = async () => {
    const totalServices = enabledServices.length + customServices.length;
    
    if (totalServices === 0) {
      toast.error('Please select or create at least one service');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/setup/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ vendorId })
        }
      );

      if (response.ok) {
        toast.success('Setup completed! Your profile is now active.');
        setTimeout(() => onSetupComplete(), 1500);
      } else {
        toast.error('Failed to complete setup');
      }
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error('Error completing setup');
    } finally {
      setLoading(false);
    }
  };

  // Welcome Screen
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white w-full max-w-[430px] mx-auto px-6 py-12">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="w-32 h-32 bg-green-500 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
              <Check className="w-14 h-14 text-green-500" strokeWidth={3} />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 You're<br/>Approved!
          </h1>
        </div>

        {/* Welcome Message */}
        <div className="text-center mb-8">
          <p className="text-gray-700">
            Welcome to WARMPAWZ! Set up<br/>your services to start earning
          </p>
          <p className="text-sm text-green-600 font-medium mt-4">
            Your profile is now live and visible to pet parents
          </p>
        </div>

        {/* Setup Steps Preview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Setup (2 steps)</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[#FF8C42]" />
              </div>
              <span className="text-gray-700">Set your service coverage area</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-[#FF8C42]" />
              </div>
              <span className="text-gray-700">Choose your services</span>
            </div>
          </div>
        </div>

        {/* Get Started Button */}
        <Button
          onClick={() => setStep('area')}
          className="w-full h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold rounded-xl shadow-lg"
        >
          Get started
        </Button>

        <p className="text-xs text-center text-gray-500 mt-6">
          You can always modify your services and<br/>prices later from the dashboard
        </p>
      </div>
    );
  }

  // Service Area Screen
  if (step === 'area') {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Service Coverage Area</h2>
          </div>
          <p className="text-sm text-gray-600">Set how far you're willing to travel</p>
        </div>

        {/* Service Radius Slider */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Label className="font-medium text-gray-900">Service Radius</Label>
            <span className="text-2xl font-bold text-[#FF8C42]">{serviceRadius} KM</span>
          </div>
          
          <input
            type="range"
            min="1"
            max="50"
            value={serviceRadius}
            onChange={(e) => setServiceRadius(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF8C42]"
            style={{
              background: `linear-gradient(to right, #FF8C42 0%, #FF8C42 ${(serviceRadius / 50) * 100}%, #E5E7EB ${(serviceRadius / 50) * 100}%, #E5E7EB 100%)`
            }}
          />
          
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-6">
            <p className="text-sm text-gray-700">
              📍 You'll receive bookings within <span className="font-semibold text-[#FF8C42]">{serviceRadius} km</span> of your location
            </p>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          onClick={() => setStep('services')}
          className="w-full h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold rounded-xl shadow-lg"
        >
          Continue
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    );
  }

  // Services Setup Screen
  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto px-6 py-8 pb-24">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Choose Your Services</h2>
        </div>
        {serviceStyle === 'at_home' && (
          <p className="text-sm text-gray-600">Enable services from our catalog</p>
        )}
        {serviceStyle === 'at_center' && (
          <p className="text-sm text-gray-600">Create your custom services</p>
        )}
        {serviceStyle === 'both' && (
          <p className="text-sm text-gray-600">Enable catalog services and create custom ones</p>
        )}
      </div>

      {/* At-Home Services (from catalog) */}
      {(serviceStyle === 'at_home' || serviceStyle === 'both') && (
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">Available Services</h3>
          
          {catalogServices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Loading services...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {catalogServices.map((service) => {
                const isEnabled = enabledServices.includes(service.id);
                return (
                  <div
                    key={service.id}
                    className={`border-2 rounded-xl p-4 transition-all ${
                      isEnabled ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{service.name}</h4>
                        <p className="text-xs text-gray-500">{service.subCategoryName}</p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleService(service.id)}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        Suggested<br/>₹{service.price}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">{service.duration} mins</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* At-Center Services (custom) */}
      {(serviceStyle === 'at_center' || serviceStyle === 'both') && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Custom Services</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCreatingService(true)}
              className="border-2 border-[#FF8C42] text-[#FF8C42]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Service
            </Button>
          </div>

          {/* Custom Services List */}
          {customServices.length > 0 && (
            <div className="space-y-3 mb-4">
              {customServices.map((service, index) => (
                <div key={index} className="border-2 border-[#FF8C42] bg-orange-50 rounded-xl p-4">
                  <h4 className="font-medium text-gray-900 mb-1">{service.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-[#FF8C42]">₹{service.price}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">{service.duration} mins</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Service Form */}
          {isCreatingService && (
            <div className="border-2 border-[#FF8C42] rounded-xl p-5 mb-4 bg-orange-50">
              <h4 className="font-semibold text-gray-900 mb-4">Add New Service</h4>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm mb-2">Service Name *</Label>
                  <Input
                    value={newService.name}
                    onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                    placeholder="e.g., Premium Dog Grooming"
                    className="h-11"
                  />
                </div>

                <div>
                  <Label className="text-sm mb-2">Description</Label>
                  <Textarea
                    value={newService.description}
                    onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                    placeholder="Brief description of the service"
                    className="min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-2">Duration (mins) *</Label>
                    <Input
                      type="number"
                      value={newService.duration}
                      onChange={(e) => setNewService({ ...newService, duration: parseInt(e.target.value) || 0 })}
                      placeholder="30"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-sm mb-2">Price (₹) * <span className="text-xs text-gray-500">(incl. GST)</span></Label>
                    <Input
                      type="number"
                      value={newService.price}
                      onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })}
                      placeholder="500"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreatingService(false);
                      setNewService({ name: '', description: '', duration: 30, price: 0 });
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateCustomService}
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                  >
                    Create Service
                  </Button>
                </div>
              </div>
            </div>
          )}

          {customServices.length === 0 && !isCreatingService && (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-500 text-sm">No custom services yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Add Service" to create one</p>
            </div>
          )}
        </div>
      )}

      {/* Warning */}
      {(enabledServices.length + customServices.length) === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-[#FF8C42] font-medium">
            ⚠️ Please select at least one service to continue
          </p>
        </div>
      )}

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-[430px] mx-auto">
        <Button
          onClick={handleCompleteSetup}
          disabled={loading || (enabledServices.length + customServices.length) === 0}
          className="w-full h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold rounded-xl shadow-lg disabled:opacity-50"
        >
          {loading ? 'Completing Setup...' : 'Complete Setup & Go Live'}
        </Button>
        <p className="text-xs text-center text-gray-500 mt-2">
          {enabledServices.length + customServices.length} service(s) selected
        </p>
      </div>
    </div>
  );
}
