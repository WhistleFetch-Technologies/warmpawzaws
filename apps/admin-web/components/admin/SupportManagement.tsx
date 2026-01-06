'use client';

import React, { useState } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { TicketsTab } from './support/TicketsTab';
import { ChatTab } from './support/ChatTab';

interface SupportManagementProps {
  onBack?: () => void;
}

export function SupportManagement({ onBack }: SupportManagementProps) {
  const [activeTab, setActiveTab] = useState<'tickets' | 'chat'>('tickets');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-3 text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Support Management</h1>
              <p className="text-sm text-gray-500">Manage customer support</p>
            </div>
          </div>
        </div>
        <div className="flex border-t border-gray-200">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tickets' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Tickets
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Chat
          </button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'tickets' && <TicketsTab />}
        {activeTab === 'chat' && <ChatTab />}
      </div>
    </div>
  );
}

