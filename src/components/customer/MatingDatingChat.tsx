import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Send, Coffee, Stethoscope, 
  Image as ImageIcon, Smile, Calendar, MapPin
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface MatingDatingChatProps {
  phone: string;
  matchId: string;
  onBack: () => void;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: 'text' | 'image';
}

export function MatingDatingChat({ phone, matchId, onBack }: MatingDatingChatProps) {
  const [match, setMatch] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showScheduler, setShowScheduler] = useState<'meetup' | 'mating' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMatchData();
    unlockChat();
    loadMessages();

    // Poll for new messages every 3 seconds
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMatchData = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/matches/${phone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        const foundMatch = result.matches?.find((m: any) => m.id === matchId);
        if (foundMatch) {
          setMatch(foundMatch);
        }
      }
    } catch (error) {
      console.error('Error loading match data:', error);
    } finally {
      setLoading(false);
    }
  };

  const unlockChat = async () => {
    try {
      // Attempt to unlock chat with subscription check
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/unlock-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            matchId,
            userId: phone
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 402) {
          // Subscription required - parent component should handle this
          toast.error('Subscription required to chat');
          onBack();
        }
      }
    } catch (error) {
      console.error('Error unlocking chat:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/chat/${matchId}/messages`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        const loadedMessages = (result.messages || []).map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          text: msg.message,
          timestamp: msg.timestamp,
          type: msg.messageType || 'text',
          attachmentUrl: msg.attachmentUrl
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      setSending(true);

      // Optimistically add to local state
      const tempMessage: Message = {
        id: `temp_${Date.now()}`,
        senderId: phone,
        text: messageText.trim(),
        timestamp: new Date().toISOString(),
        type: 'text'
      };
      setMessages(prev => [...prev, tempMessage]);
      const messageToSend = messageText.trim();
      setMessageText('');

      // Send via API
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/dating/chat/${matchId}/message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            senderId: phone,
            message: messageToSend,
            messageType: 'text'
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Replace temp message with real one
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? {
                id: result.message.id,
                senderId: result.message.senderId,
                text: result.message.message,
                timestamp: result.message.timestamp,
                type: result.message.messageType || 'text'
              }
            : msg
        ));
        toast.success('Message sent');
      } else {
        // Remove temp message on error
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setMessageText(messageToSend); // Restore message text
        const error = await response.json();
        toast.error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Restore message text
      setMessageText(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleScheduleMeetup = () => {
    setShowScheduler('meetup');
  };

  const handleRequestMating = () => {
    setShowScheduler('mating');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-gray-600 mb-4">Match not found</p>
          <Button onClick={onBack} variant="outline">Go Back</Button>
        </div>
      </div>
    );
  }

  const otherProfile = match.otherProfile;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          {/* Profile Info */}
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-pink-400 to-purple-400">
              {otherProfile?.photos?.[0] ? (
                <img 
                  src={otherProfile.photos[0]} 
                  alt={otherProfile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold">
                  {otherProfile?.name?.[0] || 'U'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-900 truncate">
                {otherProfile?.name || 'Unknown'}
              </h2>
              <p className="text-xs text-gray-500">Active now</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3 flex gap-2">
          <Button
            onClick={handleScheduleMeetup}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Coffee className="w-4 h-4 mr-1" />
            Schedule Meet-Up
          </Button>
          <Button
            onClick={handleRequestMating}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Stethoscope className="w-4 h-4 mr-1" />
            Mating Appointment
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-4 space-y-4">
          {/* Match Banner */}
          <div className="text-center">
            <div className="inline-block bg-pink-100 text-pink-700 px-4 py-2 rounded-full text-sm font-medium mb-2">
              You matched on {new Date(match.createdAt).toLocaleDateString()}
            </div>
          </div>

          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="bg-white rounded-xl p-6 shadow-sm inline-block">
                <p className="text-gray-600 mb-2">No messages yet</p>
                <p className="text-sm text-gray-500">Say hi to {otherProfile?.name}!</p>
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isMine = message.senderId === phone;
            
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    isMine
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                      : 'bg-white text-gray-900 shadow-sm'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className={`text-xs mt-1 ${isMine ? 'text-pink-100' : 'text-gray-500'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-end gap-2">
            <button className="text-gray-400 hover:text-gray-600 mb-2">
              <ImageIcon className="w-6 h-6" />
            </button>
            <button className="text-gray-400 hover:text-gray-600 mb-2">
              <Smile className="w-6 h-6" />
            </button>
            
            <div className="flex-1 bg-gray-100 rounded-full px-4 py-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message..."
                className="w-full bg-transparent outline-none text-gray-900 placeholder-gray-500"
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!messageText.trim() || sending}
              className="bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full p-3 disabled:opacity-50 hover:scale-105 transition-transform active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scheduler Modals */}
      {showScheduler === 'meetup' && (
        <MeetUpSchedulerModal
          matchId={matchId}
          onClose={() => setShowScheduler(null)}
        />
      )}

      {showScheduler === 'mating' && (
        <MatingAppointmentModal
          matchId={matchId}
          onClose={() => setShowScheduler(null)}
        />
      )}
    </div>
  );
}

// Simple modal placeholders - full components created separately
function MeetUpSchedulerModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Schedule Meet-Up</h3>
          <button onClick={onClose} className="text-gray-400">×</button>
        </div>
        <div className="flex items-center gap-3 text-blue-600 bg-blue-50 rounded-lg p-4">
          <Coffee className="w-6 h-6" />
          <p className="text-sm">This will open the Meet-Up Scheduler to find nearby pet-friendly cafés</p>
        </div>
        <Button onClick={onClose} className="w-full mt-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white">
          Find Cafés
        </Button>
      </div>
    </div>
  );
}

function MatingAppointmentModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Mating Appointment</h3>
          <button onClick={onClose} className="text-gray-400">×</button>
        </div>
        <div className="flex items-center gap-3 text-green-600 bg-green-50 rounded-lg p-4">
          <Stethoscope className="w-6 h-6" />
          <p className="text-sm">This will help you book a professional mating appointment at a nearby vet clinic</p>
        </div>
        <Button onClick={onClose} className="w-full mt-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white">
          Find Vets
        </Button>
      </div>
    </div>
  );
}
