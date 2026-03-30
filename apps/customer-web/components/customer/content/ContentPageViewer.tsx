'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Share2, Facebook, Twitter, Linkedin, MessageCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { SocialShareButtons } from './SocialShareButtons';

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  readTime: string;
  featured: boolean;
  imageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContentPageViewerProps {
  slug: string;
  onBack?: () => void;
}

export function ContentPageViewer({ slug, onBack }: ContentPageViewerProps) {
  const router = useRouter();
  const [page, setPage] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Don't double-encode - the slug is already decoded from the URL
        // Just ensure it's properly formatted for the API path
        // The apiClient will handle URL construction, but we need to ensure special chars are encoded
        const apiSlug = slug.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const apiPath = `/customer/content/pages/${apiSlug}`;
        
        console.log('[ContentPageViewer] Fetching page:', { slug, apiPath });
        
        const response = await apiClient.get<any>(apiPath);
        
        console.log('[ContentPageViewer] API Response:', response);
        
        if (response?.success && response?.page) {
          setPage(response.page);
        } else {
          console.warn('[ContentPageViewer] Page not found in response:', response);
          setError(response?.error || 'Page not found');
        }
      } catch (err: any) {
        console.error('[ContentPageViewer] Error fetching content page:', err);
        console.error('[ContentPageViewer] Error details:', {
          message: err?.message,
          response: err?.response,
          status: err?.status,
        });
        setError(err?.message || 'Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchPage();
    }
  }, [slug]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      goBackOrHome(router);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📄</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The page you are looking for does not exist.'}</p>
          <Button onClick={handleBack} className="bg-[#FF8C42] hover:bg-[#E07830] text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = page.seoTitle || page.title;
  const shareDescription = page.seoDescription || page.content.substring(0, 160);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            onClick={handleBack}
            variant="ghost"
            className="flex items-center gap-2 text-gray-700 hover:text-[#FF8C42]"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
          <SocialShareButtons
            url={pageUrl}
            title={shareTitle}
            description={shareDescription}
          />
        </div>
      </div>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Article Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-[#FF8C42]/10 text-[#FF8C42] px-3 py-1 rounded-full text-sm font-medium capitalize">
              {page.category}
            </span>
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>{page.readTime}</span>
            </div>
            {page.featured && (
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
                Featured
              </span>
            )}
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{page.title}</h1>
          
          {page.imageUrl && (
            <div className="w-full h-64 md:h-96 rounded-2xl overflow-hidden mb-6">
              <img
                src={page.imageUrl}
                alt={page.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </header>

        {/* Article Content */}
        <div className="prose prose-lg max-w-none">
          <div
            className="text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: page.content || '<p>No content available.</p>' 
            }}
          />
        </div>

        {/* Article Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-gray-500">
              <p>Published on {new Date(page.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
              {page.updatedAt !== page.createdAt && (
                <p className="mt-1">Updated on {new Date(page.updatedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              )}
            </div>
            
            <SocialShareButtons
              url={pageUrl}
              title={shareTitle}
              description={shareDescription}
              variant="horizontal"
            />
          </div>
        </footer>
      </article>
    </div>
  );
}
