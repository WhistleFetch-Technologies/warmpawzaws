'use client';

import { ContentPageViewer } from '@/components/customer/content/ContentPageViewer';

export default function ContentPageClient({ slug }: { slug: string }) {
  if (!slug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Page</h2>
          <p className="text-gray-600">The page URL is invalid.</p>
        </div>
      </div>
    );
  }
  return <ContentPageViewer slug={slug} />;
}

