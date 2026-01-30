'use client';

import React from 'react';
import {
  Video, Home, Building2, Clock, ChevronRight
} from 'lucide-react';
import { getRoleConfig, RoleId, ServiceStyle } from './roleConfig';

interface UniversalStyleSelectionProps {
  roleId: RoleId;
  problemTitle: string;
  problemId: string;
  onSelectStyle: (style: ServiceStyle) => void;
  onBack: () => void;
}

export function UniversalStyleSelection({
  roleId,
  problemTitle,
  problemId,
  onSelectStyle,
  onBack,
}: UniversalStyleSelectionProps) {
  const config = getRoleConfig(roleId);
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto relative overflow-hidden">
      {/* Orange Header - Half size (17-18vh) with rounded bottom edge */}
      <div className="relative px-4 pt-8 pb-6" style={{ minHeight: '18vh' }}>
        {/* Back Button - White circular with black arrow */}
        <button
          onClick={onBack}
          className="absolute top-8 left-4 w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm z-10"
        >
          <ChevronRight className="w-5 h-5 text-black rotate-180" />
        </button>

        {/* Service Icon - Centered horizontally, white circular */}
        <div className="flex flex-col items-center pt-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm">
            <Icon className="w-6 h-6 text-[#FF8C42]" />
          </div>
          
          {/* Title and Subtitle - Centered */}
          <h1 className="text-xl font-bold text-white text-center mb-0.5">
            {problemTitle}
          </h1>
          <p className="text-white text-xs text-center opacity-90">
            Choose how you'd like to consult
          </p>
        </div>
      </div>

      {/* Rounded Bottom Edge on Header */}
      <div className="relative -mt-1">
        <div className="absolute top-0 left-0 right-0 h-6 bg-[#FF8C42] rounded-b-[32px]"></div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(82vh)] pb-8 relative z-10 -mt-1">
        {/* Section Title */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">How would you like to consult?</h2>

        {/* Tele Consultation - Only for vet */}
        {config.allowedStyles.includes('tele') && (
          <button
            className="w-full p-4 mb-3 rounded-2xl text-left transition-all border-2 border-transparent hover:border-blue-400 hover:shadow-md bg-blue-50"
            onClick={() => onSelectStyle('tele')}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-gray-900 mb-1">{config.styleLabels.tele}</h3>
                <p className="text-sm text-gray-600 leading-snug">
                  {config.styleDescriptions.tele}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5" />
                    Video call
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Available 24/7
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </button>
        )}

        {/* Home Visit */}
        {config.allowedStyles.includes('at_home') && (
          <button
            className="w-full p-4 mb-3 rounded-2xl text-left transition-all border-2 border-transparent hover:border-orange-400 hover:shadow-md bg-orange-50"
            onClick={() => onSelectStyle('at_home')}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-gray-900 mb-1">{config.styleLabels.at_home}</h3>
                <p className="text-sm text-gray-600 leading-snug">
                  {config.styleDescriptions.at_home}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Home className="w-3.5 h-3.5" />
                    At your place
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Book ahead
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </button>
        )}

        {/* Center/Clinic Visit */}
        {config.allowedStyles.includes('at_center') && (
          <button
            className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-green-400 hover:shadow-md bg-green-50"
            onClick={() => onSelectStyle('at_center')}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base text-gray-900 mb-1">{config.styleLabels.at_center}</h3>
                <p className="text-sm text-gray-600 leading-snug">
                  {config.styleDescriptions.at_center}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    At {roleId === 'veterinarian' ? 'clinic' : 'center'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Book appointment
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
