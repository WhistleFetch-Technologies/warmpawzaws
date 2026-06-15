"use client";

import { ChevronRight, X } from "lucide-react";
import type { SupportFaqArticle, SupportFaqCategory } from "@/lib/support-faq-data";

interface SupportFaqCategorySheetProps {
  open: boolean;
  category: SupportFaqCategory | null;
  onClose: () => void;
  onSelectArticle: (article: SupportFaqArticle) => void;
}

export function SupportFaqCategorySheet({
  open,
  category,
  onClose,
  onSelectArticle,
}: SupportFaqCategorySheetProps) {
  if (!open || !category) return null;

  const Icon = category.icon;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close category articles"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-category-title"
        className="relative z-[1] w-full max-w-lg max-h-[85dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-4 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFF3E8] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#FF8C42]" />
            </div>
            <div className="min-w-0">
              <h2 id="faq-category-title" className="text-base font-semibold text-gray-900 truncate">
                {category.title}
              </h2>
              <p className="text-xs text-gray-500">{category.articles.length} articles</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
          {category.articles.map((article) => (
            <li key={article.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
                onClick={() => onSelectArticle(article)}
              >
                <span className="text-sm font-medium text-gray-900 leading-snug">
                  {article.question}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-gray-300" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
