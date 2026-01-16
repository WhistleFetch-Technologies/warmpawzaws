'use client';

import { Building2, User, Layers } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-0">
      <div className="mb-0">
        <button onClick={onBack} className="text-primary hover:underline text-sm mb-4">
          ← Back
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-0">Select Service Mode</h2>
        <p className="text-gray-600 text-sm">Choose how you'll deliver services</p>
      </div>

      <div className="space-y-4">
        {availableOptions.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => onSelect(option.mode)}
            className="w-full p-0 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {option.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-0">
                  <h3 className="font-bold text-gray-900">{option.title}</h3>
                  {option.badge && (
                    <span className="px-0 py-0 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {option.badge}
                    </span>
                  )}
                  {option.recommended && (
                    <span className="px-0 py-0 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-0">{option.description}</p>
                <ul className="space-y-1">
                  {option.features.map((feature, idx) => (
                    <li key={idx} className="text-xs text-gray-500 flex items-center gap-3">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
