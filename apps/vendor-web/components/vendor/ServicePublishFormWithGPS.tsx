'use client';

import { useState, useEffect } from 'react';
import { Home, Building2, Video, MapPin, Navigation, Shield, Lock, CheckCircle, Info } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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

  const isHomeService = service.serviceStyle === 'at_home' || service.category?.toLowerCase().includes('home');
  const gpsRequired = isHomeService;

  const hasCentres = vendorData?.centres && vendorData.centres.length > 0;

  useEffect(() => {
    if (publishLevel !== 'centre') {
      setCustomPackageEnabled(false);
    }
  }, [publishLevel]);

  const handlePublish = () => {
    if (publishLevel === 'centre' && selectedCentres.length === 0) {
      alert('Please select at least one centre');
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
      gpsRequired,
      gpsTracking: {
        enabled: gpsRequired,
        mandatory: gpsRequired,
        trackStaff: gpsRequired,
        trackCustomer: false,
        reason: isHomeService ? 'GPS tracking is mandatory for all home services' : null
      }
    };

    onPublish(publishData);
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <h2 className="text-xl font-bold text-gray-900">Publish Service</h2>
        <p className="text-sm text-gray-600">{service.name}</p>
      </div>

      <div className="p-4 space-y-6">
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-0">
              {service.serviceStyle === 'at_home' && <Home className="w-5 h-5 text-[primary] mt-0.5" />}
              {service.serviceStyle === 'tele' && <Video className="w-5 h-5 text-blue-600 mt-0.5" />}
              {service.serviceStyle === 'at_center' && <Building2 className="w-5 h-5 text-green-600 mt-0.5" />}
              
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {service.serviceStyle === 'at_home' && 'Home Service'}
                  {service.serviceStyle === 'tele' && 'Tele Service'}
                  {service.serviceStyle === 'at_center' && 'Centre Service'}
                </h3>
                <p className="text-sm text-gray-600 mt-0">{service.category}</p>
              </div>
            </div>

            {gpsRequired && (
              <div className="flex items-center gap-0">
                <span className="px-0 py-0 bg-blue-100 text-blue-800 rounded text-xs font-medium flex items-center gap-0">
                  <Navigation className="w-3 h-3" />
                  GPS Required
                </span>
                <Lock className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>

          {gpsRequired && (
            <div className="mt-4 p-0 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-0">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-blue-900 mb-0">GPS Tracking Mandatory</p>
                  <p className="text-blue-800">
                    All home services require real-time GPS tracking for safety and transparency. 
                    Staff location will be shared with customers during service delivery.
                  </p>
                  <div className="mt-0 space-y-1 text-xs text-blue-700">
                    <div className="flex items-center gap-0">
                      <CheckCircle className="w-3 h-3" />
                      <span>Staff GPS tracking: Mandatory</span>
                    </div>
                    <div className="flex items-center gap-0">
                      <Info className="w-3 h-3" />
                      <span>Customer GPS sharing: Optional (for route optimization)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-0">Publish At</label>
          
          <div className="grid grid-cols-2 gap-0">
            <button
              onClick={() => setPublishLevel('vendor')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                publishLevel === 'vendor'
                  ? 'border-[primary] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-0 mb-0">
                <input
                  type="radio"
                  checked={publishLevel === 'vendor'}
                  onChange={() => setPublishLevel('vendor')}
                  className="w-4 h-4 text-[primary]"
                />
                <span className="font-medium">Vendor Level</span>
              </div>
              <p className="text-xs text-gray-600">
                Available across all your locations
              </p>
            </button>

            <button
              onClick={() => setPublishLevel('centre')}
              disabled={!hasCentres}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                publishLevel === 'centre'
                  ? 'border-[primary] bg-orange-50'
                  : hasCentres
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-0 mb-0">
                <input
                  type="radio"
                  checked={publishLevel === 'centre'}
                  onChange={() => setPublishLevel('centre')}
                  disabled={!hasCentres}
                  className="w-4 h-4 text-[primary]"
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
        </div>

        {publishLevel === 'centre' && hasCentres && (
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-0">Select Centres</label>
            <div className="space-y-2">
              {(vendorData.centres || []).map((centre: any) => (
                <label key={centre.id} className="flex items-center gap-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCentres.includes(centre.id)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setSelectedCentres([...selectedCentres, centre.id]);
                      } else {
                        setSelectedCentres(selectedCentres.filter(id => id !== centre.id));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{centre.name || centre.address}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-0">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-0 border border-gray-300 text-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={publishLevel === 'centre' && selectedCentres.length === 0}
            className="flex-1 px-4 py-0 bg-[primary] text-white rounded-lg font-medium disabled:opacity-50"
          >
            Publish Service
          </button>
        </div>
      </div>
    </div>
  );
}

