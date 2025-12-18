import { useState, useEffect } from 'react';
import { 
  Home, Building2, Video, MapPin, Navigation, Shield, AlertCircle,
  Lock, CheckCircle, Info
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner@2.0.3';

interface ServicePublishFormWithGPSProps {
  service: any;
  vendorData: any;
  roleConfiguration: any;
  onPublish: (publishData: any) => void;
  onCancel: () => void;
}

export function ServicePublishFormWithGPS({
  service,
  vendorData,
  roleConfiguration,
  onPublish,
  onCancel
}: ServicePublishFormWithGPSProps) {
  const [publishLevel, setPublishLevel] = useState<'vendor' | 'centre'>('vendor');
  const [selectedCentres, setSelectedCentres] = useState<string[]>([]);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [customPackageEnabled, setCustomPackageEnabled] = useState(false);

  // TASK 1: GPS is automatically required for home services (non-toggleable)
  const isHomeService = service.serviceStyle === 'at_home' || service.category?.toLowerCase().includes('home');
  const gpsRequired = isHomeService; // Automatic, cannot be changed

  const hasCentres = vendorData?.centres && vendorData.centres.length > 0;

  useEffect(() => {
    // Auto-disable custom packages unless in centre context
    if (publishLevel !== 'centre') {
      setCustomPackageEnabled(false);
    }
  }, [publishLevel]);

  const handlePublish = () => {
    // Validation
    if (publishLevel === 'centre' && selectedCentres.length === 0) {
      toast.error('Please select at least one centre');
      return;
    }

    const publishData = {
      serviceId: service.id,
      serviceName: service.name,
      serviceStyle: service.serviceStyle,
      category: service.category,
      publishLevel,
      centres: publishLevel === 'centre' ? selectedCentres : [],
      basePrice: service.basePrice,
      priceOverride: publishLevel === 'centre' ? priceOverride : null,
      customPackageEnabled: publishLevel === 'centre' ? customPackageEnabled : false,
      
      // TASK 1: GPS requirement (automatic for home services)
      gpsRequired,
      gpsTracking: {
        enabled: gpsRequired,
        mandatory: gpsRequired,
        trackStaff: gpsRequired,
        trackCustomer: false, // Optional for customer
        reason: isHomeService ? 'GPS tracking is mandatory for all home services' : null
      }
    };

    onPublish(publishData);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Publish Service</h2>
        <p className="text-gray-600">{service.name}</p>
      </div>

      <div className="space-y-6">
        {/* Service Type Badge with GPS Indicator */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {service.serviceStyle === 'at_home' && <Home className="w-5 h-5 text-[#FF8C42] mt-0.5" />}
              {service.serviceStyle === 'tele' && <Video className="w-5 h-5 text-blue-600 mt-0.5" />}
              {service.serviceStyle === 'at_center' && <Building2 className="w-5 h-5 text-green-600 mt-0.5" />}
              
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {service.serviceStyle === 'at_home' && 'Home Service'}
                  {service.serviceStyle === 'tele' && 'Tele Service'}
                  {service.serviceStyle === 'at_center' && 'Centre Service'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{service.category}</p>
              </div>
            </div>

            {/* TASK 1: GPS Indicator (Non-toggleable for home services) */}
            {gpsRequired && (
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                  <Navigation className="w-3 h-3 mr-1" />
                  GPS Required
                </Badge>
                <Lock className="w-4 h-4 text-blue-600" title="Cannot be disabled" />
              </div>
            )}
          </div>

          {/* TASK 1: GPS Requirement Banner (for home services) */}
          {gpsRequired && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">GPS Tracking Mandatory</p>
                  <p className="text-blue-800">
                    All home services require real-time GPS tracking for safety and transparency. 
                    Staff location will be shared with customers during service delivery.
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-blue-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      <span>Staff GPS tracking: Mandatory</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3" />
                      <span>Customer GPS sharing: Optional (for route optimization)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Publish Level Selection */}
        <Card className="p-4">
          <Label className="mb-3 block">Publish At</Label>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Vendor Level */}
            <button
              onClick={() => setPublishLevel('vendor')}
              disabled={!hasCentres && publishLevel !== 'vendor'}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                publishLevel === 'vendor'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  checked={publishLevel === 'vendor'}
                  onChange={() => setPublishLevel('vendor')}
                  className="w-4 h-4 text-[#FF8C42]"
                />
                <span className="font-medium">Vendor Level</span>
              </div>
              <p className="text-xs text-gray-600">
                Available across all your locations
              </p>
            </button>

            {/* Centre Level */}
            <button
              onClick={() => setPublishLevel('centre')}
              disabled={!hasCentres}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                publishLevel === 'centre'
                  ? 'border-[#FF8C42] bg-orange-50'
                  : hasCentres
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  checked={publishLevel === 'centre'}
                  onChange={() => setPublishLevel('centre')}
                  disabled={!hasCentres}
                  className="w-4 h-4 text-[#FF8C42]"
                />
                <span className="font-medium">Centre Level</span>
              </div>
              <p className="text-xs text-gray-600">
                {hasCentres 
                  ? 'Publish at specific centres with custom pricing'
                  : 'No centres configured'}
              </p>
            </button>
          </div>
        </Card>

        {/* Centre Selection (if centre level) */}
        {publishLevel === 'centre' && hasCentres && (
          <Card className="p-4">
            <Label className="mb-3 block">Select Centres</Label>
            <div className="space-y-2">
              {vendorData.centres.map((centre: any) => (
                <label 
                  key={centre.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCentres.includes(centre.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCentres([...selectedCentres, centre.id]);
                      } else {
                        setSelectedCentres(selectedCentres.filter(id => id !== centre.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{centre.name}</div>
                    <div className="text-sm text-gray-600">{centre.address}</div>
                    {/* TASK 1: GPS indicator for home services at centres */}
                    {gpsRequired && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        <Navigation className="w-3 h-3 mr-1" />
                        GPS tracking enabled
                      </Badge>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* Price Override (centre level only) */}
        {publishLevel === 'centre' && (
          <Card className="p-4">
            <Label className="mb-3 block">Pricing</Label>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600 mb-2">
                  Base Price: ₹{service.basePrice}
                </div>
                <Label className="text-sm">Centre-Specific Price Override (Optional)</Label>
                <Input
                  type="number"
                  value={priceOverride || ''}
                  onChange={(e) => setPriceOverride(e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder={`₹${service.basePrice}`}
                  className="mt-1"
                />
              </div>

              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Checkbox
                  checked={customPackageEnabled}
                  onCheckedChange={(checked) => setCustomPackageEnabled(checked as boolean)}
                  id="custom-package"
                />
                <div className="flex-1">
                  <Label htmlFor="custom-package" className="cursor-pointer">
                    Enable Custom Packages
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    Allow centre staff to create custom pricing packages for this service
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* TASK 1: GPS Tracking Summary */}
        {gpsRequired && (
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              GPS Tracking Configuration
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Staff Location Tracking</span>
                  <p className="text-xs text-gray-600 mt-1">
                    Enabled automatically - Staff must share real-time location during service
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Customer Location (Optional)</span>
                  <p className="text-xs text-gray-600 mt-1">
                    Customers can optionally share their location for better route optimization
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">Privacy & Security</span>
                  <p className="text-xs text-gray-600 mt-1">
                    Location data is encrypted and only shared during active service sessions
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handlePublish}
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            Publish Service
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Publishing Guidelines</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Published services are immediately visible to customers</li>
                {gpsRequired && (
                  <li>GPS tracking cannot be disabled for home services - it's a platform requirement</li>
                )}
                <li>You can unpublish or modify pricing anytime from the service catalog</li>
                {publishLevel === 'centre' && (
                  <li>Centre-level pricing overrides vendor-level base price</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
