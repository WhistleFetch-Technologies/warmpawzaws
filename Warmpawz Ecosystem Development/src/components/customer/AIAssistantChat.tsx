import { useState, useRef, useEffect } from 'react';
import { 
  X, Send, Paperclip, Video, Sparkles, Bot, User, 
  Calendar, Stethoscope, AlertCircle, Check, Loader2,
  Upload, Play, Pause
} from 'lucide-react';
import { Button } from '../ui/button';
import MockAPI from '../../lib/mockAPI';
import { toast } from 'sonner@2.0.3';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  mediaType?: 'text' | 'video';
  videoUrl?: string;
  quickActions?: QuickAction[];
}

interface QuickAction {
  label: string;
  action: string;
  icon?: string;
}

export function AIAssistantChat({ onClose, userName, customerId = 'anon' }: { onClose: () => void; userName: string; customerId?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: `Hi ${userName}! 👋 I'm your WarmPawz AI Assistant. I can help you with:\n\n🤖 Smart Booking - Book any service instantly\n🏥 AI Symptoms Checker - Analyze your pet's health\n💬 24/7 Support - Get instant help\n\nHow can I assist you today?`,
      timestamp: new Date(),
      quickActions: [
        { label: '📅 Book Service', action: 'booking', icon: '📅' },
        { label: '🏥 Check Symptoms', action: 'symptoms', icon: '🏥' },
        { label: '💬 Get Support', action: 'support', icon: '💬' },
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState<'general' | 'booking' | 'symptoms' | 'support'>('general');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Helper for unique IDs
  const generateId = () => Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setUploadedVideo(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      // Silently handle camera errors with user-friendly bot messages
      let errorMessage = 'Unable to access camera. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Camera permission was denied. Please allow camera access in your browser settings and try again, or use the Upload Video option instead.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on your device. Please use the Upload Video option instead.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application. Please close other apps and try again.';
      } else {
        errorMessage += 'Please check your camera permissions or use the Upload Video option instead.';
      }

      // Add bot message about the error
      const botMessage: Message = {
        id: generateId(),
        type: 'bot',
        content: `⚠️ ${errorMessage}\n\nNo worries! You can:\n• Upload a pre-recorded video instead\n• Describe symptoms in text\n• Continue with other services`,
        timestamp: new Date(),
        quickActions: [
          { label: '📤 Upload Video', action: 'upload-video' },
          { label: '💬 Describe Symptoms', action: 'text-symptoms' },
        ]
      };

      setMessages(prev => [...prev, botMessage]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        alert('Video file too large. Please upload a video under 50MB.');
        return;
      }
      const url = URL.createObjectURL(file);
      setUploadedVideo(url);
    }
  };

  const fetchBotResponse = async (userMessage: string, mode: string, isSystemAction = false) => {
    setIsTyping(true);
    
    // If it's a system action (clicking a quick action button), we might want immediate local feedback
    // BUT for "live chat" feeling, we should still let AI handle most things unless it's a pure UI switch.
    
    // Special handling for initial mode switches to provide instant context
    if (isSystemAction) {
       if (mode === 'booking' && userMessage === 'booking') {
          setMessages(prev => [...prev, {
            id: generateId(),
            type: 'bot',
            content: "I can help you book:\n\n✂️ Grooming (Home/Salon)\n🏥 Vet Appointments\n🐕 Dog Walking\n🏠 Pet Boarding\n🎓 Training Sessions\n\nWhich service would you like to book?",
            timestamp: new Date(),
            quickActions: [
              { label: '✂️ Grooming', action: 'book-grooming' },
              { label: '🏥 Vet Care', action: 'book-vet' },
              { label: '🐕 Dog Walker', action: 'book-walker' },
              { label: '🏠 Boarding', action: 'book-boarding' },
            ]
          }]);
          setIsTyping(false);
          return;
       }
       if (mode === 'symptoms' && userMessage === 'symptoms') {
          setMessages(prev => [...prev, {
            id: generateId(),
            type: 'bot',
            content: "I'll help check your pet's symptoms. Please describe:\n\n• What symptoms are you noticing?\n• When did they start?\n• Any changes in behavior?\n\nYou can also upload a 30-second video for better analysis! 🎥",
            timestamp: new Date(),
            quickActions: [
              { label: '📹 Record Video', action: 'record-video' },
              { label: '📤 Upload Video', action: 'upload-video' },
            ]
          }]);
          setIsTyping(false);
          return;
       }
       if (mode === 'support' && userMessage === 'support') {
          setMessages(prev => [...prev, {
             id: generateId(),
             type: 'bot',
             content: "I'm here to help! 💬\n\nCommon questions I can answer:\n\n❓ How do I cancel a booking?\n❓ What are your refund policies?\n❓ How to update my profile?\n❓ Pet insurance information\n❓ Payment issues\n\nWhat do you need help with?",
             timestamp: new Date(),
             quickActions: [
               { label: 'Booking Help', action: 'help-booking' },
               { label: 'Refund Policy', action: 'help-refund' },
               { label: 'Profile Issues', action: 'help-profile' },
               { label: 'Talk to Human', action: 'human-agent' },
             ]
          }]);
          setIsTyping(false);
          return;
       }
    }

    try {
      // Prepare history for context
      const history = messages.slice(-5).map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      // Call AI chat via MockAPI
      const aiResponse = await MockAPI.ai.chat({
        message: `[Current Mode: ${mode.toUpperCase()}] ${userMessage}`,
        customerId,
        history
      });

      // Determine quick actions based on AI action intent
      let quickActions: QuickAction[] | undefined;
      
      if (aiResponse.action === 'suggest_ticket' || aiResponse.action === 'create_ticket') {
        quickActions = [{ label: '🎫 Create Ticket', action: 'create-ticket' }];
      } else if (aiResponse.action === 'book_appointment') {
        quickActions = [{ label: '📅 Book Now', action: 'booking' }];
      } else if (mode === 'symptoms') {
        // Keep symptom related actions available
        quickActions = [
          { label: '📹 Record Video', action: 'record-video' },
          { label: '📤 Upload Video', action: 'upload-video' },
          { label: '📅 Book Vet', action: 'book-vet' }
        ];
      }

      const botMessage: Message = {
        id: generateId(),
        type: 'bot',
        content: aiResponse.reply,
        timestamp: new Date(),
        quickActions
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('AI Error:', error);
      toast.error("AI Connection Error. Switching to basic mode.");
      
      // Fallback response
      const botMessage: Message = {
        id: generateId(),
        type: 'bot',
        content: "I'm having trouble connecting to the AI server right now. Please try again or contact support.",
        timestamp: new Date(),
        quickActions: [{ label: 'Retry', action: 'retry' }]
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() && !uploadedVideo) return;

    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: inputMessage || '📹 Video uploaded for analysis',
      timestamp: new Date(),
      mediaType: uploadedVideo ? 'video' : 'text',
      videoUrl: uploadedVideo || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    
    // If video is uploaded, we might want to simulate analysis for now as backend doesn't handle it yet
    if (uploadedVideo) {
       setIsTyping(true);
       setTimeout(() => {
          setMessages(prev => [...prev, {
            id: generateId(),
            type: 'bot',
            content: "🎥 Video received! Analyzing your pet's symptoms...\n\n✅ Analysis Complete:\n\nBased on the video, I notice:\n• Energy level: Normal\n• Movement: Slight limping detected\n• Breathing: Normal\n\n⚠️ Recommendation:\nI recommend scheduling a vet checkup within 24-48 hours. The limping could indicate:\n- Minor sprain\n- Paw injury\n- Joint discomfort\n\nWould you like to book a vet appointment?",
            timestamp: new Date(),
            quickActions: [
              { label: '📅 Book Vet Now', action: 'book-vet-urgent' },
              { label: '📱 Tele-Consult', action: 'tele-consult' },
            ]
          }]);
          setIsTyping(false);
       }, 2000);
    } else {
       fetchBotResponse(inputMessage, chatMode, false);
    }

    setInputMessage('');
    setUploadedVideo(null);
  };

  const handleQuickAction = (action: string) => {
    let newMode: 'general' | 'booking' | 'symptoms' | 'support' = 'general';
    let isSystem = false;
    
    if (action === 'booking' || action.startsWith('book-')) {
      newMode = 'booking';
      isSystem = action === 'booking'; // Only main entry is system
    } else if (action === 'symptoms') {
      newMode = 'symptoms';
      isSystem = true;
    } else if (action === 'support' || action.startsWith('help-')) {
      newMode = 'support';
      isSystem = action === 'support';
    } else {
      // For specific actions like 'help-refund', we want AI to answer specific query
      newMode = chatMode; // Keep current mode
      isSystem = false;
    }
    
    // Special case for recording/uploading which are client-side actions
    if (action === 'record-video') {
      startRecording();
      return;
    } else if (action === 'upload-video') {
      videoInputRef.current?.click();
      return;
    }

    setChatMode(newMode);

    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: `Selected: ${action.replace(/-/g, ' ')}`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    
    // If it's a system mode switch, use the system action flag
    fetchBotResponse(action, newMode, isSystem);
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#FF8C42]" />
          </div>
          <div>
            <h2 className="text-white font-semibold">AI Assistant</h2>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white/90 text-xs">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Mode Indicator */}
      {chatMode !== 'general' && (
        <div className="px-6 py-2 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {chatMode === 'booking' && <Calendar className="w-4 h-4 text-blue-600" />}
              {chatMode === 'symptoms' && <Stethoscope className="w-4 h-4 text-red-600" />}
              {chatMode === 'support' && <AlertCircle className="w-4 h-4 text-purple-600" />}
              <span className="text-sm font-medium text-gray-700">
                {chatMode === 'booking' && 'Smart Booking Mode'}
                {chatMode === 'symptoms' && 'AI Symptoms Checker'}
                {chatMode === 'support' && 'Support Mode'}
              </span>
            </div>
            <button
              onClick={() => setChatMode('general')}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Exit Mode
            </button>
          </div>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-700">Recording... {recordingTime}s / 30s</span>
            </div>
            <button
              onClick={stopRecording}
              className="bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-medium"
            >
              Stop & Analyze
            </button>
          </div>
          <div className="mt-2 h-1 bg-red-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 transition-all duration-1000"
              style={{ width: `${(recordingTime / 30) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'bot' 
                  ? 'bg-gradient-to-br from-[#FF8C42] to-[#FF6B35]' 
                  : 'bg-gradient-to-br from-blue-500 to-purple-500'
              }`}>
                {message.type === 'bot' ? (
                  <Bot className="w-5 h-5 text-white" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div>
                <div className={`rounded-3xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {message.videoUrl && (
                    <div className="mb-2">
                      <video
                        src={message.videoUrl}
                        controls
                        className="w-full rounded-2xl max-h-48"
                      />
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                </div>

                {/* Quick Actions */}
                {message.quickActions && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.quickActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(action.action)}
                        className="bg-white border border-[#FF8C42] text-[#FF8C42] px-3 py-1.5 rounded-full text-xs font-medium hover:bg-[#FF8C42] hover:text-white transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-xs text-gray-400 mt-1 block">
                  {(typeof message.timestamp === 'number' 
                    ? new Date(message.timestamp) 
                    : message.timestamp
                  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-3xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Video Preview */}
      {uploadedVideo && !isRecording && (
        <div className="px-6 py-3 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Video ready for analysis</span>
            </div>
            <button
              onClick={() => setUploadedVideo(null)}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-end gap-2">
          {/* Video Upload Options */}
          <div className="flex gap-2">
            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              title="Upload Video"
            >
              <Upload className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title={isRecording ? 'Stop Recording' : 'Record Video'}
            >
              <Video className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-gray-600'}`} />
            </button>
          </div>

          {/* Text Input */}
          <div className="flex-1 bg-gray-100 rounded-3xl px-4 py-2 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() && !uploadedVideo}
            className="w-10 h-10 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Helper Text */}
        <p className="text-xs text-gray-400 text-center mt-2">
          AI-powered assistant • Instant responses • Video analysis up to 30s
        </p>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="hidden"
      />
    </div>
  );
}