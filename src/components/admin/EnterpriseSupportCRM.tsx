/**
 * Enterprise-Grade Support CRM System
 * 
 * Features:
 * - AI Bot conversation history integration
 * - Human agent handoff with full context
 * - Real-time chat interface
 * - Agent actions (refund, partial refund, escalate, etc.)
 * - Customer context and order history
 * - Sidebar preservation
 * - Ticket management with priority
 * - Agent assignment and workload management
 * 
 * Inspired by: Amazon, Zomato, Urban Clap, Practo support systems
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MessageSquare, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  RefreshCw,
  Send,
  User,
  AlertTriangle,
  Ticket,
  DollarSign,
  ArrowLeft,
  Bot,
  UserCircle,
  Phone,
  Mail as MailIcon,
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  FileText,
  MoreVertical,
  Copy,
  ExternalLink,
  Zap,
  Shield,
  Ban,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  MessageCircle,
  History,
  Settings,
  Users,
  BarChart3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

// Types
interface Ticket {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  source: 'chat' | 'email' | 'phone' | 'ai_handoff' | 'self_service';
  category?: 'refund' | 'order' | 'service' | 'technical' | 'billing' | 'general';
  assignedTo?: string;
  assignedAgent?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  aiConversationId?: string;
  aiMessages?: AIConversationMessage[];
  messages?: TicketMessage[];
  relatedOrderId?: string;
  relatedBookingId?: string;
  tags?: string[];
  satisfactionRating?: number;
}

interface TicketMessage {
  id: string;
  sender: string;
  senderId?: string;
  content: string;
  timestamp: string;
  role: 'agent' | 'customer' | 'system' | 'ai';
  attachments?: string[];
  action?: 'refund_initiated' | 'partial_refund' | 'escalated' | 'resolved' | 'reopened';
  metadata?: Record<string, any>;
}

interface AIConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
}

interface CustomerContext {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  recentOrders?: Array<{
    id: string;
    date: string;
    amount: number;
    status: string;
  }>;
  recentBookings?: Array<{
    id: string;
    date: string;
    service: string;
    status: string;
  }>;
}

interface AgentAction {
  type: 'refund' | 'partial_refund' | 'escalate' | 'resolve' | 'reopen' | 'assign' | 'add_note';
  ticketId: string;
  amount?: number;
  reason?: string;
  note?: string;
  assignTo?: string;
}

export function EnterpriseSupportCRM({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerContext | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundReason, setRefundReason] = useState('');
  const [activeTab, setActiveTab] = useState<'tickets' | 'analytics' | 'settings'>('tickets');
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
    escalated: 0,
    avgResponseTime: 0,
    satisfaction: 0
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedTicketRef = useRef<Ticket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [agentMetrics, setAgentMetrics] = useState<any>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyTicketId, setSurveyTicketId] = useState<string | null>(null);
  const [showPartialRefundModal, setShowPartialRefundModal] = useState(false);
  const [partialRefundAmount, setPartialRefundAmount] = useState('');

  // Real-time WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${projectId}.supabase.co/functions/v1/make-server-3dd53475/ws/support`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ [Support WS] Connected');
        setWsConnected(true);
        // Subscribe to all ticket updates
        ws.send(JSON.stringify({ type: 'subscribe', topic: 'tickets' }));
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          if (update.type === 'ticket_update') {
            // Update ticket in list
            setTickets(prev => prev.map(t => 
              t.id === update.ticketId ? { ...t, ...update.data } : t
            ));
            // Update selected ticket if it's the one being updated (using ref to avoid stale closure)
            const currentSelected = selectedTicketRef.current;
            if (currentSelected?.id === update.ticketId) {
              setSelectedTicket(prev => prev ? { ...prev, ...update.data } : null);
            }
            toast.info(`Ticket ${update.ticketId} updated`);
          } else if (update.type === 'new_message') {
            // Add new message to selected ticket (using ref to avoid stale closure)
            const currentSelected = selectedTicketRef.current;
            if (currentSelected?.id === update.ticketId) {
              setSelectedTicket(prev => prev ? {
                ...prev,
                messages: [...(prev.messages || []), update.message]
              } : null);
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ [Support WS] Error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('🔌 [Support WS] Disconnected');
        setWsConnected(false);
        // Reconnect after 5 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            // Reconnect logic handled by useEffect
          }
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    loadTickets();
    loadStats();
    loadAgentMetrics();
  }, []);

  // Keep ref in sync with selectedTicket state
  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);

  useEffect(() => {
    if (selectedTicket) {
      loadCustomerContext(selectedTicket.customerId);
      loadAIConversation(selectedTicket.aiConversationId);
    }
  }, [selectedTicket]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedTicket?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/tickets`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/tickets/${ticketId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(data.ticket);
        }
        // Update in list
        setTickets(prev => prev.map(t => t.id === ticketId ? data.ticket : t));
      }
    } catch (error) {
      console.error('Failed to load ticket details:', error);
    }
  };

  const loadAgentMetrics = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/analytics/agents`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAgentMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to load agent metrics:', error);
    }
  };

  const loadCustomerContext = async (customerId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/customer/${customerId}/context`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setCustomerContext(data.context);
      }
    } catch (error) {
      console.error('Failed to load customer context:', error);
    }
  };

  const loadAIConversation = async (conversationId?: string) => {
    if (!conversationId) return;
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ai-chatbot/conversation/${conversationId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (selectedTicket) {
          setSelectedTicket({
            ...selectedTicket,
            aiMessages: data.messages || []
          });
        }
      }
    } catch (error) {
      console.error('Failed to load AI conversation:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/stats`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ticketId: selectedTicket.id,
            message: replyText,
            agentName: 'Admin Agent',
            agentId: 'admin_1'
          })
        }
      );

      if (response.ok) {
        toast.success('Reply sent successfully');
        setReplyText('');
        loadTicketDetails(selectedTicket.id);
      } else {
        toast.error('Failed to send reply');
      }
    } catch (error) {
      toast.error('Failed to send reply');
    }
  };

  const handleAction = async (action: AgentAction) => {
    if (!selectedTicket) return;

    try {
      // For refund actions, integrate with Razorpay
      if ((action.type === 'refund' || action.type === 'partial_refund') && action.amount) {
        // First process the refund via Razorpay
        const refundResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/refund/process`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({
              ticketId: selectedTicket.id,
              amount: action.amount,
              reason: action.reason || 'Support agent refund',
              orderId: selectedTicket.relatedOrderId,
              paymentId: selectedTicket.relatedOrderId // Will be fetched from order
            })
          }
        );

        if (!refundResponse.ok) {
          const errorData = await refundResponse.json();
          toast.error(errorData.error || 'Failed to process refund');
          return;
        }
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ticketId: selectedTicket.id,
            action: action.type,
            amount: action.amount,
            reason: action.reason,
            note: action.note,
            assignTo: action.assignTo
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Action completed successfully');
        setShowRefundModal(false);
        setShowActionMenu(false);
        loadTicketDetails(selectedTicket.id);
        loadTickets();
        loadStats();
        
        // If ticket is resolved, trigger satisfaction survey
        if (action.type === 'resolve' && selectedTicket.status !== 'resolved') {
          setTimeout(() => {
            setSurveyTicketId(selectedTicket.id);
            setShowSurveyModal(true);
          }, 2000);
        }
      } else {
        toast.error('Failed to perform action');
      }
    } catch (error) {
      toast.error('Failed to perform action');
    }
  };

  const handleSurveySubmit = async (rating: number, feedback: string) => {
    if (!surveyTicketId) return;
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            ticketId: surveyTicketId,
            rating,
            feedback
          })
        }
      );

      if (response.ok) {
        toast.success('Thank you for your feedback!');
        setShowSurveyModal(false);
        setSurveyTicketId(null);
        loadStats(); // Update satisfaction stats
      }
    } catch (error) {
      toast.error('Failed to submit survey');
    }
  };

  const handleRefund = async () => {
    if (!selectedTicket) return;
    
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    await handleAction({
      type: refundType === 'full' ? 'refund' : 'partial_refund',
      ticketId: selectedTicket.id,
      amount,
      reason: refundReason || 'Customer request via support'
    });
  };

  const handleStatusChange = async (status: Ticket['status']) => {
    if (!selectedTicket) return;
    
    await handleAction({
      type: status === 'resolved' ? 'resolve' : status === 'escalated' ? 'escalate' : 'reopen',
      ticketId: selectedTicket.id,
      reason: `Status changed to ${status}`
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'escalated': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesSearch = !searchQuery || 
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Preserved */}
      <UnifiedAdminSidebar activeView="support" onNavigate={onNavigate || (() => {})} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enterprise Support & CRM</h1>
              <p className="text-sm text-gray-500 mt-1">Manage customer support tickets with AI integration</p>
            </div>
            <div className="flex items-center gap-3">
              {wsConnected && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Live
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={loadTickets} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tickets' | 'analytics' | 'settings')} className="border-t border-gray-200">
            <TabsList className="bg-transparent h-auto p-0">
              <TabsTrigger value="tickets" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-[#FF8C42]">
                <Ticket className="w-4 h-4 mr-2" />
                Tickets
              </TabsTrigger>
              <TabsTrigger value="analytics" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-[#FF8C42]">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-[#FF8C42]">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Stats Bar */}
          <div className="grid grid-cols-6 gap-4 mt-4">
            <Card className="p-3">
              <div className="text-xs text-gray-500">Open</div>
              <div className="text-xl font-bold text-red-600">{stats.open}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">In Progress</div>
              <div className="text-xl font-bold text-yellow-600">{stats.inProgress}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Resolved</div>
              <div className="text-xl font-bold text-green-600">{stats.resolved}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Escalated</div>
              <div className="text-xl font-bold text-purple-600">{stats.escalated}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Avg Response</div>
              <div className="text-xl font-bold text-blue-600">{stats.avgResponseTime}m</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Satisfaction</div>
              <div className="text-xl font-bold text-orange-600">{stats.satisfaction}%</div>
            </Card>
          </div>
        </div>

        {/* Main Content Area */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tickets' | 'analytics' | 'settings')} className="flex-1 flex flex-col overflow-hidden">
          <TabsContent value="tickets" className="flex-1 flex overflow-hidden m-0 p-0">
            <div className="flex-1 flex overflow-hidden">
              {/* Tickets List */}
              <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
            {/* Filters */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
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

            {/* Tickets List */}
            <div className="flex-1 overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Ticket className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No tickets found</p>
                </div>
              ) : (
                filteredTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-orange-50 ${
                      selectedTicket?.id === ticket.id ? 'bg-orange-50 border-l-4 border-l-[#FF8C42]' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={`${getPriorityColor(ticket.priority)} text-xs`}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate mb-1">{ticket.subject}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">{ticket.description}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{ticket.customerName || ticket.customerId}</span>
                      </div>
                      {ticket.aiConversationId && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <Bot className="w-3 h-3" />
                          <span>AI Handoff</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Ticket Detail View */}
          <div className="flex-1 flex flex-col bg-gray-50">
            {selectedTicket ? (
              <>
                {/* Ticket Header */}
                <div className="bg-white border-b border-gray-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">#{selectedTicket.id}</h1>
                        <Badge className={getStatusColor(selectedTicket.status)}>
                          {selectedTicket.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={getPriorityColor(selectedTicket.priority)}>
                          {selectedTicket.priority}
                        </Badge>
                        {selectedTicket.source === 'ai_handoff' && (
                          <Badge variant="outline" className="border-blue-200 text-blue-700">
                            <Bot className="w-3 h-3 mr-1" />
                            AI Handoff
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-lg font-medium text-gray-700 mb-2">{selectedTicket.subject}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{selectedTicket.customerName || selectedTicket.customerId}</span>
                        </div>
                        <span className="text-gray-300">|</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                        </div>
                        {selectedTicket.category && (
                          <>
                            <span className="text-gray-300">|</span>
                            <Badge variant="outline">{selectedTicket.category}</Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="w-4 h-4 mr-2" />
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setRefundType('full');
                            setRefundAmount('');
                            setRefundReason('');
                            setShowRefundModal(true);
                          }}>
                            <DollarSign className="w-4 h-4 mr-2" />
                            Issue Refund
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setRefundType('partial');
                            setPartialRefundAmount('');
                            setRefundReason('');
                            setShowPartialRefundModal(true);
                          }}>
                            <TrendingDown className="w-4 h-4 mr-2" />
                            Partial Refund
                          </DropdownMenuItem>
                          {selectedTicket.status !== 'escalated' && (
                            <DropdownMenuItem onClick={() => handleStatusChange('escalated')}>
                              <Zap className="w-4 h-4 mr-2" />
                              Escalate
                            </DropdownMenuItem>
                          )}
                          {selectedTicket.status !== 'resolved' && (
                            <DropdownMenuItem onClick={() => handleStatusChange('resolved')}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Mark Resolved
                            </DropdownMenuItem>
                          )}
                          {selectedTicket.status === 'resolved' && (
                            <DropdownMenuItem onClick={() => handleStatusChange('open')}>
                              <X className="w-4 h-4 mr-2" />
                              Reopen
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Main Content Tabs */}
                <Tabs defaultValue="conversation" className="flex-1 flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-gray-200 px-6">
                    <TabsList>
                      <TabsTrigger value="conversation">Conversation</TabsTrigger>
                      <TabsTrigger value="customer">Customer Context</TabsTrigger>
                      <TabsTrigger value="ai-history">AI History</TabsTrigger>
                      <TabsTrigger value="details">Details</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="conversation" className="flex-1 flex flex-col overflow-hidden m-0">
                    {/* Conversation Thread */}
                    <div 
                      ref={chatContainerRef}
                      className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
                    >
                      {/* Original Issue */}
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-orange-600" />
                          <h4 className="text-sm font-bold text-orange-900">Original Request</h4>
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
                        <div className="mt-2 text-xs text-gray-500">
                          Created: {new Date(selectedTicket.createdAt).toLocaleString()}
                        </div>
                      </div>
                      
                      {/* Messages */}
                      {selectedTicket.messages?.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-xl p-4 ${
                            msg.role === 'agent' 
                              ? 'bg-[#FF8C42] text-white rounded-tr-none' 
                              : msg.role === 'ai'
                              ? 'bg-blue-50 border border-blue-200 text-gray-800 rounded-tl-none'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                          }`}>
                            <div className="flex items-center gap-2 mb-1 opacity-90 text-xs">
                              {msg.role === 'ai' && <Bot className="w-3 h-3" />}
                              {msg.role === 'agent' && <UserCircle className="w-3 h-3" />}
                              <span className="font-bold">{msg.sender}</span>
                              <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            {msg.action && (
                              <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-90">
                                <Badge variant="outline" className="bg-white/20 text-white border-white/30">
                                  Action: {msg.action.replace('_', ' ')}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply Area */}
                    {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                      <div className="bg-white border-t border-gray-200 p-4">
                        <div className="flex gap-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply..."
                            className="flex-1 min-h-[80px]"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleReply();
                              }
                            }}
                          />
                          <Button onClick={handleReply} className="bg-[#FF8C42] hover:bg-[#FF7029] self-end">
                            <Send className="w-4 h-4 mr-2" />
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="customer" className="flex-1 overflow-y-auto p-6 m-0">
                    {customerContext ? (
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Customer Information</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-500">Name</div>
                                <div className="font-medium">{customerContext.name || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Phone</div>
                                <div className="font-medium">{customerContext.phone || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Email</div>
                                <div className="font-medium">{customerContext.email || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Total Orders</div>
                                <div className="font-medium">{customerContext.totalOrders || 0}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Total Spent</div>
                                <div className="font-medium">₹{customerContext.totalSpent?.toLocaleString() || '0'}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {customerContext.recentOrders && customerContext.recentOrders.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Recent Orders</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {customerContext.recentOrders.map(order => (
                                  <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div>
                                      <div className="font-medium">Order #{order.id}</div>
                                      <div className="text-sm text-gray-500">{order.date}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium">₹{order.amount.toLocaleString()}</div>
                                      <Badge variant="outline">{order.status}</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Loading customer context...</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="ai-history" className="flex-1 overflow-y-auto p-6 m-0">
                    {selectedTicket.aiMessages && selectedTicket.aiMessages.length > 0 ? (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="w-5 h-5 text-blue-600" />
                            <h3 className="font-semibold text-blue-900">AI Bot Conversation</h3>
                          </div>
                          <p className="text-sm text-blue-700">
                            This ticket was escalated from an AI bot conversation. Below is the full conversation history.
                          </p>
                        </div>
                        {selectedTicket.aiMessages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[75%] rounded-xl p-4 ${
                              msg.role === 'user'
                                ? 'bg-white border border-gray-200'
                                : 'bg-blue-100 border border-blue-200'
                            }`}>
                              <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                                {msg.role === 'assistant' && <Bot className="w-3 h-3" />}
                                <span className="font-medium">{msg.role === 'user' ? 'Customer' : 'AI Assistant'}</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                {msg.intent && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {msg.intent}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Bot className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No AI conversation history available</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="flex-1 overflow-y-auto p-6 m-0">
                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Ticket Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-gray-500">Ticket ID</div>
                              <div className="font-medium">{selectedTicket.id}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Status</div>
                              <Badge className={getStatusColor(selectedTicket.status)}>
                                {selectedTicket.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Priority</div>
                              <Badge className={getPriorityColor(selectedTicket.priority)}>
                                {selectedTicket.priority}
                              </Badge>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Source</div>
                              <div className="font-medium capitalize">{selectedTicket.source.replace('_', ' ')}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Created</div>
                              <div className="font-medium">{new Date(selectedTicket.createdAt).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Last Updated</div>
                              <div className="font-medium">{new Date(selectedTicket.updatedAt).toLocaleString()}</div>
                            </div>
                            {selectedTicket.resolvedAt && (
                              <div>
                                <div className="text-sm text-gray-500">Resolved</div>
                                <div className="font-medium">{new Date(selectedTicket.resolvedAt).toLocaleString()}</div>
                              </div>
                            )}
                            {selectedTicket.assignedAgent && (
                              <div>
                                <div className="text-sm text-gray-500">Assigned To</div>
                                <div className="font-medium">{selectedTicket.assignedAgent}</div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {selectedTicket.relatedOrderId && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Related Order</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Order #{selectedTicket.relatedOrderId}</div>
                                <Button variant="link" size="sm" className="p-0 h-auto">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View Order
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Select a ticket to view details</p>
                </div>
              </div>
            )}
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="flex-1 overflow-y-auto p-6 m-0">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Performance Metrics</h2>
              {agentMetrics ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentMetrics.map((agent: any) => (
                    <Card key={agent.agentId}>
                      <CardHeader>
                        <CardTitle className="text-lg">{agent.agentName}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Tickets</span>
                          <span className="font-semibold">{agent.totalTickets}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Resolved</span>
                          <span className="font-semibold text-green-600">{agent.resolved}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Resolution Rate</span>
                          <span className="font-semibold">{agent.resolutionRate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Satisfaction</span>
                          <span className="font-semibold text-orange-600">{agent.satisfaction}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Loading agent metrics...</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-y-auto p-6 m-0">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Support Settings</h2>
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Routing</CardTitle>
                  <CardDescription>Automatically assign tickets based on category and priority</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Enable Auto-Routing</p>
                        <p className="text-sm text-gray-500">Automatically assign new tickets to available agents</p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Refund Modal */}
      <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              Process a refund for this ticket. The refund will be processed to the original payment method.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Refund Processing</p>
                <p className="text-yellow-700 mt-1">
                  Refunds are typically processed within 5-7 business days to the original payment method.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Refund Type</label>
              <Select value={refundType} onValueChange={(v: 'full' | 'partial') => setRefundType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Refund</SelectItem>
                  <SelectItem value="partial">Partial Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Refund Amount (₹)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-9"
                  placeholder="Enter amount"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Reason (Optional)</label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>Cancel</Button>
            <Button onClick={handleRefund} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              <DollarSign className="w-4 h-4 mr-2" />
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partial Refund Modal */}
      <Dialog open={showPartialRefundModal} onOpenChange={setShowPartialRefundModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Partial Refund</DialogTitle>
            <DialogDescription>
              Process a partial refund for this ticket. Enter the amount to refund.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Partial Refund Processing</p>
                <p className="text-yellow-700 mt-1">
                  Partial refunds are typically processed within 5-7 business days to the original payment method.
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Refund Amount (₹)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type="number"
                  value={partialRefundAmount}
                  onChange={(e) => setPartialRefundAmount(e.target.value)}
                  className="pl-9"
                  placeholder="Enter partial refund amount"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Reason (Optional)</label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for partial refund..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPartialRefundModal(false);
              setPartialRefundAmount('');
              setRefundReason('');
            }}>Cancel</Button>
            <Button onClick={handlePartialRefund} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              <DollarSign className="w-4 h-4 mr-2" />
              Process Partial Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Satisfaction Survey Modal */}
      <Dialog open={showSurveyModal} onOpenChange={setShowSurveyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How was your support experience?</DialogTitle>
            <DialogDescription>
              Your feedback helps us improve our service quality.
            </DialogDescription>
          </DialogHeader>
          <SatisfactionSurvey 
            onSubmit={handleSurveySubmit}
            onCancel={() => {
              setShowSurveyModal(false);
              setSurveyTicketId(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Satisfaction Survey Component
function SatisfactionSurvey({ onSubmit, onCancel }: { onSubmit: (rating: number, feedback: string) => void; onCancel: () => void }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-6 py-4">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-3 block">Rate your experience</label>
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`w-12 h-12 rounded-full transition-colors ${
                star <= rating
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <Star className="w-6 h-6 mx-auto" fill={star <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">
          {rating === 0 && 'Click to rate'}
          {rating === 1 && 'Poor'}
          {rating === 2 && 'Fair'}
          {rating === 3 && 'Good'}
          {rating === 4 && 'Very Good'}
          {rating === 5 && 'Excellent'}
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Additional Feedback (Optional)</label>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us more about your experience..."
          rows={4}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Skip</Button>
        <Button 
          onClick={() => onSubmit(rating, feedback)} 
          disabled={rating === 0}
          className="bg-[#FF8C42] hover:bg-[#FF7029]"
        >
          Submit Feedback
        </Button>
      </DialogFooter>
    </div>
  );
}

