import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { 
  ArrowLeft, MessageSquare, Clock, AlertCircle, CheckCircle, User,
  Search, Filter, Send, Paperclip, Eye, Tag, Calendar
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface TicketingSystemProps {
  onBack: () => void;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subject: string;
  description: string;
  category: 'technical' | 'billing' | 'order' | 'service' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  responseTime?: number; // in minutes
  resolutionTime?: number; // in minutes
  messages: TicketMessage[];
  tags: string[];
  relatedOrderId?: string;
  relatedBookingId?: string;
  satisfaction?: number; // 1-5 rating
}

interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderType: 'customer' | 'admin' | 'system';
  message: string;
  attachments?: string[];
  createdAt: string;
}

export function TicketingSystem({ onBack }: TicketingSystemProps) {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');

  // Stats
  const [stats, setStats] = useState({
    openCount: 0,
    inProgressCount: 0,
    avgResponseTime: 0,
    avgResolutionTime: 0,
    satisfactionScore: 0
  });

  useEffect(() => {
    loadTickets();
    loadStats();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [searchQuery, statusFilter, priorityFilter, tickets]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      // GET /make-server-3dd53475/admin/tickets
      // Mock data
      const mockTickets: Ticket[] = [
        {
          id: 'ticket_1',
          ticketNumber: 'TKT-2024-0001',
          customerId: 'cust_1',
          customerName: 'Rahul Sharma',
          customerEmail: 'rahul@example.com',
          customerPhone: '+919876543210',
          subject: 'Payment failed but amount deducted',
          description: 'I tried to book a grooming service but the payment failed. However, the amount was deducted from my account.',
          category: 'billing',
          priority: 'high',
          status: 'open',
          createdAt: '2024-12-02T10:30:00Z',
          updatedAt: '2024-12-02T10:30:00Z',
          messages: [
            {
              id: 'msg_1',
              ticketId: 'ticket_1',
              senderId: 'cust_1',
              senderName: 'Rahul Sharma',
              senderType: 'customer',
              message: 'I tried to book a grooming service but the payment failed. However, the amount was deducted from my account.',
              createdAt: '2024-12-02T10:30:00Z'
            }
          ],
          tags: ['payment', 'refund'],
          relatedBookingId: 'booking_123'
        },
        {
          id: 'ticket_2',
          ticketNumber: 'TKT-2024-0002',
          customerId: 'cust_2',
          customerName: 'Priya Patel',
          customerEmail: 'priya@example.com',
          customerPhone: '+919876543211',
          subject: 'Unable to login to my account',
          description: 'I forgot my password and the reset link is not working.',
          category: 'account',
          priority: 'medium',
          status: 'in_progress',
          assignedTo: 'admin_1',
          assignedToName: 'Support Agent 1',
          createdAt: '2024-12-01T14:20:00Z',
          updatedAt: '2024-12-02T09:15:00Z',
          responseTime: 45,
          messages: [
            {
              id: 'msg_2',
              ticketId: 'ticket_2',
              senderId: 'cust_2',
              senderName: 'Priya Patel',
              senderType: 'customer',
              message: 'I forgot my password and the reset link is not working.',
              createdAt: '2024-12-01T14:20:00Z'
            },
            {
              id: 'msg_3',
              ticketId: 'ticket_2',
              senderId: 'admin_1',
              senderName: 'Support Agent 1',
              senderType: 'admin',
              message: 'Hi Priya, I can help you with that. Let me reset your password manually. Please check your email in 5 minutes.',
              createdAt: '2024-12-02T09:15:00Z'
            }
          ],
          tags: ['login', 'password']
        },
        {
          id: 'ticket_3',
          ticketNumber: 'TKT-2024-0003',
          customerId: 'cust_3',
          customerName: 'Amit Kumar',
          customerEmail: 'amit@example.com',
          customerPhone: '+919876543212',
          subject: 'Order not delivered',
          description: 'My order was supposed to be delivered yesterday but I still have not received it.',
          category: 'order',
          priority: 'urgent',
          status: 'resolved',
          assignedTo: 'admin_2',
          assignedToName: 'Support Agent 2',
          createdAt: '2024-11-30T10:00:00Z',
          updatedAt: '2024-12-01T11:30:00Z',
          resolvedAt: '2024-12-01T11:30:00Z',
          responseTime: 30,
          resolutionTime: 1560, // 26 hours
          messages: [
            {
              id: 'msg_4',
              ticketId: 'ticket_3',
              senderId: 'cust_3',
              senderName: 'Amit Kumar',
              senderType: 'customer',
              message: 'My order was supposed to be delivered yesterday but I still have not received it.',
              createdAt: '2024-11-30T10:00:00Z'
            },
            {
              id: 'msg_5',
              ticketId: 'ticket_3',
              senderId: 'admin_2',
              senderName: 'Support Agent 2',
              senderType: 'admin',
              message: 'I have checked with our logistics partner. Your order will be delivered today by 6 PM. We apologize for the delay.',
              createdAt: '2024-11-30T10:30:00Z'
            },
            {
              id: 'msg_6',
              ticketId: 'ticket_3',
              senderId: 'cust_3',
              senderName: 'Amit Kumar',
              senderType: 'customer',
              message: 'Thank you! I received the order.',
              createdAt: '2024-12-01T11:30:00Z'
            }
          ],
          tags: ['delivery', 'logistics'],
          relatedOrderId: 'order_456',
          satisfaction: 4
        }
      ];

      setTickets(mockTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // GET /make-server-3dd53475/admin/tickets/stats
      setStats({
        openCount: 23,
        inProgressCount: 15,
        avgResponseTime: 18,
        avgResolutionTime: 245,
        satisfactionScore: 4.3
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filterTickets = () => {
    let filtered = tickets;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTickets(filtered);
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/tickets/{id}/reply
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/tickets/${selectedTicket.id}/reply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: replyMessage })
        }
      );

      if (response.ok) {
        toast.success('Reply sent successfully');
        setReplyMessage('');
        loadTickets();
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    setLoading(true);
    try {
      // PATCH /make-server-3dd53475/admin/tickets/{id}/status
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/tickets/${ticketId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        }
      );

      if (response.ok) {
        toast.success('Ticket status updated');
        loadTickets();
        loadStats();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const assignTicket = async (ticketId: string, assigneeId: string) => {
    try {
      // PATCH /make-server-3dd53475/admin/tickets/{id}/assign
      toast.success('Ticket assigned successfully');
      loadTickets();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast.error('Failed to assign ticket');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-yellow-100 text-yellow-700',
      waiting_customer: 'bg-purple-100 text-purple-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Support Tickets</h1>
                <p className="text-sm text-gray-500">Manage customer support requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 p-3 rounded-lg">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.openCount}</p>
                <p className="text-sm text-gray-500">Open</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 text-yellow-700 p-3 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgressCount}</p>
                <p className="text-sm text-gray-500">In Progress</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 text-green-700 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgResponseTime}m</p>
                <p className="text-sm text-gray-500">Avg Response</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 text-purple-700 p-3 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.floor(stats.avgResolutionTime / 60)}h</p>
                <p className="text-sm text-gray-500">Avg Resolution</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#FF8C42] text-white p-3 rounded-lg">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.satisfactionScore.toFixed(1)}</p>
                <p className="text-sm text-gray-500">Satisfaction</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
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

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Tickets List */}
        <div className="space-y-4">
          {filteredTickets.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No tickets found</p>
            </Card>
          ) : (
            filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedTicket(ticket);
                  setShowDetailsModal(true);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{ticket.subject}</h3>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{ticket.ticketNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="font-medium">{ticket.customerName}</p>
                    <p className="text-xs text-gray-500">{ticket.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="font-medium capitalize">{ticket.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{ticket.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {ticket.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {ticket.assignedToName && (
                      <p className="text-sm text-gray-500">Assigned to: {ticket.assignedToName}</p>
                    )}
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Ticket Details Modal */}
      {showDetailsModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(selectedTicket.priority)}>
                      {selectedTicket.priority}
                    </Badge>
                    <Badge className={getStatusColor(selectedTicket.status)}>
                      {selectedTicket.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-sm text-gray-500">{selectedTicket.ticketNumber}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowDetailsModal(false)}>
                  ✕
                </Button>
              </div>

              {/* Customer & Ticket Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedTicket.customerName}</p>
                  <p className="text-sm">{selectedTicket.customerEmail}</p>
                  <p className="text-sm">{selectedTicket.customerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium capitalize">{selectedTicket.category}</p>
                  {selectedTicket.assignedToName && (
                    <>
                      <p className="text-sm text-gray-500 mt-2">Assigned To</p>
                      <p className="font-medium">{selectedTicket.assignedToName}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Messages Thread */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Conversation</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedTicket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.senderType === 'customer'
                          ? 'bg-blue-50 ml-0 mr-12'
                          : 'bg-gray-50 ml-12 mr-0'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{message.senderName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reply Section */}
              {selectedTicket.status !== 'closed' && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Reply to Customer</h3>
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your response..."
                    rows={4}
                    className="mb-3"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={sendReply}
                      disabled={loading || !replyMessage.trim()}
                      className="bg-[#FF8C42] hover:bg-[#ff7a28]"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Reply
                    </Button>
                    <Button variant="outline">
                      <Paperclip className="w-4 h-4 mr-2" />
                      Attach File
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {selectedTicket.status === 'open' && (
                  <Button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Start Working
                  </Button>
                )}
                {(selectedTicket.status === 'in_progress' || selectedTicket.status === 'waiting_customer') && (
                  <Button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    Mark as Resolved
                  </Button>
                )}
                {selectedTicket.status === 'resolved' && (
                  <Button
                    onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                  >
                    Close Ticket
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
