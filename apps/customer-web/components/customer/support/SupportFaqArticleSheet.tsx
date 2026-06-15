"use client";

import { X } from "lucide-react";
import type { SupportFaqArticle, SupportFaqCategory } from "@/lib/support-faq-data";

interface SupportFaqArticleSheetProps {
  open: boolean;
  article: SupportFaqArticle | null;
  category: SupportFaqCategory | null;
  onClose: () => void;
}

export function SupportFaqArticleSheet({
  open,
  article,
  category,
  onClose,
}: SupportFaqArticleSheetProps) {
  if (!open || !article) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close article"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-article-title"
        className="relative z-[1] w-full max-w-lg max-h-[85dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl animate-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] px-4 py-4 shrink-0">
          <div className="min-w-0">
            {category && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#FF8C42] mb-1">
                {category.title}
              </p>
            )}
            <h2 id="faq-article-title" className="text-base font-semibold text-gray-900 leading-snug">
              {article.question}
            </h2>
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
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
            {article.answer}
          </p>
        </div>
      </div>
    </div>
  );
}
