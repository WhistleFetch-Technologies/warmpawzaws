import { useState } from 'react';
import { VideoRoom } from './VideoRoom';
import { ChatRoom } from './ChatRoom';
import { Button } from '../ui/button';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface CommunicationHubProps {
  mode: 'video' | 'chat';
  bookingId: string;
  userId: string;
  userName: string;
  otherUserName: string;
  userType: 'customer' | 'vendor';
  onClose: () => void;
  onBookFollowUp?: () => void;
}

export function CommunicationHub({ 
  mode, 
  bookingId, 
  userId, 
  userName, 
  otherUserName, 
  userType,
  onClose,
  onBookFollowUp
}: CommunicationHubProps) {
  const [isChatOpen, setIsChatOpen] = useState(mode === 'chat');
  const [activeMode, setActiveMode] = useState(mode);

  // If mode is video, we start with chat closed (or open as side panel on desktop)
  // If mode is chat, we just show chat

  const handleEndCall = () => {
    if (activeMode === 'video') {
      // If ending call, maybe switch to chat summary or just close
      const shouldClose = confirm('End call? You can continue chatting afterwards.');
      if (shouldClose) {
        setActiveMode('chat');
        setIsChatOpen(true);
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col md:flex-row overflow-hidden">
      {/* Close Button (Mobile) */}
      <button 
        onClick={onClose} 
        className="absolute top-4 left-4 z-50 p-2 bg-black/50 rounded-full text-white md:hidden"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Content Area (Video) */}
      {activeMode === 'video' && (
        <div className={`flex-1 h-full transition-all duration-300 ${isChatOpen ? 'md:w-2/3' : 'w-full'}`}>
          <VideoRoom 
            channelId={bookingId}
            userName={userName}
            userType={userType}
            onEndCall={handleEndCall}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
          />
        </div>
      )}

      {/* Secondary Content Area (Chat) */}
      {/* Always show if activeMode is chat, or if video + isChatOpen */}
      {(activeMode === 'chat' || (activeMode === 'video' && isChatOpen)) && (
        <div className={`
          ${activeMode === 'chat' ? 'w-full h-full' : 'fixed inset-y-0 right-0 w-full md:w-1/3 md:relative z-20'}
          bg-white transition-transform duration-300 transform 
          ${(activeMode === 'video' && !isChatOpen) ? 'translate-x-full md:translate-x-0 md:hidden' : 'translate-x-0'}
        `}>
          <div className="h-full flex flex-col">
             {activeMode === 'video' && (
               <div className="bg-gray-100 p-2 flex justify-end md:hidden">
                 <Button variant="ghost" size="sm" onClick={() => setIsChatOpen(false)}>
                   <Minimize2 className="w-4 h-4 mr-2" /> Minimize Chat
                 </Button>
               </div>
             )}
             
             {activeMode === 'chat' && (
               <div className="bg-white p-4 border-b flex items-center justify-between">
                 <h2 className="font-semibold">Secure Chat</h2>
                 <Button variant="ghost" size="icon" onClick={onClose}>
                   <X className="w-5 h-5" />
                 </Button>
               </div>
             )}

             <div className="flex-1 overflow-hidden">
               <ChatRoom 
                 channelId={bookingId}
                 userId={userId}
                 userName={userName}
                 otherUserName={otherUserName}
                 isConsultation={true}
                 onBookFollowUp={onBookFollowUp}
               />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}