import React from 'react';
import { Building2, User, Layers } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

export type ServiceMode = 'PHYSICAL_CENTER' | 'MOBILE_PROVIDER' | 'HYBRID';

interface ServiceModeOption {
  mode: ServiceMode;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  badge?: string;
  recommended?: boolean;
}

interface ServiceModeSelectorProps {
  selectedRole: string;
  supportedModes: ServiceMode[];
  onSelect: (mode: ServiceMode) => void;
  onBack: () => void;
}

export function ServiceModeSelector({ 
  selectedRole, 
  supportedModes, 
  onSelect,
  onBack 
}: ServiceModeSelectorProps) {
  
  const modeOptions: Record<ServiceMode, ServiceModeOption> = {
    PHYSICAL_CENTER: {
      mode: 'PHYSICAL_CENTER',
      icon: <Building2 className="w-12 h-12 text-blue-600" />,
      title: 'Physical Center',
      description: 'I have an established business location with staff',
      features: [
        'Multiple staff members',
        'Fixed business address',
        'Customers visit your center',
        'Separate login for each staff',
        'Center-level service configuration'
      ],
      badge: 'Traditional'
    },
    MOBILE_PROVIDER: {
      mode: 'MOBILE_PROVIDER',
      icon: <User className="w-12 h-12 text-orange-600" />,
      title: 'Mobile Provider',
      description: 'I work solo and visit customers at their location',
      features: [
        'Single phone number (no staff needed)',
        'Work from customer locations',
        'GPS tracking enabled',
        'Show as individual provider',
        'Simpler setup and management'
      ],
      badge: 'Recommended for Solo',
      recommended: true
    },
    HYBRID: {
      mode: 'HYBRID',
      icon: <Layers className="w-12 h-12 text-purple-600" />,
      title: 'Hybrid Model',
      description: 'I have a center and also offer home visits',
      features: [
        'Physical location + mobile service',
        'Staff can do home visits',
        'Show in both center & mobile listings',
        'Maximum customer reach',
        'Flexible service delivery'
      ],
      badge: 'Best of Both'
    }
  };

  const availableOptions = supportedModes.map(mode => modeOptions[mode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl mb-2">How do you want to operate?</h1>
          <p className="text-gray-600">
            Choose the model that best fits your business
          </p>
        </div>

        {/* Options Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {availableOptions.map((option) => (
            <Card
              key={option.mode}
              className={`p-6 cursor-pointer transition-all hover:shadow-xl border-2 ${
                option.recommended 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelect(option.mode)}
            >
              {/* Badge */}
              {option.badge && (
                <div className="mb-4">
                  <Badge 
                    variant={option.recommended ? 'default' : 'secondary'}
                    className={option.recommended ? 'bg-orange-500' : ''}
                  >
                    {option.badge}
                  </Badge>
                </div>
              )}

              {/* Icon */}
              <div className="mb-4 flex justify-center">
                {option.icon}
              </div>

              {/* Title & Description */}
              <h3 className="text-xl font-semibold text-center mb-2">
                {option.title}
              </h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                {option.description}
              </p>

              {/* Features */}
              <div className="space-y-2 mb-6">
                {option.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Select Button */}
              <Button
                className={`w-full ${
                  option.recommended 
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : 'bg-gray-800 hover:bg-gray-900'
                }`}
                onClick={() => onSelect(option.mode)}
              >
                Select This Mode
              </Button>
            </Card>
          ))}
        </div>

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            💡 Not sure which to choose?
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>
              <strong>Choose Mobile Provider if:</strong> You work alone, don't have a shop, 
              and only have one phone number. This is perfect for freelance groomers, trainers, 
              or vets doing home visits.
            </li>
            <li>
              <strong>Choose Physical Center if:</strong> You have (or plan to have) a shop/clinic 
              with multiple staff members, and customers come to your location.
            </li>
            <li>
              <strong>Choose Hybrid if:</strong> You have a physical location but also want to 
              offer home visits or mobile services.
            </li>
          </ul>
        </div>

        {/* Back Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onBack}
            className="px-8"
          >
            ← Back to Role Selection
          </Button>
        </div>

        {/* Examples */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Example: Physical Center</p>
            <p className="text-sm">
              <strong>Pawfect Grooming Salon</strong><br />
              Shop in MG Road with 3 groomers
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-xs text-orange-600 mb-2">Example: Mobile Provider</p>
            <p className="text-sm">
              <strong>Rajesh - Pet Grooming</strong><br />
              Solo groomer visiting homes
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Example: Hybrid</p>
            <p className="text-sm">
              <strong>Dr. Priya Vet Clinic</strong><br />
              Clinic + emergency home visits
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
