'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, BookOpen, Clock, Loader2, AlertCircle } from 'lucide-react';

interface ArticleDetail {
  id: string;
  title: string;
  slug?: string;
  content: string;
  category?: string;
  readTime?: string;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function ArticleBody({ content }: { content: string }) {
  const trimmed = (content || '').trim();
  if (!trimmed) {
    return <p className="text-slate-500 text-sm">No content for this article yet.</p>;
  }
  const looksHtml = /^<[a-z][\s\S]*>/i.test(trimmed);
  if (looksHtml) {
    const stripped = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return (
      <div
        className="prose prose-sm max-w-none text-slate-800 [&_img]:max-w-full [&_a]:text-teal-600"
        dangerouslySetInnerHTML={{ __html: stripped }}
      />
    );
  }
  return <div className="whitespace-pre-wrap text-slate-800 text-[15px] leading-relaxed">{trimmed}</div>;
}

export default function CustomerArticleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawSlug = typeof params?.slug === 'string' ? params.slug : '';
  const slug = decodeURIComponent(rawSlug);

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('Missing article');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<{ article?: ArticleDetail }>(
          `/customer/articles/${encodeURIComponent(slug)}`
        );
        if (cancelled) return;
        if (res?.article) setArticle(res.article);
        else setError('Article not found');
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Could not load article');
          setArticle(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/80 via-white to-slate-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-teal-100">
        <div className="max-w-[430px] mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/articles')}
            className="p-2 rounded-full hover:bg-teal-50 text-slate-600"
            aria-label="Back to articles"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Article</p>
            <h1 className="text-base font-bold text-slate-900 line-clamp-2 leading-tight">
              {article?.title || (loading ? 'Loading…' : 'Article')}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-[430px] mx-auto px-4 py-5 pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error || !article ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-white border border-slate-100">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-400" />
            <p className="text-slate-600 text-sm">{error || 'Not found'}</p>
            <button
              type="button"
              onClick={() => router.push('/articles')}
              className="mt-4 text-sm font-semibold text-teal-600"
            >
              All articles
            </button>
          </div>
        ) : (
          <article className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-teal-600" />
              </div>
              {article.featured && (
                <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  Featured
                </span>
              )}
              {article.category && (
                <span className="text-[10px] font-semibold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full capitalize">
                  {article.category}
                </span>
              )}
              {article.readTime && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {article.readTime}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-4 leading-snug">{article.title}</h2>
            <ArticleBody content={article.content} />
          </article>
        )}
      </main>
    </div>
  );
}
