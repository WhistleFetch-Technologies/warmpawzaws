import { useState, useEffect } from 'react';
import { 
  Check, X, AlertCircle, Info, MapPin, Building2, Radio, Lock, Sparkles,
  Package, DollarSign, Clock, FileText, Tag
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Card } from '../ui/card';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ServicePublishFormProps {
  vendorId: string;
  vendorData: any;
  roleConfiguration: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiresGPSTracking?: boolean;
  isHomeService?: boolean;
}

interface CentreOption {
  id: string;
  name: string;
  address: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export function ServicePublishForm({
  vendorId,
  vendorData,
  roleConfiguration,
  onSuccess,
  onCancel
}: ServicePublishFormProps) {
  const [formData, setFormData] = useState({
    serviceName: '',
    description: '',
    category: '',
    subcategory: '',
    price: '',
    duration: '30',
    serviceStyle: 'at_center' as 'at_center' | 'at_home' | 'tele',
    gpsTracking: false,
    publishLevel: 'vendor' as 'vendor' | 'centre', // NEW: Publish level
    selectedCentreId: '', // NEW: Selected centre
    priceOverride: false, // NEW: Centre-level price override
    centreLevelPrice: '', // NEW: Centre-specific price
  });

  const [allowedCategories, setAllowedCategories] = useState<ServiceCategory[]>([]);
  const [centres, setCentres] = useState<CentreOption[]>([]);
  const [centreServices, setCentreServices] = useState<any[]>([]); // Services already published at selected centre
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Determine if vendor has centres
  const hasCentres = vendorData?.centres && vendorData.centres.length > 0;
  const canPublishAtVendorLevel = roleConfiguration?.publishingRules?.allowVendorLevel !== false;

  useEffect(() => {
    loadAllowedCategories();
    if (hasCentres) {
      loadCentres();
    }
  }, [vendorId]);

  useEffect(() => {
    // Auto-enable GPS tracking for home services
    if (formData.category && allowedCategories.length > 0) {
      const selectedCategory = allowedCategories.find(c => c.id === formData.category);
      if (selectedCategory?.isHomeService || formData.serviceStyle === 'at_home') {
        setFormData(prev => ({ ...prev, gpsTracking: true }));
      }
    }
  }, [formData.category, formData.serviceStyle, allowedCategories]);

  useEffect(() => {
    // Load centre services when a centre is selected
    if (formData.selectedCentreId) {
      loadCentreServices(formData.selectedCentreId);
    }
  }, [formData.selectedCentreId]);

  const loadAllowedCategories = async () => {
    try {
      setLoading(true);
      
      // Load role configuration to determine allowed service categories
      const roleRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (roleRes.ok) {
        const rolesData = await roleRes.json();
        const currentRole = rolesData.roles?.find((r: any) => 
          r.id === vendorData.roleId || r.name.toLowerCase() === vendorData.roleId?.toLowerCase()
        );

        if (currentRole) {
          // Filter categories based on role configuration
          const allCategories: ServiceCategory[] = [
            {
              id: 'veterinary',
              name: 'Veterinary Services',
              description: 'Medical care and consultations',
              icon: '🏥',
              requiresGPSTracking: false,
              isHomeService: false
            },
            {
              id: 'grooming',
              name: 'Grooming Services',
              description: 'Pet grooming and hygiene',
              icon: '✂️',
              requiresGPSTracking: false,
              isHomeService: false
            },
            {
              id: 'training',
              name: 'Training Services',
              description: 'Behavior training and obedience',
              icon: '🎓',
              requiresGPSTracking: true,
              isHomeService: true
            },
            {
              id: 'walking',
              name: 'Walking Services',
              description: 'Dog walking and exercise',
              icon: '🐕',
              requiresGPSTracking: true,
              isHomeService: true
            },
            {
              id: 'boarding',
              name: 'Boarding & Daycare',
              description: 'Pet boarding and day care',
              icon: '🏠',
              requiresGPSTracking: false,
              isHomeService: false
            },
            {
              id: 'nutrition',
              name: 'Nutrition Consulting',
              description: 'Diet plans and nutrition advice',
              icon: '🥗',
              requiresGPSTracking: false,
              isHomeService: false
            }
          ];

          // Filter based on role's allowed vendor types or categories
          let filtered = allCategories;
          
          if (currentRole.vendorTypes && currentRole.vendorTypes.length > 0) {
            // Map vendor types to category IDs
            filtered = allCategories.filter(cat => 
              currentRole.vendorTypes.some((vt: string) => 
                vt.toLowerCase().includes(cat.id) || 
                cat.id.includes(vt.toLowerCase())
              )
            );
          }

          // Additional filtering based on service styles
          if (currentRole.serviceStyles && currentRole.serviceStyles.length > 0) {
            const hasHomeStyle = currentRole.serviceStyles.includes('at_home');
            const hasCenterStyle = currentRole.serviceStyles.includes('at_center');
            
            if (hasHomeStyle && !hasCenterStyle) {
              // Only home services - filter to home-based categories
              filtered = filtered.filter(cat => cat.isHomeService);
            }
          }

          setAllowedCategories(filtered);
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load service categories');
    } finally {
      setLoading(false);
    }
  };

  const loadCentres = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/centres`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (res.ok) {
        const data = await res.json();
        setCentres(data.centres || []);
      }
    } catch (error) {
      console.error('Error loading centres:', error);
    }
  };

  const loadCentreServices = async (centreId: string) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/centre/${centreId}/services`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (res.ok) {
        const data = await res.json();
        setCentreServices(data.services || []);
      }
    } catch (error) {
      console.error('Error loading centre services:', error);
      setCentreServices([]);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.serviceName.trim()) {
      toast.error('Service name is required');
      return;
    }

    if (!formData.category) {
      toast.error('Please select a service category');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }

    if (hasCentres && formData.publishLevel === 'centre' && !formData.selectedCentreId) {
      toast.error('Please select a centre');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        vendorId,
        serviceName: formData.serviceName,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        serviceStyle: formData.serviceStyle,
        gpsTracking: formData.gpsTracking,
        // NEW: Publishing level
        publishLevel: formData.publishLevel,
        centreId: formData.publishLevel === 'centre' ? formData.selectedCentreId : undefined,
        // NEW: Centre-level price override
        centreLevelPrice: formData.priceOverride && formData.centreLevelPrice 
          ? parseFloat(formData.centreLevelPrice) 
          : undefined
      };

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/publish`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (res.ok) {
        const data = await res.json();
        toast.success(
          formData.publishLevel === 'centre' 
            ? `Service published at ${centres.find(c => c.id === formData.selectedCentreId)?.name}` 
            : 'Service published successfully'
        );
        onSuccess();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to publish service');
      }
    } catch (error) {
      console.error('Error publishing service:', error);
      toast.error('Error publishing service');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategory = allowedCategories.find(c => c.id === formData.category);
  const isGPSMandatory = selectedCategory?.requiresGPSTracking || formData.serviceStyle === 'at_home';

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <div className="space-y-6 p-1">
        {/* Service Category Selection */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-2 mb-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Service Categories</h3>
              <p className="text-sm text-blue-700">
                Only categories allowed by your role are shown below. Contact admin to enable additional categories.
              </p>
            </div>
          </div>

          {allowedCategories.length === 0 && !loading && (
            <div className="text-center py-4 text-gray-500">
              No service categories available for your role
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            {allowedCategories.map((category) => (
              <Button
                key={category.id}
                onClick={() => setFormData({ ...formData, category: category.id })}
                className={`p-3 rounded-lg border-2 transition-all ${
                  formData.category === category.id
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{category.icon}</div>
                <div className="text-sm font-medium text-gray-900">{category.name}</div>
                {category.requiresGPSTracking && (
                  <Badge className="mt-1 text-xs bg-purple-100 text-purple-800">
                    GPS Required
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </Card>

        {/* Basic Service Info */}
        <div className="space-y-4">
          <div>
            <Label>Service Name *</Label>
            <Input
              value={formData.serviceName}
              onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
              placeholder="e.g., Basic Consultation"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your service..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price (₹) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Duration (mins) *</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Service Style */}
        <div>
          <Label className="mb-2 block">Service Style *</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => setFormData({ ...formData, serviceStyle: 'at_center' })}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                formData.serviceStyle === 'at_center'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Building2 className="w-5 h-5 mx-auto mb-1 text-blue-600" />
              <div className="text-xs font-medium">At Center</div>
            </Button>

            <Button onClick={() => setFormData({ ...formData, serviceStyle: 'at_home' })}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                formData.serviceStyle === 'at_home'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <MapPin className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <div className="text-xs font-medium">At Home</div>
            </Button>

            <Button onClick={() => setFormData({ ...formData, serviceStyle: 'tele' })}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                formData.serviceStyle === 'tele'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Radio className="w-5 h-5 mx-auto mb-1 text-purple-600" />
              <div className="text-xs font-medium">Tele</div>
            </Button>
          </div>
        </div>

        {/* GPS Tracking (Conditional) */}
        {(formData.serviceStyle === 'at_home' || selectedCategory?.requiresGPSTracking) && (
          <Card className={`p-4 ${isGPSMandatory ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <MapPin className={`w-5 h-5 mt-0.5 ${isGPSMandatory ? 'text-yellow-600' : 'text-gray-600'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Label className={isGPSMandatory ? 'text-yellow-900' : 'text-gray-900'}>
                      GPS Tracking
                    </Label>
                    {isGPSMandatory && (
                      <Badge className="bg-yellow-200 text-yellow-900">MANDATORY</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {isGPSMandatory
                      ? 'GPS tracking is required for home services to ensure customer safety and service quality.'
                      : 'Enable GPS tracking for real-time location updates during service.'}
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.gpsTracking}
                onCheckedChange={(checked) => setFormData({ ...formData, gpsTracking: checked })}
                disabled={isGPSMandatory}
              />
            </div>
          </Card>
        )}

        {/* TASK 2: Centre vs Vendor-level Publishing */}
        {hasCentres && (
          <Card className="p-4 bg-purple-50 border-purple-200">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Publishing Level
            </h3>

            <div className="space-y-3">
              {/* Vendor-level option */}
              {canPublishAtVendorLevel && (
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 cursor-pointer transition-colors hover:border-purple-300">
                  <input
                    type="radio"
                    name="publishLevel"
                    value="vendor"
                    checked={formData.publishLevel === 'vendor'}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      publishLevel: 'vendor',
                      selectedCentreId: '',
                      priceOverride: false 
                    })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">Vendor-level Service</div>
                    <p className="text-xs text-gray-600">
                      Service available across all your centres and directly through your vendor profile
                    </p>
                  </div>
                </label>
              )}

              {/* Centre-level option */}
              <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 cursor-pointer transition-colors hover:border-purple-300">
                <input
                  type="radio"
                  name="publishLevel"
                  value="centre"
                  checked={formData.publishLevel === 'centre'}
                  onChange={(e) => setFormData({ ...formData, publishLevel: 'centre' })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">Centre-specific Service</div>
                  <p className="text-xs text-gray-600 mb-2">
                    Service available only at a specific centre location
                  </p>
                  
                  {formData.publishLevel === 'centre' && (
                    <div className="mt-3 space-y-3">
                      {/* Centre Selection */}
                      <div>
                        <Label className="text-xs mb-1 block">Select Centre *</Label>
                        <select
                          value={formData.selectedCentreId}
                          onChange={(e) => setFormData({ ...formData, selectedCentreId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Choose a centre...</option>
                          {centres.map((centre) => (
                            <option key={centre.id} value={centre.id}>
                              {centre.name} - {centre.address}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Centre Services Display */}
                      {formData.selectedCentreId && centreServices.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Info className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-900">
                              Published Services at this Centre
                            </span>
                          </div>
                          <div className="space-y-1">
                            {centreServices.slice(0, 3).map((service) => (
                              <div key={service.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700">{service.name}</span>
                                <span className="text-gray-600">₹{service.price}</span>
                              </div>
                            ))}
                            {centreServices.length > 3 && (
                              <p className="text-xs text-blue-700 font-medium">
                                +{centreServices.length - 3} more services
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Price Override Option */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <Checkbox
                            checked={formData.priceOverride}
                            onCheckedChange={(checked) => 
                              setFormData({ ...formData, priceOverride: checked as boolean })
                            }
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-yellow-900">
                              Override Price for This Centre
                            </div>
                            <p className="text-xs text-yellow-700 mt-0.5">
                              Set a different price specific to this centre location
                            </p>
                          </div>
                        </label>

                        {formData.priceOverride && (
                          <div className="mt-3">
                            <Label className="text-xs">Centre Price (₹)</Label>
                            <Input
                              type="number"
                              value={formData.centreLevelPrice}
                              onChange={(e) => setFormData({ ...formData, centreLevelPrice: e.target.value })}
                              placeholder="Enter centre-specific price"
                              className="mt-1"
                            />
                            {formData.price && formData.centreLevelPrice && (
                              <p className="text-xs text-gray-600 mt-1">
                                Original: ₹{formData.price} → Centre: ₹{formData.centreLevelPrice}
                                {parseFloat(formData.centreLevelPrice) < parseFloat(formData.price) && (
                                  <span className="text-green-600 ml-1">
                                    ({((1 - parseFloat(formData.centreLevelPrice) / parseFloat(formData.price)) * 100).toFixed(0)}% discount)
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {!canPublishAtVendorLevel && (
                <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <Lock className="w-4 h-4 text-gray-400 mt-0.5" />
                  <p className="text-xs text-gray-600">
                    Vendor-level publishing is not enabled for your role. Services must be published at centre level.
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={submitting}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
            disabled={submitting || !formData.serviceName || !formData.category || !formData.price}
          >
            {submitting ? (
              <>Publishing...</>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Publish Service
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
