'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { hasAdminPortalPermission } from '@/lib/admin-permissions';

type ChatMessage = { role: 'user' | 'assistant'; text: string };

/**
 * Floating admin copilot (Bedrock). Shown only when `admin.ai_copilot` or full access is present
 * in localStorage after /admin/auth/me (same pattern as route guard).
 */
export function AdminCopilotPanel() {
  const pathname = usePathname() || '/';
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiClient.get<{ success?: boolean; permissions?: string[] }>('/admin/auth/me');
        if (cancelled || !me || me.success === false || !Array.isArray(me.permissions)) return;
        const perms = me.permissions.length ? me.permissions : ['admin.full_access'];
        if (typeof window !== 'undefined') {
          localStorage.setItem('adminPermissions', JSON.stringify(perms));
        }
        if (!cancelled) {
          setAllowed(
            hasAdminPortalPermission(['admin.ai_copilot', 'admin.full_access', '*'])
          );
        }
      } catch {
        if (!cancelled) {
          setAllowed(
            hasAdminPortalPermission(['admin.ai_copilot', 'admin.full_access', '*'])
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await apiClient.postAdminAiCopilotChat({
        message: text,
        pathname,
        conversationId,
      });
      if (res.conversationId) setConversationId(res.conversationId);
      const reply =
        res.response ||
        (res.success === false ? res.error || 'Something went wrong.' : 'No response.');
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setMessages((m) => [...m, { role: 'assistant', text: msg }]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, input, loading, pathname]);

  if (!allowed) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Open admin copilot"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition"
      >
        <MessageCircle className="h-7 w-7" />
      </button>

      {open ? (
        <div className="fixed bottom-6 right-6 z-50 flex w-[min(100vw-2rem,24rem)] flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Admin copilot</span>
            <button
              type="button"
              aria-label="Close"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div ref={listRef} className="max-h-80 overflow-y-auto px-3 py-2 space-y-2 text-sm">
            {messages.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">Ask about the admin portal or pending work.</p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 ${
                    msg.role === 'user' ? 'bg-orange-50 text-gray-900 ml-4' : 'bg-gray-50 text-gray-800 mr-4'
                  }`}
                >
                  {msg.text}
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
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              placeholder="Message…"
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
              className="rounded-lg bg-orange-500 px-3 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
