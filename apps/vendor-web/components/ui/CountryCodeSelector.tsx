'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/components/ui/utils';

// Vendor: India (+91) only; other regions commented for easy restore.
export const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳', iso: 'IN' },
  // { code: '+1', country: 'United States', flag: '🇺🇸', iso: 'US' },
  // { code: '+1', country: 'Canada', flag: '🇨🇦', iso: 'CA' },
  // { code: '+44', country: 'United Kingdom', flag: '🇬🇧', iso: 'GB' },
  // { code: '+61', country: 'Australia', flag: '🇦🇺', iso: 'AU' },
  // { code: '+971', country: 'UAE', flag: '🇦🇪', iso: 'AE' },
  // { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', iso: 'SA' },
  // { code: '+65', country: 'Singapore', flag: '🇸🇬', iso: 'SG' },
  // { code: '+60', country: 'Malaysia', flag: '🇲🇾', iso: 'MY' },
  // { code: '+49', country: 'Germany', flag: '🇩🇪', iso: 'DE' },
  // { code: '+33', country: 'France', flag: '🇫🇷', iso: 'FR' },
  // { code: '+39', country: 'Italy', flag: '🇮🇹', iso: 'IT' },
  // { code: '+34', country: 'Spain', flag: '🇪🇸', iso: 'ES' },
  // { code: '+31', country: 'Netherlands', flag: '🇳🇱', iso: 'NL' },
  // { code: '+32', country: 'Belgium', flag: '🇧🇪', iso: 'BE' },
  // { code: '+41', country: 'Switzerland', flag: '🇨🇭', iso: 'CH' },
  // { code: '+43', country: 'Austria', flag: '🇦🇹', iso: 'AT' },
  // { code: '+46', country: 'Sweden', flag: '🇸🇪', iso: 'SE' },
  // { code: '+47', country: 'Norway', flag: '🇳🇴', iso: 'NO' },
  // { code: '+45', country: 'Denmark', flag: '🇩🇰', iso: 'DK' },
  // { code: '+358', country: 'Finland', flag: '🇫🇮', iso: 'FI' },
  // { code: '+48', country: 'Poland', flag: '🇵🇱', iso: 'PL' },
  // { code: '+7', country: 'Russia', flag: '🇷🇺', iso: 'RU' },
  // { code: '+81', country: 'Japan', flag: '🇯🇵', iso: 'JP' },
  // { code: '+82', country: 'South Korea', flag: '🇰🇷', iso: 'KR' },
  // { code: '+86', country: 'China', flag: '🇨🇳', iso: 'CN' },
  // { code: '+852', country: 'Hong Kong', flag: '🇭🇰', iso: 'HK' },
  // { code: '+886', country: 'Taiwan', flag: '🇹🇼', iso: 'TW' },
  // { code: '+66', country: 'Thailand', flag: '🇹🇭', iso: 'TH' },
  // { code: '+62', country: 'Indonesia', flag: '🇮🇩', iso: 'ID' },
  // { code: '+63', country: 'Philippines', flag: '🇵🇭', iso: 'PH' },
  // { code: '+84', country: 'Vietnam', flag: '🇻🇳', iso: 'VN' },
  // { code: '+92', country: 'Pakistan', flag: '🇵🇰', iso: 'PK' },
  // { code: '+880', country: 'Bangladesh', flag: '🇧🇩', iso: 'BD' },
  // { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', iso: 'LK' },
  // { code: '+977', country: 'Nepal', flag: '🇳🇵', iso: 'NP' },
  // { code: '+95', country: 'Myanmar', flag: '🇲🇲', iso: 'MM' },
  // { code: '+27', country: 'South Africa', flag: '🇿🇦', iso: 'ZA' },
  // { code: '+234', country: 'Nigeria', flag: '🇳🇬', iso: 'NG' },
  // { code: '+254', country: 'Kenya', flag: '🇰🇪', iso: 'KE' },
  // { code: '+20', country: 'Egypt', flag: '🇪🇬', iso: 'EG' },
  // { code: '+212', country: 'Morocco', flag: '🇲🇦', iso: 'MA' },
  // { code: '+55', country: 'Brazil', flag: '🇧🇷', iso: 'BR' },
  // { code: '+52', country: 'Mexico', flag: '🇲🇽', iso: 'MX' },
  // { code: '+54', country: 'Argentina', flag: '🇦🇷', iso: 'AR' },
  // { code: '+56', country: 'Chile', flag: '🇨🇱', iso: 'CL' },
  // { code: '+57', country: 'Colombia', flag: '🇨🇴', iso: 'CO' },
  // { code: '+51', country: 'Peru', flag: '🇵🇪', iso: 'PE' },
  // { code: '+58', country: 'Venezuela', flag: '🇻🇪', iso: 'VE' },
  // { code: '+353', country: 'Ireland', flag: '🇮🇪', iso: 'IE' },
  // { code: '+351', country: 'Portugal', flag: '🇵🇹', iso: 'PT' },
  // { code: '+30', country: 'Greece', flag: '🇬🇷', iso: 'GR' },
  // { code: '+90', country: 'Turkey', flag: '🇹🇷', iso: 'TR' },
  // { code: '+972', country: 'Israel', flag: '🇮🇱', iso: 'IL' },
  // { code: '+974', country: 'Qatar', flag: '🇶🇦', iso: 'QA' },
  // { code: '+973', country: 'Bahrain', flag: '🇧🇭', iso: 'BH' },
  // { code: '+968', country: 'Oman', flag: '🇴🇲', iso: 'OM' },
  // { code: '+965', country: 'Kuwait', flag: '🇰🇼', iso: 'KW' },
  // { code: '+64', country: 'New Zealand', flag: '🇳🇿', iso: 'NZ' },
  // { code: '+380', country: 'Ukraine', flag: '🇺🇦', iso: 'UA' },
  // { code: '+420', country: 'Czech Republic', flag: '🇨🇿', iso: 'CZ' },
  // { code: '+36', country: 'Hungary', flag: '🇭🇺', iso: 'HU' },
  // { code: '+40', country: 'Romania', flag: '🇷🇴', iso: 'RO' },
  // { code: '+421', country: 'Slovakia', flag: '🇸🇰', iso: 'SK' },
  // { code: '+386', country: 'Slovenia', flag: '🇸🇮', iso: 'SI' },
  // { code: '+385', country: 'Croatia', flag: '🇭🇷', iso: 'HR' },
  // { code: '+381', country: 'Serbia', flag: '🇷🇸', iso: 'RS' },
  // { code: '+359', country: 'Bulgaria', flag: '🇧🇬', iso: 'BG' },
  // { code: '+370', country: 'Lithuania', flag: '🇱🇹', iso: 'LT' },
  // { code: '+371', country: 'Latvia', flag: '🇱🇻', iso: 'LV' },
  // { code: '+372', country: 'Estonia', flag: '🇪🇪', iso: 'EE' },
];

