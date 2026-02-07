import { useState, useEffect } from 'react';
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
  DollarSign
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

// Types
interface Ticket {
  id: string;
  customerId: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  source: string;
  createdAt: string;
  messages?: TicketMessage[];
}

interface TicketMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  role: 'agent' | 'customer' | 'system';
}

export function SupportCRM() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/crm/tickets`,
        {
          headers: getAuthHeaders()
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

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/crm/reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            ticketId: selectedTicket.id,
            message: replyText,
            agentName: 'Admin Agent'
          })
        }
      );

      if (response.ok) {
        toast.success('Reply sent successfully');
        setReplyText('');
        // Optimistically update UI
        const newMsg: TicketMessage = {
            id: Date.now().toString(),
            sender: 'Admin Agent',
            content: replyText,
            timestamp: new Date().toISOString(),
            role: 'agent'
        };
        
        const updatedTicket = {
            ...selectedTicket,
            messages: [...(selectedTicket.messages || []), newMsg],
            status: 'in_progress' as const
        };
        
        setSelectedTicket(updatedTicket);
        setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
      }
    } catch (error) {
      toast.error('Failed to send reply');
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    
    try {
       const response = await fetch(
        `${getApiBaseUrl()}/crm/close`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({ ticketId: selectedTicket.id })
        }
      );

      if (response.ok) {
        toast.success('Ticket closed');
        const updatedTicket = { ...selectedTicket, status: 'resolved' as const };
        setSelectedTicket(updatedTicket);
        setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
      }
    } catch (error) {
        toast.error('Failed to close ticket');
    }
  };

  const handleRefund = async () => {
      setShowRefundModal(false);
      toast.success('Refund process initiated for Ticket #' + selectedTicket?.id);
      // Simulate refund process - would call backend here
      const newMsg: TicketMessage = {
          id: Date.now().toString(),
          sender: 'System',
          content: 'Refund of ₹500 initiated to original payment method.',
          timestamp: new Date().toISOString(),
          role: 'system'
      };
      
      if (selectedTicket) {
          const updatedTicket = {
              ...selectedTicket,
              messages: [...(selectedTicket.messages || []), newMsg],
              status: 'resolved' as const
          };
          setSelectedTicket(updatedTicket);
          setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
      }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      case 'resolved': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredTickets = tickets.filter(t => filterStatus === 'all' || t.status === filterStatus);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Support CRM</h2>
            <Button variant="ghost" size="icon" onClick={loadTickets}>
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {['all', 'open', 'in_progress', 'resolved'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap capitalize ${
                  filterStatus === status 
                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
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
                  selectedTicket?.id === ticket.id ? 'bg-orange-50 border-orange-200' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 truncate mb-1">{ticket.subject}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{ticket.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <User className="w-3 h-3" />
                    <span>{ticket.customerId}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Detail View */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedTicket ? (
          <>
            {/* Ticket Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">#{selectedTicket.id}</h1>
                    <Badge className={getStatusColor(selectedTicket.status)}>
                      {selectedTicket.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="uppercase">
                      {selectedTicket.source}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-medium text-gray-700 mb-1">{selectedTicket.subject}</h2>
                  <p className="text-gray-500 text-sm flex items-center gap-2">
                    <User className="w-4 h-4" /> {selectedTicket.customerId}
                    <span className="text-gray-300">|</span>
                    <Clock className="w-4 h-4" /> {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                   {selectedTicket.status !== 'resolved' && (
                       <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={handleCloseTicket}>
                           <CheckCircle className="w-4 h-4 mr-2" />
                           Mark Resolved
                       </Button>
                   )}
                   <Button variant="destructive" onClick={() => setShowRefundModal(true)}>
                       <AlertTriangle className="w-4 h-4 mr-2" />
                       Issue Refund
                   </Button>
                </div>
              </div>
            </div>

            {/* Description & Chat */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Original Issue */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-orange-900 mb-2">Original Request</h4>
                    <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                
                {/* Thread */}
                {selectedTicket.messages?.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl p-4 ${
                            msg.role === 'agent' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                        }`}>
                            <div className="flex justify-between items-center mb-1 opacity-80 text-xs">
                                <span className="font-bold">{msg.sender}</span>
                                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p>{msg.content}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reply Area */}
            {selectedTicket.status !== 'resolved' && (
                <div className="bg-white border-t border-gray-200 p-4">
                    <div className="flex gap-2">
                        <Input 
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type a reply to the customer..."
                            className="flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                        />
                        <Button onClick={handleReply} className="bg-blue-600 hover:bg-blue-700">
                            <Send className="w-4 h-4 mr-2" />
                            Reply
                        </Button>
                    </div>
                </div>
            )}
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

      {/* Refund Modal */}
      <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              Are you sure you want to issue a refund for this ticket? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-yellow-800">Warning</p>
                    <p className="text-xs text-yellow-700">Refunds will be processed to the original payment method within 5-7 business days.</p>
                </div>
            </div>
            <div className="mt-4">
                <label className="text-sm font-medium text-gray-700">Refund Amount</label>
                <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input className="pl-9" defaultValue="500" />
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRefund}>Confirm Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}