'use client';

import React, { useState, useEffect } from 'react';
import { Store, Search, MessageCircle, Phone, Mail, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorTicket {
  ticketId: string;
  ticketNumber: string;
  vendorId: string;
  vendorName: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  lastMessage?: string;
}

export function SupportVendorTab() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<VendorTicket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/support/vendor-tickets');
      setTickets(data.tickets || []);
    } catch (error) {
      console.error('Error loading vendor tickets:', error);
      alert('Failed to load vendor tickets');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            placeholder="Search vendor tickets..."
            className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTickets.map((ticket) => (
          <div key={ticket.ticketId} className="bg-white rounded-xl border-2 border-gray-200 p-0 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-0">
              <div className="flex items-center gap-3">
                <div className="p-0 bg-orange-100 rounded-lg">
                  <Store className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{ticket.vendorName}</p>
                  <p className="text-sm text-gray-600">{ticket.ticketNumber}</p>
                </div>
              </div>
              <span className={`px-0 py-0 text-xs font-medium rounded ${
                ticket.status === 'open' ? 'bg-gray-100 text-gray-700' :
                ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-500'
              }`}>
                {ticket.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-gray-900 font-medium mb-0">{ticket.subject}</p>
            <p className="text-sm text-gray-600 mb-0">{ticket.category}</p>
            {ticket.lastMessage && (
              <p className="text-sm text-gray-500 mb-0 line-clamp-0">{ticket.lastMessage}</p>
            )}
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
              <div className="flex gap-3">
                <button className="p-0 hover:bg-gray-100 rounded-lg">
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button className="p-0 hover:bg-gray-100 rounded-lg">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="p-0 hover:bg-gray-100 rounded-lg">
                  <Mail className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
