'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export interface CustomerArticleListItem {
  id: string;
  title: string;
  slug?: string;
  category?: string;
  readTime?: string;
  featured?: boolean;
  excerpt?: string;
  createdAt?: string;
}

export default function CustomerArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<CustomerArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<{ articles?: CustomerArticleListItem[] }>('/customer/articles?limit=100');
        if (!cancelled) {
          setArticles(Array.isArray(res?.articles) ? res.articles : []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not load articles');
          setArticles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set).sort();
  }, [articles]);

  const visibleArticles = useMemo(() => {
    if (!category) return articles;
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  const goToArticle = (a: CustomerArticleListItem) => {
    const ref = (a.slug || a.id || '').toString();
    if (!ref) return;
    router.push(`/articles/${encodeURIComponent(ref)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/80 via-white to-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-teal-100">
        <div className="max-w-[430px] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="p-2 rounded-full hover:bg-teal-50 text-slate-600"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-600 shrink-0" />
              Pet care articles
            </h1>
            <p className="text-xs text-slate-500 truncate">
              Tips from Warmpawz — pets, services & vendors
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-[430px] mx-auto px-4 py-5 pb-10">
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-2">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !category
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-colors ${
                  category === c
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
            <span className="text-sm">Loading articles…</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-white border border-red-100">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
            <p className="text-slate-600 text-sm">{error}</p>
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-white border border-slate-100">
            <BookOpen className="w-14 h-14 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-600 text-sm font-medium">
              {articles.length === 0 ? 'No articles yet' : 'No articles in this category'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {articles.length === 0
                ? 'When your team publishes articles in the admin portal, they will show up here.'
                : 'Try another category or view all.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleArticles.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => goToArticle(a)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md hover:border-teal-200 transition-all flex gap-3 items-start"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {a.featured && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Featured
                        </span>
                      )}
                      {a.category && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full capitalize">
                          {a.category}
                        </span>
                      )}
                      {a.readTime && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {a.readTime}
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-semibold text-slate-900 leading-snug">{a.title}</h2>
                    {a.excerpt ? (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.excerpt}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 mt-1" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
