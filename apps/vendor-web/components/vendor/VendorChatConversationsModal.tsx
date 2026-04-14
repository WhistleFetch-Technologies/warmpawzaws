'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Clock, User, Package } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useVendorChromeScrollLock } from '@/hooks/useVendorChromeScrollLock';

export interface VendorConversation {
  bookingId: string;
  bookingDate: string;
  bookingTime: string;
  bookingStatus: string;
  serviceType?: string;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  packageUtilization?: {
    packageName?: string;
    totalSessions?: number;
    remainingSessions?: number;
    usedSessions?: number;
    isUnlimited?: boolean;
    expiresAt?: string;
  } | null;
}

interface VendorChatConversationsModalProps {
  vendorId: string;
  vendorPhone?: string;
  vendorName?: string;
  open: boolean;
  onClose: () => void;
  onSelectConversation: (conversation: VendorConversation) => void;
}

export function VendorChatConversationsModal({
  vendorId,
  open,
  onClose,
  onSelectConversation,
}: VendorChatConversationsModalProps) {
  const [conversations, setConversations] = useState<VendorConversation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && vendorId) {
      setLoading(true);
      apiClient
        .get<{ success?: boolean; conversations?: VendorConversation[] }>(`/chat/vendor/${vendorId}/conversations`)
        .then((res) => {
          if (res?.conversations) setConversations(res.conversations);
          else setConversations([]);
        })
        .catch(() => setConversations([]))
        .finally(() => setLoading(false));
    }
  }, [open, vendorId]);

  useVendorChromeScrollLock(open);

  const formatTime = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatBookingTime = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    if (!timeStr) return date;
    const t = String(timeStr).substring(0, 5);
    return `${date} · ${t}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#FF8C42]" />
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No messages yet</p>
              <p className="text-sm mt-1">Chats from bookings will appear here</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.bookingId}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectConversation(conv);
                      onClose();
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900 truncate">{conv.customerName}</span>
                          {conv.unreadCount > 0 && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{conv.serviceName}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Booking {formatBookingTime(conv.bookingDate, conv.bookingTime)}</span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 capitalize">{conv.bookingStatus}</span>
                        </div>
                        {conv.packageUtilization && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-700">
                            <Package className="w-3.5 h-3.5" />
                            {conv.packageUtilization.isUnlimited
                              ? `Unlimited · ${conv.packageUtilization.expiresAt ? `Valid until ${new Date(conv.packageUtilization.expiresAt).toLocaleDateString()}` : 'Active'}`
                              : `${conv.packageUtilization.remainingSessions ?? 0} of ${conv.packageUtilization.totalSessions ?? 0} sessions left`}
                          </div>
                        )}
                        {conv.lastMessage && (
                          <p className="text-sm text-gray-500 truncate mt-1">{conv.lastMessage}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
