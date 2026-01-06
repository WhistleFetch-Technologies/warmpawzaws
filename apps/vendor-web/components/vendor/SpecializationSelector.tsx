'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Check, Loader2, AlertCircle } from 'lucide-react';

interface SpecializationSelectorProps {
  roleId: string;
  selected: string[];
  onChange: (specs: string[]) => void;
}

export function SpecializationSelector({ 
  roleId, 
  selected = [],
  onChange 
}: SpecializationSelectorProps) {
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSpecializations();
  }, [roleId]);

  const loadSpecializations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cleanRoleId = roleId.replace('role_', '');
      const response = await apiClient.get<any>(`/vendor/problem-grid-specializations/${cleanRoleId}`);
      
      if (response.success && response.specializations) {
        setSpecializations(response.specializations);
      } else {
        setError('No specializations available for this vendor type');
      }
    } catch (error) {
      console.error('Error loading specializations:', error);
      setError('Failed to load specializations');
    } finally {
      setLoading(false);
    }
  };

  const toggleSpec = (specId: string) => {
    if (selected.includes(specId)) {
      onChange(selected.filter(s => s !== specId));
    } else {
      onChange([...selected, specId]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
          <p className="text-sm text-gray-500">Loading specializations...</p>
        </div>
      </div>
    );
  }

  if (error || specializations.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-gray-600">
              {error || 'No specializations available'}
            </p>
            <button
              onClick={loadSpecializations}
              className="text-sm text-orange-600 hover:underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          Select the service areas your center specializes in. This helps customers find you when they search by problem category.
        </p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {selected.length} selected
        </span>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-orange-600 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {specializations.map((spec: any) => {
          const isSelected = selected.includes(spec.id);
          
          return (
            <button
              key={spec.id}
              onClick={() => toggleSpec(spec.id)}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-orange-500 bg-orange-50 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-orange-600 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white stroke-[3]" />
                </div>
              )}

              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${
                isSelected 
                  ? 'bg-gradient-to-br from-orange-600 to-orange-700' 
                  : 'bg-gray-100'
              }`}>
                <span className="text-2xl">{spec.icon}</span>
              </div>

              <div className={`text-sm font-medium ${
                isSelected ? 'text-gray-900' : 'text-gray-700'
              }`}>
                {spec.displayName || spec.name}
              </div>

              {spec.shortDescription && (
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {spec.shortDescription}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-green-900 mb-1">
                Your center will appear in searches for:
              </p>
              <div className="flex flex-wrap gap-1">
                {specializations
                  .filter((s: any) => selected.includes(s.id))
                  .map((s: any) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-full text-xs text-green-700"
                    >
                      {s.icon} {s.displayName || s.name}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

