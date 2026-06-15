'use client';

import React, { memo } from 'react';
import type { ComponentType } from 'react';
import Image from 'next/image';
import { BookOpen, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { getCustomerArticleCategoryLabel } from '@/lib/article-category-label';

export interface PetCareArticleItem {
  id?: string;
  slug?: string;
  title: string;
  category?: string;
  readTime?: string;
  excerpt?: string;
  description?: string;
  featured?: boolean;
  Icon: ComponentType<{ className?: string }>;
  url?: string;
}

export interface PetCareArticlesSectionProps {
  articles: PetCareArticleItem[];
  onArticleClick?: (article: PetCareArticleItem) => void;
  onSeeAll?: () => void;
  className?: string;
}

interface CategoryTheme {
  cardBg: string;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  accent: string;
  ring: string;
}

function getCategoryTheme(category?: string): CategoryTheme {
  const cat = String(category || 'tips').toLowerCase();

  if (cat.includes('nutrition') || cat.includes('food')) {
    return {
      cardBg: 'from-amber-50/90 to-orange-50/90',
      iconBg: 'bg-gradient-to-br from-amber-100 to-orange-100',
      iconColor: 'text-amber-600',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      accent: 'bg-amber-500',
      ring: 'ring-amber-100',
    };
  }

  if (cat.includes('health') || cat.includes('vet') || cat.includes('medical')) {
    return {
      cardBg: 'from-rose-50/90 to-pink-50/90',
      iconBg: 'bg-gradient-to-br from-rose-100 to-pink-100',
      iconColor: 'text-rose-600',
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-800',
      accent: 'bg-rose-500',
      ring: 'ring-rose-100',
    };
  }

  if (cat.includes('insurance')) {
    return {
      cardBg: 'from-sky-50/90 to-blue-50/90',
      iconBg: 'bg-gradient-to-br from-sky-100 to-blue-100',
      iconColor: 'text-sky-600',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-800',
      accent: 'bg-sky-500',
      ring: 'ring-sky-100',
    };
  }

  if (cat.includes('training') || cat.includes('behavior')) {
    return {
      cardBg: 'from-violet-50/90 to-purple-50/90',
      iconBg: 'bg-gradient-to-br from-violet-100 to-purple-100',
      iconColor: 'text-violet-600',
      badgeBg: 'bg-violet-100',
      badgeText: 'text-violet-800',
      accent: 'bg-violet-500',
      ring: 'ring-violet-100',
    };
  }

  return {
    cardBg: 'from-teal-50/90 to-cyan-50/90',
    iconBg: 'bg-gradient-to-br from-teal-100 to-cyan-100',
    iconColor: 'text-teal-600',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    accent: 'bg-teal-500',
    ring: 'ring-teal-100',
  };
}

function getArticlePreview(article: PetCareArticleItem): string {
  const raw = article.excerpt || article.description || '';
  return raw.trim();
}

function FeaturedArticleCard({
  article,
  onClick,
}: {
  article: PetCareArticleItem;
  onClick: () => void;
}) {
  const theme = getCategoryTheme(article.category);
  const preview = getArticlePreview(article);
  const categoryLabel = getCustomerArticleCategoryLabel(article.category) || 'Tips';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${theme.cardBg} p-4 text-left shadow-sm ring-1 ${theme.ring} transition-all hover:shadow-md active:scale-[0.99]`}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <div
          className={`flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl ${theme.iconBg} shadow-inner`}
        >
          <article.Icon className={`h-9 w-9 ${theme.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${theme.badgeBg} ${theme.badgeText}`}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {article.featured ? 'Featured' : 'Top pick'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${theme.badgeBg} ${theme.badgeText}`}
            >
              {categoryLabel}
            </span>
            {article.readTime ? (
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <Clock className="h-3 w-3" />
                {article.readTime}
              </span>
            ) : null}
          </div>
          <h3 className="mb-1 line-clamp-2 text-[15px] font-bold leading-snug text-gray-900">
            {article.title}
          </h3>
          {preview ? (
            <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-600">{preview}</p>
          ) : (
            <p className="mb-3 text-xs text-gray-500">Tap to read this pet care guide</p>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white ${theme.accent} transition-transform group-hover:gap-1.5`}
          >
            Read now
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function CompactArticleCard({
  article,
  index,
  onClick,
}: {
  article: PetCareArticleItem;
  index: number;
  onClick: () => void;
}) {
  const theme = getCategoryTheme(article.category);
  const preview = getArticlePreview(article);
  const categoryLabel = getCustomerArticleCategoryLabel(article.category) || 'Tips';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-[17rem] shrink-0 snap-start rounded-2xl border border-white/80 bg-white/90 p-3.5 text-left shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.iconBg}`}>
          <article.Icon className={`h-5 w-5 ${theme.iconColor}`} />
        </div>
        <span className="text-[10px] font-bold tabular-nums text-gray-300">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${theme.badgeBg} ${theme.badgeText}`}
        >
          {categoryLabel}
        </span>
        {article.readTime ? (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="h-3 w-3" />
            {article.readTime}
          </span>
        ) : null}
      </div>
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
        {article.title}
      </h3>
      {preview ? (
        <p className="mb-3 line-clamp-2 text-[11px] leading-relaxed text-gray-500">{preview}</p>
      ) : null}
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-teal-600 transition-all group-hover:gap-1">
        Read article
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function PetCareArticlesSectionComponent({
  articles,
  onArticleClick,
  onSeeAll,
  className = '',
}: PetCareArticlesSectionProps) {
  if (articles.length === 0) return null;

  const [featured, ...rest] = articles;
  const handleClick = (article: PetCareArticleItem) => () => onArticleClick?.(article);

  return (
    <div className={`mb-6 px-4 ${className}`} aria-label="Pet Care Articles">
      <div className="relative overflow-hidden rounded-3xl border border-teal-100/70 bg-gradient-to-br from-teal-50/90 via-emerald-50/50 to-cyan-50/40 p-4 shadow-sm">
        <div
          className="pointer-events-none absolute -left-8 top-0 h-28 w-28 rounded-full bg-teal-200/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-10 -right-6 h-32 w-32 rounded-full bg-cyan-200/25 blur-3xl"
          aria-hidden
        />

        <div className="relative mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                <BookOpen className="h-4 w-4 text-teal-600" />
              </span>
              <h2 className="text-base font-bold text-gray-900">Pet Care Articles</h2>
            </div>
            <p className="pl-10 text-[11px] leading-relaxed text-gray-600">
              Quick reads for happier, healthier pets
            </p>
            {onSeeAll ? (
              <button
                type="button"
                onClick={onSeeAll}
                className="mt-2.5 inline-flex items-center gap-0.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-teal-700 shadow-sm ring-1 ring-teal-100 transition-colors hover:bg-white"
              >
                See all
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="relative shrink-0 pt-0.5" aria-hidden>
            <div className="article-hero-glow absolute inset-x-1 bottom-0 h-3.5 rounded-full bg-teal-500/15 blur-md" />
            <div className="article-hero-float relative h-14 w-16 sm:h-[3.75rem] sm:w-[4.5rem]">
              <Image
                src="/images/home/article.webp"
                alt=""
                fill
                className="object-contain object-center drop-shadow-[0_4px_10px_rgba(13,148,136,0.18)]"
                sizes="72px"
                unoptimized
              />
            </div>
          </div>
        </div>

        <div className="relative space-y-3">
          <FeaturedArticleCard article={featured} onClick={handleClick(featured)} />

          {rest.length === 1 ? (
            <button
              type="button"
              onClick={handleClick(rest[0])}
              className="group flex w-full items-start gap-3 rounded-2xl border border-white/80 bg-white/90 p-3.5 text-left shadow-sm backdrop-blur-sm transition-all hover:shadow-md active:scale-[0.99]"
            >
              {(() => {
                const article = rest[0];
                const theme = getCategoryTheme(article.category);
                const preview = getArticlePreview(article);
                const categoryLabel = getCustomerArticleCategoryLabel(article.category) || 'Tips';
                return (
                  <>
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}
                    >
                      <article.Icon className={`h-5 w-5 ${theme.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${theme.badgeBg} ${theme.badgeText}`}
                        >
                          {categoryLabel}
                        </span>
                        {article.readTime ? (
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Clock className="h-3 w-3" />
                            {article.readTime}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mb-0.5 line-clamp-1 text-sm font-semibold text-gray-900">
                        {article.title}
                      </h3>
                      {preview ? (
                        <p className="line-clamp-1 text-[11px] text-gray-500">{preview}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-teal-600" />
                  </>
                );
              })()}
            </button>
          ) : rest.length > 1 ? (
            <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
              <div className="flex snap-x snap-mandatory gap-3">
                {rest.map((article, index) => (
                  <CompactArticleCard
                    key={article.id || index + 1}
                    article={article}
                    index={index}
                    onClick={handleClick(article)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        @keyframes article-hero-float {
          0%,
          100% {
            transform: translateY(0) rotate(-1deg);
          }
          50% {
            transform: translateY(-4px) rotate(1deg);
          }
        }
        @keyframes article-hero-glow {
          0%,
          100% {
            opacity: 0.45;
            transform: scaleX(1);
          }
          50% {
            opacity: 0.7;
            transform: scaleX(1.08);
          }
        }
        .article-hero-float {
          animation: article-hero-float 4.5s ease-in-out infinite;
        }
        .article-hero-glow {
          animation: article-hero-glow 4.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .article-hero-float,
          .article-hero-glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export const PetCareArticlesSection = memo(PetCareArticlesSectionComponent);
