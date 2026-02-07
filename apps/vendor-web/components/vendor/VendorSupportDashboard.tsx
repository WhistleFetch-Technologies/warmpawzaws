'use client';

import React, { useState, useEffect } from 'react';
import {
  Button,
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  MessageCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  Ticket as TicketIcon,
  BarChart3,
} from 'lucide-react';
import { CreateTicketModal } from './CreateTicketModal';
import { TicketDetailModal } from './TicketDetailModal';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string;
}

interface VendorSupportDashboardProps {
  vendorId: string;
}

export function VendorSupportDashboard({ vendorId }: VendorSupportDashboardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTickets();
    loadStats();
  }, [vendorId, filterStatus, filterCategory]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ vendorId });
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterCategory !== 'all') params.append('category', filterCategory);

      const res = await apiClient.get<any>(`/vendor/support/tickets?${params.toString()}`);

      if (res.success) {
        setTickets(res.tickets || []);
      } else {
        toast.error(res.error || 'Failed to load tickets');
      }
    } catch (error: any) {
      console.error('Error loading tickets:', error);
      toast.error(error.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await apiClient.get<any>(`/vendor/support/stats?vendorId=${vendorId}`);
      if (res.success) {
        setStats(res.stats || {});
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
  };

  const handleTicketCreated = () => {
    loadTickets();
    loadStats();
  };

  const handleTicketUpdated = () => {
    loadTickets();
    loadStats();
    setShowDetailModal(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'text-gray-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-orange-600';
      case 'urgent':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const filteredTickets = tickets.filter((ticket) =>
    searchQuery
      ? ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your support requests and get help from our team
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              New Ticket
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total || 0}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600">Open</p>
                  <p className="text-2xl font-bold text-red-700">
                    {stats.open || 0}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-yellow-600">In Progress</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {stats.in_progress || 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600">Resolved</p>
                  <p className="text-2xl font-bold text-green-700">
                    {stats.resolved || 0}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Closed</p>
                  <p className="text-2xl font-bold text-gray-700">
                    {stats.closed || 0}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search tickets by subject or number..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="booking">Booking</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button variant="outline" onClick={loadTickets} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Tickets List */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <TicketIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No tickets found' : 'No support tickets yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Create your first ticket to get support from our team'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Ticket
                </Button>
              )}
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleViewTicket(ticket)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {ticket.subject}
                      </h3>
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {ticket.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <TicketIcon className="w-3 h-3" />
                        {ticket.ticket_number}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1 capitalize">
                        {ticket.category}
                      </div>
                      <div className={`flex items-center gap-1 font-semibold ${getPriorityColor(ticket.priority)}`}>
                        <AlertCircle className="w-3 h-3" />
                        {ticket.priority}
                      </div>
                      {ticket.message_count && ticket.message_count > 0 && (
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {ticket.message_count} messages
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTicketModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        vendorId={vendorId}
        onTicketCreated={handleTicketCreated}
      />

      {selectedTicket && (
        <TicketDetailModal
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          ticketId={selectedTicket.id}
          vendorId={vendorId}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </div>
  );
}
