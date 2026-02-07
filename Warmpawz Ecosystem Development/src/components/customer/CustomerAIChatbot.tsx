import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { 
  MessageSquare, X, Send, Headphones, Ticket, Loader2, 
  ShoppingBag, Stethoscope, Calendar, HelpCircle, Zap 
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner@2.0.3';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: 'support' | 'booking' | 'symptoms' | 'shopping' | 'adoption' | 'knowledge' | 'general';
  confidence?: number;
  timestamp: string;
}

interface CustomerAIChatbotProps {
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  className?: string;
}

export function CustomerAIChatbot({ 
  customerId, 
  customerPhone, 
  customerName = 'Guest',
  className 
}: CustomerAIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi ${customerName}! I'm your AI assistant. How can I help you today?`,
      intent: 'general',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<string>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/ai-chatbot/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            message: text,
            customerPhone,
            customerId, // Pass ID if available
            conversationId: localStorage.getItem('ai_conversation_id') || undefined,
            context: {
              page: window.location.pathname
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Save conversation ID
        if (data.conversationId) {
          localStorage.setItem('ai_conversation_id', data.conversationId);
        }

        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          intent: data.intent,
          confidence: data.confidence,
          timestamp: data.timestamp
        };
        
        setMessages(prev => [...prev, aiMsg]);
        setCurrentIntent(data.intent || 'general');

      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to my brain right now. Please check your internet or try again later.",
        intent: 'support',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const getIntentColor = (intent?: string) => {
    switch (intent) {
      case 'support': return 'bg-red-100 text-red-800 border-red-200';
      case 'booking': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'symptoms': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'shopping': return 'bg-green-100 text-green-800 border-green-200';
      case 'adoption': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'knowledge': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case 'support': return <Headphones className="w-3 h-3 mr-1" />;
      case 'booking': return <Calendar className="w-3 h-3 mr-1" />;
      case 'symptoms': return <Stethoscope className="w-3 h-3 mr-1" />;
      case 'shopping': return <ShoppingBag className="w-3 h-3 mr-1" />;
      default: return <Zap className="w-3 h-3 mr-1" />;
    }
  };

  const quickActions = [
    { icon: Calendar, label: 'Book Service', intent: 'booking', query: 'I want to book a service' },
    { icon: Stethoscope, label: 'Check Symptoms', intent: 'symptoms', query: 'My pet has symptoms' },
    { icon: ShoppingBag, label: 'Shop Products', intent: 'shopping', query: 'Show me pet products' },
    { icon: HelpCircle, label: 'Get Support', intent: 'support', query: 'I need help' },
  ];

  return (
    <>
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-xl flex items-center justify-center z-50 ${isOpen ? 'hidden' : ''}`}
      >
        <MessageSquare className="w-7 h-7" />
        {/* Notification Dot */}
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-4 w-[380px] max-w-[calc(100vw-32px)] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden font-sans"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
                  <img 
                    src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=64&h=64&fit=crop&crop=faces" 
                    alt="AI" 
                    className="w-full h-full rounded-full object-cover opacity-90" 
                  />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    Warmpawz AI
                    <Badge variant="secondary" className="text-[10px] h-5 bg-white/20 text-white border-none hover:bg-white/30">
                      BETA
                    </Badge>
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <p className="text-xs text-white/90">Always here to help</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setMessages([{
                    id: 'reset', 
                    role: 'assistant', 
                    content: 'Chat cleared. How can I help?', 
                    intent: 'general', 
                    timestamp: new Date().toISOString()
                  }])}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white"
                  title="Reset Chat"
                >
                  <X className="w-4 h-4 rotate-45" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Intent Indicator Bar (Context Aware) */}
            {currentIntent !== 'general' && (
              <div className={`px-4 py-1.5 text-xs font-medium flex items-center justify-center border-b ${getIntentColor(currentIntent as any).replace('bg-', 'bg-opacity-20 bg-')}`}>
                Currently discussing: <span className="uppercase ml-1 font-bold">{currentIntent}</span>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200">
              {messages.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
                    
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-100 text-indigo-600' 
                        : 'bg-purple-100 text-purple-600'
                    }`}>
                      {msg.role === 'user' ? 'ME' : 'AI'}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`p-3.5 rounded-2xl text-sm shadow-sm relative group ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-none'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                      
                      {/* Intent Badge for Assistant */}
                      {msg.role === 'assistant' && msg.intent && msg.intent !== 'general' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getIntentColor(msg.intent)}`}>
                            {getIntentIcon(msg.intent)}
                            {msg.intent.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Timestamp */}
                  <span className="text-[10px] text-gray-400 mt-1 px-2">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">AI</div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-4 shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State Quick Actions */}
              {messages.length === 1 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.query)}
                      className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group"
                    >
                      <div className={`w-10 h-10 rounded-full bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center text-gray-500 group-hover:text-indigo-600 mb-2 transition-colors`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 group-hover:text-indigo-700">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Context Aware Suggestions (Bottom Bar) */}
            {messages.length > 1 && !isTyping && (
               <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex gap-2 overflow-x-auto scrollbar-none">
                 {currentIntent === 'shopping' && (
                    <Badge onClick={() => sendMessage('Show me dog food')} variant="outline" className="cursor-pointer hover:bg-indigo-50 whitespace-nowrap">🐶 Dog Food</Badge>
                 )}
                 {currentIntent === 'symptoms' && (
                    <Badge onClick={() => sendMessage('I want to book a vet')} variant="outline" className="cursor-pointer hover:bg-red-50 text-red-600 border-red-200 whitespace-nowrap">🏥 Book Vet</Badge>
                 )}
                 <Badge onClick={() => sendMessage('Talk to a human')} variant="outline" className="cursor-pointer hover:bg-gray-100 whitespace-nowrap">👤 Support Agent</Badge>
               </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-full pl-5 pr-12 py-3 text-sm transition-all"
                  disabled={isTyping}
                />
                <Button
                  size="icon"
                  className="absolute right-1 top-1 bottom-1 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-sm"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                >
                  {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                </Button>
              </div>
              <div className="flex justify-center mt-2">
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  Powered by <span className="font-semibold text-indigo-500">AWS Bedrock AI</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
