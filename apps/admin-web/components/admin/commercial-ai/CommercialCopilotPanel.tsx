'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Bot, Loader2, Send, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { hasAdminPortalPermission } from '@/lib/admin-permissions';
import { isCommercialAdminRoute, tabFromSearchParams } from '@/lib/commercial-ai/commercial-routes';
import {
  buildContextFromPathname,
  intentBadgeLabel,
  sourceBadgeLabel,
  type CommercialAiIntent,
  type CommercialAiSource,
} from '@/lib/commercial-ai/types';
import {
  mergeCommercialContext,
  useCommercialAiOptional,
} from '@/context/CommercialAiContext';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  intent?: CommercialAiIntent;
  source?: CommercialAiSource;
};

export function CommercialCopilotPanel() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const commercialAi = useCommercialAiOptional();
  const onCommercialRoute = isCommercialAdminRoute(pathname);

  const [allowed, setAllowed] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const tab = tabFromSearchParams(searchParams?.toString() ?? '');
  const baseContext = useMemo(
    () => buildContextFromPathname(pathname, tab),
    [pathname, tab]
  );
  const context = useMemo(
    () => mergeCommercialContext(baseContext, commercialAi?.entity ?? null),
    [baseContext, commercialAi?.entity]
  );

  useEffect(() => {
    if (!onCommercialRoute) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiClient.get<{ success?: boolean; permissions?: string[] }>('/admin/auth/me');
        if (!cancelled && me?.permissions) {
          localStorage.setItem('adminPermissions', JSON.stringify(me.permissions));
        }
      } catch {
        /* fallback localStorage */
      }
      if (!cancelled) {
        setAllowed(hasAdminPortalPermission(['admin.ai_copilot', 'admin.full_access', '*']));
      }
      try {
        const health = await apiClient.get<{ commercialCopilotEnabled?: boolean }>(
          '/admin/commercial-ai-copilot/health'
        );
        if (!cancelled) setEnabled(health.commercialCopilotEnabled !== false);
      } catch {
        if (!cancelled) setEnabled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onCommercialRoute]);

  useEffect(() => {
    if (!onCommercialRoute || !open) return;
    void (async () => {
      try {
        const res = await apiClient.get<{ suggestions: string[] }>(
          `/admin/commercial-ai-copilot/suggestions?module=${context.module}${context.entity?.name ? `&entityName=${encodeURIComponent(context.entity.name)}` : ''}`
        );
        setSuggestions(res.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    })();
  }, [onCommercialRoute, open, context.module, context.entity?.name]);

  useEffect(() => {
    if (commercialAi?.pendingOpen) {
      setOpen(true);
      const prefill = commercialAi.consumePrefill();
      if (prefill) setInput(prefill);
      commercialAi.clearPendingOpen();
    }
  }, [commercialAi?.pendingOpen, commercialAi]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || loading) return;
      setInput('');
      setMessages((m) => [...m, { role: 'user', text }]);
      setLoading(true);
      try {
        const res = await apiClient.postCommercialAiCopilotChat({
          message: text,
          pathname,
          conversationId,
          context,
        });
        if (res.conversationId) setConversationId(res.conversationId);
        const reply =
          res.response ||
          (res.success === false ? res.error || 'Something went wrong.' : 'No response.');
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: reply,
            intent: res.intent,
            source: res.source,
          },
        ]);
        if (res.suggestedQuestions?.length) setSuggestions(res.suggestedQuestions);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setMessages((m) => [...m, { role: 'assistant', text: msg }]);
      } finally {
        setLoading(false);
      }
    },
    [context, conversationId, input, loading, pathname]
  );

  if (!onCommercialRoute || !allowed || !enabled) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open Commercial Copilot"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition"
      >
        <Bot className="h-7 w-7" />
      </button>

      {open ? (
        <div className="fixed bottom-6 right-6 z-50 flex w-[min(100vw-2rem,26rem)] flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-gray-900">Commercial Copilot</span>
              <p className="text-[10px] text-gray-500">
                {context.module} · {context.discountDomain}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {suggestions.length ? (
            <div className="flex flex-wrap gap-1 border-b border-gray-50 px-3 py-2">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-800 hover:bg-indigo-100"
                  onClick={() => void send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <div ref={listRef} className="max-h-80 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {messages.length === 0 ? (
              <p className="text-gray-500 py-4 text-center text-xs">
                Ask about promotions, campaigns, policy, settlement, or analytics on this page.
              </p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 ${
                    msg.role === 'user' ? 'bg-indigo-50 text-gray-900 ml-4' : 'bg-gray-50 text-gray-800 mr-4'
                  }`}
                >
                  {msg.role === 'assistant' && msg.intent ? (
                    <div className="mb-1 flex flex-wrap gap-1">
                      <span className="rounded border px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                        {intentBadgeLabel(msg.intent)}
                      </span>
                      {msg.source ? (
                        <span className="rounded border px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                          {sourceBadgeLabel(msg.source)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))
            )}
            {loading ? (
              <div className="flex justify-center py-2 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-gray-100 p-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Commercial question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void send()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
