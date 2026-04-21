'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Old path `/articles/:slug` → canonical `/articles?slug=` for static export (single `articles.html`). */
export default function LegacySlugRedirectClient({ slug }: { slug: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!slug) {
      router.replace('/articles');
      return;
    }
    router.replace(`/articles?slug=${encodeURIComponent(slug)}`);
  }, [slug, router]);
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/80 via-white to-slate-50 flex flex-col items-center justify-center gap-2 text-slate-500">
      <p className="text-sm">Opening article…</p>
    </div>
  );
}
