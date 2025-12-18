import { useState, useEffect, useRef } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  ArrowLeft,
  Send,
  FileText,
  CheckCheck,
  User,
  Calendar,
  Pill,
  Paperclip,
  Image as ImageIcon,
  Video as VideoIcon,
  Download,
  Eye,
  X,
  History
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorChatInterfaceProps {
  vendorPhone: string;
  vendorName: string;
  bookingId: string;
  customerName: string;
  petName: string;
  onBack: () => void;
  onAttachPrescription?: () => void;
}

interface Message {
  id: string;
  bookingId: string;
  senderPhone: string;
  senderName: string;
  senderType: 'customer' | 'vendor';
  message: string;
  messageType: 'text' | 'prescription' | 'attachment' | 'image' | 'video' | 'pdf';
  prescriptionId?: string;
  attachmentUrl?: string;
  timestamp: string;
  read: boolean;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

export function VendorChatInterface({
  vendorPhone,
  vendorName,
  bookingId,
  customerName,
  petName,
  onBack,
  onAttachPrescription
}: VendorChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadBooking();
    loadMessages();
    loadCustomerHistory();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [bookingId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadBooking = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/bookings/${vendorPhone.replace(/[^0-9]/g, '')}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const foundBooking = data.bookings?.find((b: any) => b.id === bookingId);
        if (foundBooking) {
          setBooking(foundBooking);
        }
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error loading booking:', error);
    }
  };

  const loadCustomerHistory = async () => {
    try {
      if (!booking?.customerPhone) return;
      
      const response = await fetch(
        `${API_BASE}/vendor/customer-history/${booking.customerPhone.replace(/[^0-9]/g, '')}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCustomerHistory(data.history || []);
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error loading customer history:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_BASE}/chat/booking/${bookingId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      
      const response = await fetch(
        `${API_BASE}/followup/chat/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId,
            senderPhone: vendorPhone.replace(/[^0-9]/g, ''),
            senderName: vendorName,
            senderType: 'vendor',
            message: newMessage,
            messageType: 'text'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
          setNewMessage('');
        }
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only images, videos, and PDFs are allowed');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', bookingId);
      formData.append('senderPhone', vendorPhone.replace(/[^0-9]/g, ''));
      formData.append('senderName', vendorName);
      formData.append('senderType', 'vendor');

      const response = await fetch(
        `${API_BASE}/chat/upload-file`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: formData
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
          toast.success('File uploaded successfully');
        }
      } else {
        toast.error('Failed to upload file');
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error uploading file:', error);
      toast.error('Error uploading file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadFile = async (fileId: string, fileName: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/chat/file/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('File downloaded');
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error downloading file:', error);
      toast.error('Error downloading file');
    }
  };

