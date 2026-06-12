"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Bot,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Ticket,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SUPPORT_FAQ_CATEGORIES,
  filterFaqCategories,
  type SupportFaqArticle,
  type SupportFaqCategory,
} from "@/lib/support-faq-data";
import { SupportFaqArticleSheet } from "./SupportFaqArticleSheet";
import { SupportFaqCategorySheet } from "./SupportFaqCategorySheet";

const POPULAR_COUNT = 3;

interface SupportFaqTabProps {
  onAskAI: () => void;
  onCreateTicket: () => void;
  onGoToTickets: () => void;
}

export function SupportFaqTab({ onAskAI, onCreateTicket, onGoToTickets }: SupportFaqTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string>(SUPPORT_FAQ_CATEGORIES[0]?.id ?? "booking");
  const [selectedArticle, setSelectedArticle] = useState<SupportFaqArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SupportFaqCategory | null>(null);
  const [categorySheet, setCategorySheet] = useState<SupportFaqCategory | null>(null);

  const isSearching = searchQuery.trim().length > 0;
  const visibleCategories = useMemo(
    () => (isSearching ? filterFaqCategories(searchQuery) : SUPPORT_FAQ_CATEGORIES),
    [isSearching, searchQuery]
  );

  const openArticle = (article: SupportFaqArticle, category: SupportFaqCategory) => {
    setSelectedCategory(category);
    setSelectedArticle(article);
  };

  const toggleCategory = (id: string) => {
    setExpandedId((prev) => (prev === id ? "" : id));
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 pointer-events-none"
          aria-hidden
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help articles..."
          className="w-full h-11 pl-11 pr-4 rounded-2xl border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30 focus:border-[#FF8C42]/50"
        />
      </div>

      {/* AI Assistant banner */}
      {!isSearching && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-2xl bg-[#FFF3E8] border border-[#FF8C42]/10 shadow-[0_2px_12px_rgba(255,140,66,0.08)]">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-6 h-6 text-[#FF8C42]" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-gray-900 leading-snug">
                Can&apos;t find what you&apos;re looking for?
              </p>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Ask our AI Assistant and get instant answers 24/7.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={onAskAI}
            className="shrink-0 w-full sm:w-auto h-10 px-4 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white text-sm font-medium gap-2 shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Ask AI Assistant
          </Button>
        </div>
      )}

      {/* Search results */}
      {isSearching && (
        <div className="space-y-3">
          {visibleCategories.length === 0 ? (
            <div className="rounded-2xl border border-[#F1F5F9] bg-white p-8 text-center shadow-sm">
              <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No articles match your search</p>
              <button
                type="button"
                onClick={onAskAI}
                className="mt-3 text-sm font-medium text-[#FF8C42] hover:underline"
              >
                Ask AI Assistant instead
              </button>
            </div>
          ) : (
            visibleCategories.map((category) => (
              <div
                key={category.id}
                className="rounded-2xl border border-[#F1F5F9] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden"
              >
                <div className="px-3 py-2.5 border-b border-[#F1F5F9] bg-gray-50/50">
                  <p className="text-xs font-semibold text-gray-600">{category.title}</p>
                </div>
                <ul className="divide-y divide-[#F1F5F9]">
                  {category.articles.map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-gray-50"
                        onClick={() => openArticle(article, category)}
                      >
                        <span className="text-sm text-gray-900">{article.question}</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-gray-300" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* Accordion categories */}
      {!isSearching && (
        <div className="space-y-3">
          {visibleCategories.map((category) => {
            const Icon = category.icon;
            const isExpanded = expandedId === category.id;
            const popular = category.articles.slice(0, POPULAR_COUNT);
            const total = category.articles.length;

            return (
              <div
                key={category.id}
                className="rounded-2xl border border-[#F1F5F9] bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] overflow-hidden"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#FFF3E8] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#FF8C42]" />
                  </div>
                  <span className="flex-1 text-sm font-semibold text-gray-900">{category.title}</span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                    {total}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="border-t border-[#F1F5F9] px-3 pb-3 pt-1">
                    <ul className="divide-y divide-[#F1F5F9]">
                      {popular.map((article) => (
                        <li key={article.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-[#FF8C42] transition-colors group"
                            onClick={() => openArticle(article, category)}
                          >
                            <span className="text-sm text-gray-800 group-hover:text-[#FF8C42]">
                              {article.question}
                            </span>
                            <ChevronRight className="w-4 h-4 shrink-0 text-gray-300 group-hover:text-[#FF8C42]" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {total > POPULAR_COUNT && (
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-1 pt-2 text-sm font-medium text-[#FF8C42] hover:text-[#E07830]"
                        onClick={() => setCategorySheet(category)}
                      >
                        View all {total} articles
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom support CTA */}
      {!isSearching && (
        <div className="rounded-2xl border border-[#FF8C42]/15 bg-[#FFF8F3] p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Still need help?</h3>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Our support team is here for you. Create a ticket and we&apos;ll get back to you.
              </p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <Button
                type="button"
                onClick={onCreateTicket}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white text-sm font-medium gap-2 shadow-sm"
              >
                <Ticket className="w-4 h-4" />
                Create New Ticket
              </Button>
              <button
                type="button"
                onClick={onGoToTickets}
                className="text-sm font-medium text-[#FF8C42] hover:text-[#E07830] text-center sm:text-right"
              >
                Go to My Tickets →
              </button>
            </div>
          </div>
        </div>
      )}

      <SupportFaqCategorySheet
        open={Boolean(categorySheet)}
        category={categorySheet}
        onClose={() => setCategorySheet(null)}
        onSelectArticle={(article) => {
          if (categorySheet) {
            setCategorySheet(null);
            openArticle(article, categorySheet);
          }
        }}
      />

      <SupportFaqArticleSheet
        open={Boolean(selectedArticle)}
        article={selectedArticle}
        category={selectedCategory}
        onClose={() => {
          setSelectedArticle(null);
          setSelectedCategory(null);
        }}
      />
    </div>
  );
}
