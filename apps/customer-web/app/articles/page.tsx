import { Suspense } from 'react';
import ArticlesPageClient from './ArticlesPageClient';
import { Loader2 } from 'lucide-react';

function ArticlesListFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/80 via-white to-slate-50 flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export default function CustomerArticlesPage() {
  return (
    <Suspense fallback={<ArticlesListFallback />}>
      <ArticlesPageClient />
    </Suspense>
  );
}