  const previewFileFunc = async (fileId: string, fileType: string, fileName: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/chat/file/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewFile({ url, type: fileType, name: fileName });
      }
    } catch (error) {
      console.error('❌ [VENDOR-CHAT] Error previewing file:', error);
      toast.error('Error previewing file');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
  };

  const groupedMessages: { [key: string]: Message[] } = {};
  messages.forEach(msg => {
    const dateKey = formatDate(msg.timestamp);
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(msg);
  });

  const renderMessageContent = (msg: Message) => {
    if (msg.messageType === 'prescription') {
      return (
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Prescription attached</p>
            {msg.prescriptionId && (
              <button
                onClick={() => downloadFile(msg.prescriptionId!, `prescription_${bookingId}.pdf`)}
                className="text-xs underline mt-1 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download PDF
              </button>
            )}
          </div>
        </div>
      );
    } else if (msg.messageType === 'image') {
      return (
        <div className="space-y-2">
          <div className="relative">
            <img
              src={`${API_BASE}/chat/file/${msg.fileId}`}
              alt={msg.fileName || 'Image'}
              className="rounded-lg max-w-full cursor-pointer"
              onClick={() => previewFileFunc(msg.fileId!, msg.fileType!, msg.fileName!)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => previewFileFunc(msg.fileId!, msg.fileType!, msg.fileName!)}
              className="text-xs flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              View
            </button>
            <button
              onClick={() => downloadFile(msg.fileId!, msg.fileName!)}
              className="text-xs flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          </div>
          {msg.message && msg.message !== `Sent a ${msg.messageType}` && (
            <p className="text-sm mt-1">{msg.message}</p>
          )}
        </div>
      );
    } else if (msg.messageType === 'video') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-black/5 rounded-lg">
            <VideoIcon className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{msg.fileName}</p>
              <p className="text-xs text-gray-500">{(msg.fileSize! / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => previewFileFunc(msg.fileId!, msg.fileType!, msg.fileName!)}
              className="text-xs flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              View
            </button>
            <button
              onClick={() => downloadFile(msg.fileId!, msg.fileName!)}
              className="text-xs flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          </div>
          {msg.message && msg.message !== `Sent a ${msg.messageType}` && (
            <p className="text-sm mt-1">{msg.message}</p>
          )}
        </div>
      );
    } else if (msg.messageType === 'pdf') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-black/5 rounded-lg">
            <FileText className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{msg.fileName}</p>
              <p className="text-xs text-gray-500">PDF Document</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => previewFileFunc(msg.fileId!, msg.fileType!, msg.fileName!)}
              className="text-xs flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              View
            </button>
            <button
              onClick={() => downloadFile(msg.fileId!, msg.fileName!)}
              className="text-xs flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          </div>
          {msg.message && msg.message !== `Sent a ${msg.messageType}` && (
            <p className="text-sm mt-1">{msg.message}</p>
          )}
        </div>
      );
    } else {
      return <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="w-full max-w-[430px] mx-auto bg-white flex flex-col h-screen">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-4 py-4">
          <button onClick={onBack} className="flex items-center gap-2 mb-3">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold truncate">{customerName}</h1>
                {customerHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                    title="View customer history"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-white/80 truncate">Pet: {petName}</p>
              {booking?.customerPhone && (
                <p className="text-xs text-white/60 truncate">{booking.customerPhone}</p>
              )}
            </div>

            {booking?.isFollowup && (
              <Badge className="bg-white/20 text-white border-white/30">
                Follow-up
              </Badge>
            )}
          </div>

          {/* Customer History Panel */}
          {showHistory && customerHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs text-white/80 mb-2 font-medium">Previous Visits ({customerHistory.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {customerHistory.slice(0, 3).map((visit: any, idx: number) => (
                  <div key={idx} className="text-xs text-white/70 flex items-start gap-1">
                    <span className="text-white/40">•</span>
                    <span>{visit.serviceName} - {formatDate(visit.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking Info */}
          {booking && (
            <div className="mt-3 pt-3 border-t border-white/20 space-y-1">
              <div className="flex items-center gap-2 text-xs text-white/80">
                <Calendar className="w-3.5 h-3.5" />
                <span>{booking.selectedDate} at {booking.selectedTime}</span>
              </div>
              {booking.followupMetadata && (
                <div className="text-xs text-white/80">
                  Original visit: {booking.followupMetadata.daysSinceOriginal} days ago
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No messages yet</p>
                <p className="text-gray-400 text-xs mt-1">Waiting for patient message</p>
              </div>
            </div>
          ) : (
            Object.keys(groupedMessages).map(dateKey => (
              <div key={dateKey}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-500 font-medium">{dateKey}</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {groupedMessages[dateKey].map((msg) => {
                  const isOwnMessage = msg.senderType === 'vendor';
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-3`}
                    >
                      <div className={`max-w-[75%] ${isOwnMessage ? '' : 'flex gap-2'}`}>
                        {!isOwnMessage && (
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
                            {customerName.charAt(0)}
                          </div>
                        )}
                        
                        <div>
                          {!isOwnMessage && (
                            <p className="text-xs text-gray-500 mb-1 px-1">{customerName}</p>
                          )}
                          
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isOwnMessage
                                ? 'bg-[#FF8C42] text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {renderMessageContent(msg)}
                          </div>
                          
                          <div className={`flex items-center gap-1 mt-1 px-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                            <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                            {isOwnMessage && (
                              <CheckCheck className={`w-3.5 h-3.5 ${msg.read ? 'text-blue-500' : 'text-gray-400'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,video/*,application/pdf"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FF8C42]"></div>
              ) : (
                <Paperclip className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type your message..."
              className="flex-1"
              disabled={sending || uploading}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || uploading}
              className="bg-[#FF8C42] hover:bg-[#FF7029] px-4"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>

          {onAttachPrescription && (
            <Button
              onClick={onAttachPrescription}
              variant="outline"
              className="w-full border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
              size="sm"
            >
              <Pill className="w-4 h-4 mr-2" />
              Attach Prescription
            </Button>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setPreviewFile(null)}>
          <button
            onClick={() => setPreviewFile(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <div className="w-full max-w-4xl max-h-screen p-4" onClick={(e) => e.stopPropagation()}>
            {previewFile.type.startsWith('image/') ? (
              <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-screen object-contain mx-auto" />
            ) : previewFile.type.startsWith('video/') ? (
              <video src={previewFile.url} controls className="max-w-full max-h-screen mx-auto" />
            ) : previewFile.type === 'application/pdf' ? (
              <iframe src={previewFile.url} className="w-full h-screen bg-white" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
