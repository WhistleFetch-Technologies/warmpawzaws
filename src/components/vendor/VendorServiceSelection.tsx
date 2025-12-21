import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { ChevronRight, Check } from 'lucide-react';
import { LOGO_CIRCULAR_ORANGE, WARM_ORANGE } from '../../assets/design-tokens';
import { WarmpawzButton } from '../shared/design-system/WarmpawzButton';

const logoImage = LOGO_CIRCULAR_ORANGE;

interface ServiceType {
  id: string;
  name: string;
  icon: string;
  popular?: boolean;
  supportsClinic?: boolean;  // New: Can be provided at clinic
  supportsHome?: boolean;    // New: Can be provided at home
}

const services: ServiceType[] = [
  { id: 'grooming', name: 'Pet Grooming', icon: '✂️', popular: true, supportsClinic: true, supportsHome: true },
  { id: 'boarding', name: 'Boarding', icon: '🏠', popular: true, supportsClinic: true, supportsHome: false },
  { id: 'walking', name: 'Pet Walking', icon: '🐕', popular: false, supportsClinic: false, supportsHome: true },
  { id: 'training', name: 'Pet Training', icon: '🎓', popular: false, supportsClinic: true, supportsHome: true },
  { id: 'cafes', name: 'Pet Cafes', icon: '☕', popular: false, supportsClinic: true, supportsHome: false },
  { id: 'adoption', name: 'Adoption', icon: '🤝', popular: false, supportsClinic: true, supportsHome: true },
  { id: 'sunset', name: 'SunSet Services', icon: '🌅', popular: false, supportsClinic: false, supportsHome: true },
  { id: 'events', name: 'Events', icon: '🎪', popular: false, supportsClinic: true, supportsHome: true },
  { id: 'insurance', name: 'Pet Insurance', icon: '🛡️', popular: false, supportsClinic: true, supportsHome: true },
  { id: 'mating', name: 'Mating & Dating', icon: '💕', popular: false, supportsClinic: true, supportsHome: false }
];

interface ServiceStyle {
  id: 'clinic' | 'home' | 'both';
  title: string;
  subtitle: string;
  icon: string;
}

const serviceStyles: ServiceStyle[] = [
  { id: 'clinic', title: 'At your Clinic/Center', subtitle: 'Customers visit you', icon: '🏪' },
  { id: 'home', title: "At Customer's Home", subtitle: 'You visit customers', icon: '🏡' },
  { id: 'both', title: 'Both Locations', subtitle: 'Offer both services', icon: '🔄' }
];

