'use client';

import { useState, useEffect } from 'react';
import { Check, X, Gift, Calendar, Clock } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface FreeTrial {
  id: string;
  serviceName: string;
  description: string;
  duration: string;
  vendorName: string;
  vendorId: string;
  available: boolean;
  terms?: string[];
}

interface FreeTrialSelectorProps {
  serviceType?: string;
  onSelectTrial?: (trial: FreeTrial) => void;
  onClose?: () => void;
}

export function FreeTrialSelector({
  serviceType,
  onSelectTrial,
  onClose
}: FreeTrialSelectorProps) {
  const [trials, setTrials] = useState<FreeTrial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrial, setSelectedTrial] = useState<FreeTrial | null>(null);

  useEffect(() => {
    fetchFreeTrials();
  }, [serviceType]);

  const fetchFreeTrials = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (serviceType) params.append('serviceType', serviceType);

      const response = await apiClient.get<{ trials: FreeTrial[] }>(
        `/customer/free-trials?${params}`
      );
      
      if (response.trials) {
        setTrials(response.trials);
      }
    } catch (error) {
      console.error('Error fetching free trials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrial = (trial: FreeTrial) => {
    setSelectedTrial(trial);
    onSelectTrial?.(trial);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading free trials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-0 pt-12 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Free Trial Services</h1>
            <p className="text-white/90 text-sm">Try services for free</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Gift className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-0 py-0">
        {trials.length === 0 ? (
          <div className="bg-white rounded-xl border p-02 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">No free trials available</p>
            <p className="text-sm text-gray-500 mt-0">Check back later for new offers</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trials.map((trial) => (
              <div
                key={trial.id}
                onClick={() => handleSelectTrial(trial)}
                className={`bg-white rounded-xl border-2 p-0 transition-all active:scale-[0.98] cursor-pointer ${
                  selectedTrial?.id === trial.id
                    ? 'border-primary bg-orange-50'
                    : 'border-gray-200 hover:border-primary hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-0 mb-0">
                      <span className="px-0 py-0 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        FREE TRIAL
                      </span>
                      {!trial.available && (
                        <span className="px-0 py-0 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          UNAVAILABLE
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-0">{trial.serviceName}</h3>
                    <p className="text-sm text-gray-600 mb-0">{trial.description}</p>
                    <p className="text-sm font-semibold text-gray-900">{trial.vendorName}</p>
                  </div>
                  {selectedTrial?.id === trial.id && (
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-0">
                  <div className="flex items-center gap-0">
                    <Clock className="w-4 h-4" />
                    <span>{trial.duration}</span>
                  </div>
                </div>

                {trial.terms && trial.terms.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-0">
                    <p className="text-xs font-semibold text-gray-700 mb-0">Terms & Conditions:</p>
                    <ul className="space-y-1">
                      {trial.terms.map((term, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start gap-0">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{term}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!trial.available && (
                  <div className="mt-0 p-1 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">This trial is currently unavailable</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

