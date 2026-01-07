'use client';

import { useState, useEffect } from 'react';
import { Package, Check, Star, Clock, DollarSign } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface ServicePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  sessions: number;
  discount?: number;
  popular?: boolean;
  services: string[];
}

interface ServicePackageSelectorProps {
  vendorId: string;
  selectedPackageId?: string;
  onPackageSelect: (packageId: string, packageData: ServicePackage) => void;
}

export function ServicePackageSelector({
  vendorId,
  selectedPackageId,
  onPackageSelect
}: ServicePackageSelectorProps) {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, [vendorId]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ packages: ServicePackage[] }>(
        `/vendor/${vendorId}/service-packages`
      );
      if (response.packages) {
        setPackages(response.packages);
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {packages.map((pkg) => {
        const isSelected = selectedPackageId === pkg.id;

        return (
          <button
            key={pkg.id}
            onClick={() => onPackageSelect(pkg.id, pkg)}
            className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
              isSelected
                ? 'border-primary bg-orange-50'
                : 'border-gray-200 hover:border-primary hover:shadow-md'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-900">{pkg.name}</h3>
                  {pkg.popular && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">{pkg.description}</p>
                {pkg.services && pkg.services.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {pkg.services.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isSelected && (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                <span>{pkg.sessions} sessions</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{pkg.duration} min each</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <div>
                {pkg.discount && (
                  <p className="text-sm text-gray-500 line-through">₹{pkg.price + pkg.discount}</p>
                )}
                <p className="text-2xl font-bold text-primary">₹{pkg.price}</p>
                {pkg.discount && (
                  <p className="text-xs text-green-600">Save ₹{pkg.discount}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