interface CountryCodeSelectorProps {
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
  className?: string;
  /** Applied to the left trigger so its radius matches the parent group (e.g. `rounded-l-lg` with `rounded-lg` wrapper). */
  triggerClassName?: string;
}

export function CountryCodeSelector({ 
  selectedCode, 
  onSelect, 
  disabled = false,
  className = '',
  triggerClassName,
}: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  // const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  // const searchInputRef = useRef<HTMLInputElement>(null);

  // Find selected country
  const selectedCountry = COUNTRY_CODES.find(c => c.code === selectedCode && c.iso === 'IN') 
    || COUNTRY_CODES.find(c => c.code === selectedCode) 
    || COUNTRY_CODES[0];

  // Filter countries based on search (disabled — search UI commented out)
  const filteredCountries = COUNTRY_CODES;
  // const filteredCountries = COUNTRY_CODES.filter(country =>
  //   country.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //   country.code.includes(searchTerm) ||
  //   country.iso.toLowerCase().includes(searchTerm.toLowerCase())
  // );

  // Close dropdown when clicking/touching outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens (disabled — search UI commented out)
  // useEffect(() => {
  //   if (isOpen && searchInputRef.current) {
  //     searchInputRef.current.focus();
  //   }
  // }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Selected Country Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 h-full px-3 py-3 min-w-[90px]',
          'bg-gray-50 border-r border-gray-200',
          'rounded-l-2xl',
          'hover:bg-gray-100 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          triggerClassName,
        )}
      >
        <span className="text-xl">{selectedCountry.flag}</span>
        <span className="text-gray-700 font-medium text-sm">{selectedCountry.code}</span>
        <svg 
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 w-[min(18rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Search Input — commented out (India-only vendor flow)
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20"
              />
            </div>
          </div>
          */}

          {/* Country List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No countries found
              </div>
            ) : (
              filteredCountries.map((country, index) => (
                <button
                  key={`${country.iso}-${index}`}
                  type="button"
                  onClick={() => {
                    onSelect(country.code);
                    setIsOpen(false);
                    // setSearchTerm('');
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left
                    hover:bg-[#FF8C42]/10 active:bg-[#FF8C42]/20 transition-colors
                    ${selectedCode === country.code && selectedCountry.iso === country.iso 
                      ? 'bg-[#FF8C42]/10 border-l-4 border-[#FF8C42]' 
                      : ''
                    }
                  `}
                >
                  <span className="text-2xl">{country.flag}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{country.country}</p>
                    <p className="text-xs text-gray-500">{country.code}</p>
                  </div>
                  {selectedCode === country.code && selectedCountry.iso === country.iso && (
                    <svg className="w-5 h-5 text-[#FF8C42]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Phone Input Component with integrated country code selector
interface PhoneInputWithCountryProps {
  phone: string;
  countryCode: string;
  onPhoneChange: (phone: string) => void;
  onCountryCodeChange: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function PhoneInputWithCountry({
  phone,
  countryCode,
  onPhoneChange,
  onCountryCodeChange,
  disabled = false,
  placeholder = '74493 38923',
  maxLength = 10
}: PhoneInputWithCountryProps) {
  return (
    <div className="flex items-stretch border-2 border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#FF8C42] focus-within:ring-4 focus-within:ring-[#FF8C42]/20 transition-all bg-white">
      <CountryCodeSelector
        selectedCode={countryCode}
        onSelect={onCountryCodeChange}
        disabled={disabled}
      />
      <input
        type="tel"
        inputMode="numeric"
        maxLength={maxLength}
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 py-4 px-4 text-lg outline-none disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}

export default CountryCodeSelector;
