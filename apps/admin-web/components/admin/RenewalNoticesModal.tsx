'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface RenewalNotice {
  noticeId: string;
  vendorName: string;
  itemType: 'license' | 'insurance' | 'subscription';
  expiryDate: string;
  daysRemaining: number;
}

interface RenewalNoticesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RenewalNoticesModal({ isOpen, onClose }: RenewalNoticesModalProps) {
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<RenewalNotice[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadNotices();
    }
  }, [isOpen]);

  const loadNotices = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/renewals/notices');
      setNotices(data.notices || []);
    } catch (error) {
      console.error('Error loading renewal notices:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Renewal Notices</h3>
          <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-0">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-02">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-0" />
              <p className="text-gray-500">No renewal notices</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div key={notice.noticeId} className="p-4 border-2 border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{notice.vendorName}</p>
                      <p className="text-sm text-gray-600">{notice.itemType} expires on {new Date(notice.expiryDate).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-0 py-1 text-xs font-medium rounded ${
                      notice.daysRemaining <= 7 ? 'bg-red-100 text-red-700' :
                      notice.daysRemaining <= 30 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {notice.daysRemaining} days
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
