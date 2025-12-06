import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Send, Paperclip, Image as ImageIcon, FileText, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Message {
  id: string;
  senderPhone: string;
  senderName: string;
  senderType: 'customer' | 'vendor' | 'system';
  message: string;
  messageType: string;
  timestamp: string;
  url?: string;
}

interface ChatRoomProps {
  channelId: string;
  userId: string; // This is essentially the senderPhone
  userName: string;
  otherUserName: string;
  isConsultation?: boolean;
  onBookFollowUp?: () => void;
}

export function ChatRoom({ channelId, userId, userName, otherUserName, isConsultation = false, onBookFollowUp }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout>();

  // Load messages and start polling
  useEffect(() => {
    loadMessages();
    
    // Poll for new messages every 3 seconds
    pollingInterval.current = setInterval(() => {
      loadMessages(true);
    }, 3000);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/booking/${channelId}/conversation`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Sort messages by timestamp if not already sorted
        const sortedMessages = (result.messages || []).sort((a: Message, b: Message) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(sortedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;

    try {
      setSending(true);
      const messageText = inputText.trim();
      setInputText(''); // Clear input immediately

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/chat/booking/${channelId}/message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senderPhone: userId,
            senderName: userName,
            senderType: 'customer', // Assuming ChatRoom is primarily used by customer or generic user
            message: messageText,
            messageType: 'text'
          })
        }
      );

      if (response.ok) {
        await loadMessages(true);
        scrollToBottom();
      } else {
        toast.error('Failed to send message');
        setInputText(messageText); // Restore on failure
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message');
      setInputText(inputText); // Restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // File upload implementation would go here
    // For now, we'll just simulate or show a toast since backend upload endpoint wasn't provided in VendorChatModal context
    toast.info('File upload coming soon');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">{otherUserName}</h3>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Online
          </p>
        </div>
        {isConsultation && onBookFollowUp && (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
            onClick={onBookFollowUp}
          >
            <CalendarPlus className="w-4 h-4" />
            Book Follow-Up
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            // Check if message is from current user (userId match or phone match)
            const isMe = msg.senderPhone === userId || msg.senderName === userName;
            const isSystem = msg.senderType === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                    {msg.message}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] rounded-2xl p-3 ${
                    isMe 
                      ? 'bg-[#FF8C42] text-white rounded-tr-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                  }`}
                >
                  {msg.messageType === 'image' && msg.url && (
                    <div className="mb-2 rounded-lg overflow-hidden">
                      <img src={msg.url} alt="Shared" className="max-w-full h-auto" />
                    </div>
                  )}
                  
                  {msg.messageType === 'file' && (
                    <div className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${isMe ? 'bg-white/20' : 'bg-gray-100'}`}>
                      <FileText className="w-5 h-5" />
                      <span className="text-sm underline truncate">{msg.message}</span>
                    </div>
                  )}

                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-orange-100' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileUpload} 
          accept="image/*,.pdf,.doc"
        />
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-gray-500 hover:text-[#FF8C42]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Button 
             variant="ghost" 
             size="icon" 
             className="text-gray-500 hover:text-[#FF8C42] hidden sm:flex"
             onClick={() => fileInputRef.current?.click()} 
           >
             <ImageIcon className="w-5 h-5" />
           </Button>
          
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 border-gray-200 focus-visible:ring-[#FF8C42]"
            disabled={sending}
          />
          
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputText.trim() || sending}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-full w-10 h-10 p-0 flex items-center justify-center"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}