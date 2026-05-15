'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit2, Clock, Loader2, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type ContentCategory = 
  | 'legal' 
  | 'help' 
  | 'marketing' 
  | 'other'
  | 'tips'
  | 'article'
  | 'nutrition'
  | 'health'
  | 'grooming'
  | 'insurance'
  | 'behavior';

interface ContentPage {
  pageId: string;
  title: string;
  slug: string;
  content: string;
  category: ContentCategory;
  isPublished: boolean;
  updatedAt: string;
}

interface ContentPagePreviewModalProps {
  page: ContentPage | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (page: ContentPage) => void;
}

export function ContentPagePreviewModal({
  page,
  isOpen,
  onClose,
  onEdit,
}: ContentPagePreviewModalProps) {
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && page) {
      loadFullContent();
    } else {
      // Reset state when modal closes
      setFullContent(null);
      setError(null);
    }
  }, [isOpen, page]);

  const loadFullContent = async () => {
    if (!page || !page.isPublished || !page.slug) {
      // Use the content we already have from the list
      setFullContent(page?.content || null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch full content from admin preview endpoint (works for published and unpublished)
      const encodedSlug = encodeURIComponent(page.slug);
      const response = await apiClient.get<any>(`/admin/content/pages/${encodedSlug}/preview`);
      
      if (response?.success && response?.page) {
        setFullContent(response.page.content || page.content);
      } else {
        // Fallback to content from list
        setFullContent(page.content);
      }
    } catch (err: any) {
      console.warn('[ContentPagePreviewModal] Could not fetch full content, using cached content:', err);
      // Use the content we already have from the list
      setFullContent(page.content);
      setError('Could not load full content, showing cached version');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !page) {
    return null;
  }

  const displayContent = fullContent !== null ? fullContent : page.content;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{page.title}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium capitalize">
                {page.category}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(page.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                page.isPublished 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {page.isPublished ? 'Published' : 'Draft'}
              </span>
              {error && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                  {error}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-600">Loading content...</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="prose prose-lg max-w-none">
                <div
                  className="text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: displayContent || '<p class="text-gray-500 italic">No content available.</p>' 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="font-medium">Slug:</span>{' '}
            <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">/{page.slug}</code>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onEdit(page);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium flex items-center gap-2 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
