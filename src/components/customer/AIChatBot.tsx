import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { MessageSquare, X, Send, Headphones, Ticket, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface AIChatBotProps {
  customerId: string;
  customerName?: string;
}

export function AIChatBot({ customerId, customerName = 'Customer' }: AIChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi ${customerName}! I'm your AI assistant. How can I help you today?`,
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ai/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            message: userMsg.content,
            customerId,
            history: messages.slice(-5) // Send last 5 messages for context
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || data.message || "I'm here to help! How can I assist you?",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
        
        // If AI suggests support ticket
        if (data.action === 'create_ticket') {
           // Show ticket creation option or auto-create
           toast.info("I've flagged this for human support.");
        }
      } else {
        // Handle error responses gracefully
        const text = await response.text();
        let errorMessage = 'AI service temporarily unavailable';
        
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, log it
          console.error('Non-JSON error response:', text.substring(0, 200));
        }
        
        console.error('AI API Error:', response.status, errorMessage);
        
        // Show fallback message to user
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm having trouble connecting right now. You can:\n\n• Try asking your question again\n• Create a support ticket for human assistance\n• Browse our help center for common questions",
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      // Fallback response
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to my brain right now. Would you like to create a support ticket instead?",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/crm/tickets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            customerId,
            subject: "Chat Support Request",
            description: messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n'),
            source: 'chat_handoff'
          })
        }
      );
      
      if (response.ok) {
        toast.success('Support ticket created! An agent will contact you shortly.');
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Ticket #T-1234 created. An agent will follow up via email.',
          timestamp: Date.now()
        }]);
      }
    } catch (error) {
      toast.error('Failed to create ticket');
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-4 w-14 h-14 bg-[#FF8C42] hover:bg-[#e67e3a] text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50 ${isOpen ? 'hidden' : ''}`}
      >
        <MessageSquare className="w-7 h-7" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 w-[350px] max-w-[calc(100vw-32px)] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Warmpawz Assistant</h3>
                <p className="text-[10px] text-white/80">Powered by AI • Online</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-[#FF8C42] text-white rounded-tr-none'
                      : msg.role === 'system'
                      ? 'bg-gray-200 text-gray-600 text-xs text-center w-full'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-[#FF8C42]"
                title="Connect with Human Agent"
                onClick={handleCreateTicket}
              >
                <Ticket className="w-5 h-5" />
              </Button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
              <Button
                size="icon"
                className="bg-[#FF8C42] hover:bg-[#e67e3a] rounded-full w-10 h-10 flex-shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
              >
                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-2">
              AI can make mistakes. For urgent issues, use the ticket icon.
            </p>
          </div>
        </div>
      )}
    </>
  );
}