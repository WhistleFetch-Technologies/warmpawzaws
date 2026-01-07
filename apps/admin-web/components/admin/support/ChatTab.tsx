'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { MessageSquare, Loader2 } from 'lucide-react';

interface ChatSession {
  id: string;
  customerId: string;
  customerName: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
}

export function ChatTab() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChatSessions();
  }, []);

  const loadChatSessions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/support/chat-sessions');
      if (response.success && response.sessions) {
        setSessions(response.sessions);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-gray-300 cursor-pointer transition-colors"
        >
          <div className="flex items-start gap-0">
            <MessageSquare className="w-5 h-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{session.customerName}</h3>
              <p className="text-sm text-gray-600 mt-0">{session.lastMessage}</p>
              {session.unreadCount > 0 && (
                <span className="inline-block mt-0 text-xs px-0 py-0 bg-orange-100 text-orange-700 rounded">
                  {session.unreadCount} unread
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

