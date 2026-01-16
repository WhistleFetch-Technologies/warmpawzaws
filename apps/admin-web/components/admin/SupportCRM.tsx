'use client';

import React, { useState, useEffect } from 'react';
import { Headphones, Search, Filter, MessageSquare, Clock, CheckCircle, AlertCircle, User } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Ticket {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  customerName: string;
  customerEmail: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  responseTime?: number;
  resolutionTime?: number;
}

interface Stats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  avgResponseTime: number;
  avgResolutionTime: number;
}

export function SupportCRM() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    avgResponseTime: 0,
    avgResolutionTime: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ticketsData, statsData] = await Promise.all([
        apiClient.get<any>('/admin/support/tickets'),
        apiClient.get<any>('/admin/support/stats'),
      ]);

      if (ticketsData.success) setTickets(ticketsData.tickets || []);
      if (statsData.success) setStats(statsData.stats);
    } catch (error) {
      console.error('Error loading support data:', error);
      alert('Failed to load support data');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-blue-100 text-blue-700';
    }
  };

  const getStatusColor = (status: Ticket['status']) => {
    switch (status) {
      case 'open':
        return 'bg-gray-100 text-gray-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'resolved':
        return 'bg-green-100 text-green-700';
      case 'closed':
        return 'bg-gray-100 text-gray-500';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-0 bg-blue-100 rounded-xl">
          <Headphones className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support CRM</h1>
          <p className="text-sm text-gray-600">Manage customer support tickets</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Total Tickets</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalTickets}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Open</p>
          <p className="text-2xl font-bold text-gray-700">{stats.openTickets}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgressTickets}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Resolved</p>
          <p className="text-2xl font-bold text-green-600">{stats.resolvedTickets}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Avg Response</p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgResponseTime}m</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Avg Resolution</p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgResolutionTime}h</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTickets.map((ticket) => (
              <tr key={ticket.ticketId} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-0 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{ticket.ticketNumber}</p>
                    <p className="text-sm text-gray-600 line-clamp-0">{ticket.subject}</p>
                  </div>
                </td>
                <td className="px-0 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{ticket.customerName}</p>
                    <p className="text-sm text-gray-600">{ticket.customerEmail}</p>
                  </div>
                </td>
                <td className="px-0 py-4 text-sm text-gray-900">{ticket.category}</td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority.toUpperCase()}
                  </span>
                </td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-900">
                  {ticket.assignedTo || <span className="text-gray-400">Unassigned</span>}
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTickets.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-0" />
            <p className="text-gray-500">No tickets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
