'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ChevronDown, Check } from 'lucide-react';

interface SubCategory {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
}

interface SubCategorySelectorProps {
  categoryId: string | null;
  value: string | null;
  onChange: (subCategoryId: string | null) => void;
  placeholder?: string;
  className?: string;
  showDescription?: boolean;
  filterActiveOnly?: boolean;
}

export function SubCategorySelector({
  categoryId,
  value,
  onChange,
  placeholder = 'Select a subcategory',
  className = '',
  showDescription = false,
  filterActiveOnly = true,
}: SubCategorySelectorProps) {
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (categoryId) {
      loadSubCategories();
    } else {
      setSubCategories([]);
      onChange(null);
    }
  }, [categoryId]);

  const loadSubCategories = async () => {
    if (!categoryId) return;
    
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/admin/catalog/categories/${categoryId}`);
      if (response.success && response.category) {
        let subs = response.category.subCategories || [];
        if (filterActiveOnly) {
          subs = subs.filter((sub: SubCategory) => sub.status === 'active');
        }
        setSubCategories(subs);
      }
    } catch (error) {
      console.error('Error loading subcategories:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedSubCategory = subCategories.find(sub => sub.id === value);

  if (!categoryId) {
    return (
      <div className={`min-h-[44px] px-4 py-0.5 bg-gray-50 border-2 border-gray-200 rounded-lg flex items-center ${className}`}>
        <span className="text-gray-400">Select a category first</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || subCategories.length === 0}
        className="w-full min-h-[44px] px-4 py-0.5 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-between hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          {selectedSubCategory ? (
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{selectedSubCategory.name}</div>
              {showDescription && selectedSubCategory.description && (
                <div className="text-xs text-gray-500 truncate">{selectedSubCategory.description}</div>
              )}
            </div>
          ) : loading ? (
            <span className="text-gray-400">Loading...</span>
          ) : subCategories.length === 0 ? (
            <span className="text-gray-400">No subcategories available</span>
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
              <div className="p-4 text-center text-gray-500">Loading subcategories...</div>
            ) : subCategories.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No subcategories available</div>
            ) : (
              <div className="py-0">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-0.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    value === null ? 'bg-orange-50' : ''
                  }`}
                >
                  {value === null && <Check className="w-4 h-4 text-orange-600" />}
                  <span className={value === null ? 'font-medium text-orange-600' : 'text-gray-700'}>
                    None
                  </span>
                </button>
                {subCategories.map((subCategory) => (
                  <button
                    key={subCategory.id}
                    type="button"
                    onClick={() => {
                      onChange(subCategory.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-0.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      value === subCategory.id ? 'bg-orange-50' : ''
                    }`}
                  >
                    {value === subCategory.id && <Check className="w-4 h-4 text-orange-600" />}
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${value === subCategory.id ? 'text-orange-600' : 'text-gray-900'}`}>
                        {subCategory.name}
                      </div>
                      {showDescription && subCategory.description && (
                        <div className="text-xs text-gray-500 truncate">{subCategory.description}</div>
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

