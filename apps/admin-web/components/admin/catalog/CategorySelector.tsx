'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, Check } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  status: 'active' | 'inactive';
}

interface CategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  placeholder?: string;
  className?: string;
  showDescription?: boolean;
  filterActiveOnly?: boolean;
}

export function CategorySelector({
  value,
  onChange,
  placeholder = 'Select a category',
  className = '',
  showDescription = false,
  filterActiveOnly = true,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/catalog/categories');
      if (response.success && response.categories) {
        let cats = response.categories;
        if (filterActiveOnly) {
          cats = cats.filter((cat: Category) => cat.status === 'active');
        }
        setCategories(cats);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.id === value);

  const getCategoryIcon = (iconName?: string) => {
    if (!iconName) return '📦';
    const icons: Record<string, string> = {
      'healthcare': '🏥',
      'grooming': '✂️',
      'walkers': '🚶',
      'boarding': '🏠',
      'sunset': '🌅',
      'insurance': '🛡️',
      'mating': '💕',
    };
    return icons[iconName] || '📦';
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] px-4 py-0.5 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-between hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
      >
        <div className="flex items-center gap-0 flex-1 text-left">
          {selectedCategory ? (
            <>
              <span className="text-lg">{getCategoryIcon(selectedCategory.icon)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">{selectedCategory.name}</div>
                {showDescription && selectedCategory.description && (
                  <div className="text-xs text-gray-500 truncate">{selectedCategory.description}</div>
                )}
              </div>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-0 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No categories available</div>
            ) : (
              <div className="py-0">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-0.5 text-left flex items-center gap-0 hover:bg-gray-50 transition-colors ${
                    value === null ? 'bg-orange-50' : ''
                  }`}
                >
                  {value === null && <Check className="w-4 h-4 text-orange-600" />}
                  <span className={value === null ? 'font-medium text-orange-600' : 'text-gray-700'}>
                    None
                  </span>
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      onChange(category.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-0.5 text-left flex items-center gap-0 hover:bg-gray-50 transition-colors ${
                      value === category.id ? 'bg-orange-50' : ''
                    }`}
                  >
                    {value === category.id && <Check className="w-4 h-4 text-orange-600" />}
                    <span className="text-lg">{getCategoryIcon(category.icon)}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${value === category.id ? 'text-orange-600' : 'text-gray-900'}`}>
                        {category.name}
                      </div>
                      {showDescription && category.description && (
                        <div className="text-xs text-gray-500 truncate">{category.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