export function VendorServiceSelection({ onNext }: { onNext: (data: any) => void }) {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<'clinic' | 'home' | 'both' | null>(null);

  // Determine which service styles are available based on selected services
  const getAvailableStyles = () => {
    if (selectedServices.length === 0) {
      return { clinic: true, home: true, both: true }; // All available when nothing selected
    }

    const selectedServiceObjects = services.filter(s => selectedServices.includes(s.id));
    
    // Clinic is available if ANY selected service supports clinic
    const clinicAvailable = selectedServiceObjects.some(s => s.supportsClinic);
    
    // Home is available if ANY selected service supports home
    const homeAvailable = selectedServiceObjects.some(s => s.supportsHome);
    
    // Both is available ONLY if ALL selected services support both clinic AND home
    const bothAvailable = selectedServiceObjects.every(s => s.supportsClinic && s.supportsHome);
    
    return { clinic: clinicAvailable, home: homeAvailable, both: bothAvailable };
  };
  
  const availableStyles = getAvailableStyles();
  
  // Auto-deselect style if it becomes unavailable
  useEffect(() => {
    if (selectedStyle === 'clinic' && !availableStyles.clinic) {
      setSelectedStyle(availableStyles.home ? 'home' : availableStyles.both ? 'both' : null);
    } else if (selectedStyle === 'home' && !availableStyles.home) {
      setSelectedStyle(availableStyles.clinic ? 'clinic' : availableStyles.both ? 'both' : null);
    } else if (selectedStyle === 'both' && !availableStyles.both) {
      // If "both" becomes unavailable, default to the one that's available
      setSelectedStyle(availableStyles.clinic ? 'clinic' : availableStyles.home ? 'home' : null);
    }
  }, [selectedServices, selectedStyle, availableStyles.clinic, availableStyles.home, availableStyles.both]);

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter(id => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };
  
  const handleContinue = () => {
    if (selectedServices.length === 0 || !selectedStyle) {
      alert('Please select at least one service and your service style');
      return;
    }

    // Determine which service styles are selected
    const serviceStylesArray: string[] = [];
    if (selectedStyle === 'clinic') {
      serviceStylesArray.push('clinic');
    } else if (selectedStyle === 'home') {
      serviceStylesArray.push('home');
    } else if (selectedStyle === 'both') {
      serviceStylesArray.push('clinic', 'home');
    }

    onNext({
      services: selectedServices,
      serviceStyle: selectedStyle,
      serviceStyles: serviceStylesArray // Pass array for form logic
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center">
        {/* Logo */}
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(to bottom right, ${WARM_ORANGE}, #FF6B35)` }}>
          <div className="w-12 h-12 flex items-center justify-center">
            <img src={logoImage} alt="Warmpawz" className="w-10 h-10" />
          </div>
        </div>

        {/* Welcome Text */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Welcome to
        </h1>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] bg-clip-text text-transparent mb-4">
          WARMPAWZ !!
        </h2>
        <p className="text-gray-600 text-sm">
          Your Professional Pet Service Platform
        </p>
      </div>

      {/* Content */}
      <div className="px-6 space-y-8">
        {/* Services Selection */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
            Services You Can Offer
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {services.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              const cardStyles = isSelected 
                ? { border: `2px solid ${WARM_ORANGE}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }
                : { border: '1px solid #E5E7EB' };
              
              return (
                <button
                  key={service.id}
                  onClick={() => toggleService(service.id)}
                  className="relative bg-white rounded-2xl p-4 transition-all text-left"
                  style={cardStyles}
                >
                  {/* Selection Checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: WARM_ORANGE }}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {/* Popular Badge */}
                  {service.popular && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        Popular
                      </span>
                    </div>
                  )}

                  {/* Service Content */}
                  <div className="text-center">
                    <div className="text-4xl mb-2">{service.icon}</div>
                    <p className="text-sm font-semibold text-gray-800">
                      {service.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smart Booking System Info */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📅</span>
          </div>
          <h4 className="font-bold text-gray-800 text-center mb-2">
            Smart Booking System
          </h4>
          <p className="text-sm text-gray-600 text-center mb-4">
            Automated appointment scheduling with customer notifications
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        </div>

        {/* Service Style Selection */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
            Choose Your Service Style
          </h3>
          
          {/* First Row: Clinic and Home */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {serviceStyles.filter(s => s.id !== 'both').map((style) => {
              const isDisabled = !availableStyles[style.id];
              return (
                <button
                  key={style.id}
                  onClick={() => !isDisabled && setSelectedStyle(style.id)}
                  disabled={isDisabled}
                  className={`relative bg-white rounded-2xl p-6 border-2 transition-all ${
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed border-gray-200'
                      : selectedStyle === style.id
                      ? 'border-[#FF8C42] shadow-md bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Disabled Overlay */}
                  {isDisabled && (
                    <div className="absolute inset-0 bg-gray-100/50 rounded-2xl flex items-center justify-center">
                      <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
                        Not Available
                      </div>
                    </div>
                  )}

                  {/* Selection Checkmark */}
                  {selectedStyle === style.id && !isDisabled && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className="text-center">
                    <div className="text-5xl mb-3">{style.icon}</div>
                    <p className="font-bold text-gray-800 mb-1 text-sm">
                      {style.title}
                    </p>
                    <p className="text-xs text-gray-600">
                      {style.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Second Row: Both Option (Full Width) */}
          {(() => {
            const bothStyle = serviceStyles.find(s => s.id === 'both')!;
            const isDisabled = !availableStyles.both;
            return (
              <button
                onClick={() => !isDisabled && setSelectedStyle('both')}
                disabled={isDisabled}
                className={`relative w-full bg-white rounded-2xl p-6 border-2 transition-all ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed border-gray-200'
                    : selectedStyle === 'both'
                    ? 'border-[#FF8C42] shadow-md bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Disabled Overlay */}
                {isDisabled && (
                  <div className="absolute inset-0 bg-gray-100/50 rounded-2xl flex items-center justify-center">
                    <div className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold">
                      Not Available
                    </div>
                  </div>
                )}

                {/* Selection Checkmark */}
                {selectedStyle === 'both' && !isDisabled && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-4">
                  <div className="text-5xl">{bothStyle.icon}</div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 mb-1">
                      {bothStyle.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {bothStyle.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })()}
          
          {/* Helper Text */}
          {selectedServices.length > 0 && (!availableStyles.clinic || !availableStyles.home || !availableStyles.both) && (
            <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm text-blue-800 text-center">
                {!availableStyles.clinic && availableStyles.home && !availableStyles.both && '🏡 Selected services support home visits only'}
                {availableStyles.clinic && !availableStyles.home && !availableStyles.both && '🏪 Selected services support clinic/center only'}
                {!availableStyles.both && availableStyles.clinic && availableStyles.home && '⚠️ Not all services support both locations - choose one'}
                {availableStyles.both && '✅ All selected services support both locations!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto">
        <WarmpawzButton
          variant={selectedServices.length === 0 || !selectedStyle ? 'disabled' : 'solid'}
          disabled={selectedServices.length === 0 || !selectedStyle}
          fullWidth
          onClick={handleContinue}
          icon={ChevronRight}
          iconPosition="right"
          style={{ height: '56px', fontSize: '16px', fontWeight: 600 }}
        >
          Start your pet service business
        </WarmpawzButton>
      </div>
    </div>
  );
}