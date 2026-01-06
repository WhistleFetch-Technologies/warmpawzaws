'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Plus, Tag } from 'lucide-react';

interface TagOption {
  id: string;
  name: string;
  color?: string;
}

interface TagsSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
  maxTags?: number;
  suggestions?: string[];
}

export function TagsSelector({
  value = [],
  onChange,
  placeholder = 'Add tags...',
  className = '',
  allowCreate = true,
  maxTags,
  suggestions = [],
}: TagsSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/catalog/tags');
      if (response.success && response.tags) {
        setAvailableTags(response.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuggestions = suggestions.length > 0
    ? suggestions.filter(s => !value.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase()))
    : availableTags
        .filter(tag => !value.includes(tag.name) && tag.name.toLowerCase().includes(inputValue.toLowerCase()))
        .map(tag => tag.name);

  const handleAddTag = (tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed || value.includes(trimmed)) return;
    if (maxTags && value.length >= maxTags) return;
    
    onChange([...value, trimmed]);
    setInputValue('');
    setIsOpen(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      handleRemoveTag(value[value.length - 1]);
    }
  };

  const getTagColor = (tagName: string) => {
    const tag = availableTags.find(t => t.name === tagName);
    return tag?.color || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className={className}>
      <div className="min-h-[44px] px-3 py-2 bg-white border-2 border-gray-200 rounded-lg focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200 transition-all">
        <div className="flex flex-wrap gap-2 items-center">
          {value.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${getTagColor(tag)}`}
            >
              <Tag className="w-3 h-3" />
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <div className="relative flex-1 min-w-[120px]">
            <input
              type="text"
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setInputValue(e.target.value);
                setIsOpen(e.target.value.length > 0);
              }}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsOpen(inputValue.length > 0)}
              placeholder={value.length === 0 ? placeholder : ''}
              className="w-full outline-none text-sm bg-transparent"
              disabled={maxTags ? value.length >= maxTags : false}
            />
            
            {isOpen && filteredSuggestions.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsOpen(false)}
                />
                <div className="absolute z-20 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <div className="py-1">
                    {filteredSuggestions.slice(0, 10).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleAddTag(suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Tag className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{suggestion}</span>
                      </button>
                    ))}
                    {allowCreate && inputValue.trim() && !filteredSuggestions.includes(inputValue.trim()) && (
                      <button
                        type="button"
                        onClick={() => handleAddTag(inputValue)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 border-t border-gray-200"
                      >
                        <Plus className="w-4 h-4 text-orange-600" />
                        <span className="text-sm text-orange-600 font-medium">
                          Create "{inputValue.trim()}"
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {maxTags && (
        <div className="mt-1 text-xs text-gray-500">
          {value.length} / {maxTags} tags
        </div>
      )}
    </div>
  );
}

