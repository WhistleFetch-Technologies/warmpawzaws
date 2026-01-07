'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SpecializationSelectorProps {
  roleId: string;
  selectedSpecializations: string[];
  onSelectionChange: (specializations: string[]) => void;
  initialSelections?: string[];
}

interface Specialization {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export function SpecializationSelector({
  roleId,
  selectedSpecializations,
  onSelectionChange,
  initialSelections = []
}: SpecializationSelectorProps) {
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialSelections.length > 0) {
      onSelectionChange(initialSelections);
    }
    loadSpecializations();
  }, [roleId]);

  const loadSpecializations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/problem-grid-specializations/${roleId}`);
      if (response.specializations) {
        setSpecializations(response.specializations);
      }
    } catch (error) {
      console.error('Error loading specializations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialization = (specId: string) => {
    const newSelection = selectedSpecializations.includes(specId)
      ? selectedSpecializations.filter(id => id !== specId)
      : [...selectedSpecializations, specId];
    onSelectionChange(newSelection);
  };

  const filteredSpecializations = specializations.filter(spec =>
    spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spec.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search specializations..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
        />
      </div>

      {/* Specializations Grid */}
      <div className="grid grid-cols-2 gap-0">
        {filteredSpecializations.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-gray-500">
            {searchQuery ? 'No specializations found' : 'No specializations available'}
          </div>
        ) : (
          filteredSpecializations.map((spec) => {
            const isSelected = selectedSpecializations.includes(spec.id);
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => toggleSpecialization(spec.id)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-0">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'border-gray-300'
                  }`}>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{spec.name}</div>
                    {spec.description && (
                      <div className="text-xs text-gray-500 mt-0 line-clamp-0">
                        {spec.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Selection Count */}
      {selectedSpecializations.length > 0 && (
        <div className="text-sm text-gray-600 text-center pt-0">
          {selectedSpecializations.length} specialization{selectedSpecializations.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
