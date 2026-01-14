'use client';

/**
 * Communication Hub Page
 * Manages messages, video calls, and notifications
 * Capabilities: chat, video_call, notifications
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  MessageCircle, 
  Video, 
  Bell, 
  Clock,
  User,
  CheckCircle,
  Phone,
  Mail
} from 'lucide-react';

interface Message {
  id: string;
  customer_name: string;
  customer_phone?: string;
  last_message: string;
  timestamp: string;
  unread_count: number;
  booking_id?: string;
}

interface VideoCall {
  id: string;
  customer_name: string;
  scheduled_time: string;
  booking_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'review' | 'system';
  is_read: boolean;
  created_at: string;
}

export default function CommunicationPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'messages' | 'calls' | 'notifications'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [calls, setCalls] = useState<VideoCall[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchData(storedVendorId);
  }, [router]);

  useEffect(() => {
    if (vendorId) {
      fetchData(vendorId);
    }
  }, [activeTab, vendorId]);

  const fetchData = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      // Placeholder - will be connected to actual API
      setMessages([]);
      setCalls([]);
      setNotifications([]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    unreadMessages: messages.reduce((sum, m) => sum + m.unread_count, 0),
    scheduledCalls: calls.filter(c => c.status === 'scheduled').length,
    unreadNotifications: notifications.filter(n => !n.is_read).length,
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'payment': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'review': return <User className="h-4 w-4 text-yellow-500" />;
      default: return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="h-8 w-8 text-blue-500" />
          Communication Hub
        </h1>
        <p className="text-muted-foreground">Manage messages, video calls, and notifications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'messages' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <MessageCircle className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Unread Messages</p>
              <p className="text-2xl font-bold">{stats.unreadMessages}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'calls' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setActiveTab('calls')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <Video className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Scheduled Calls</p>
              <p className="text-2xl font-bold">{stats.scheduledCalls}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'notifications' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <Bell className="h-10 w-10 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Unread Notifications</p>
              <p className="text-2xl font-bold">{stats.unreadNotifications}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <Button 
          variant={activeTab === 'messages' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('messages')}
          className="rounded-b-none"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Messages
        </Button>
        <Button 
          variant={activeTab === 'calls' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('calls')}
          className="rounded-b-none"
        >
          <Video className="h-4 w-4 mr-2" />
          Video Calls
        </Button>
        <Button 
          variant={activeTab === 'notifications' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('notifications')}
          className="rounded-b-none"
        >
          <Bell className="h-4 w-4 mr-2" />
          Notifications
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <>
          {/* Messages Tab */}
          {activeTab === 'messages' && (
            messages.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No messages yet</h3>
                  <p className="text-muted-foreground">Customer messages will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <Card key={message.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{message.customer_name}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">{message.last_message}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{message.timestamp}</p>
                        {message.unread_count > 0 && (
                          <Badge className="mt-1">{message.unread_count}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* Video Calls Tab */}
          {activeTab === 'calls' && (
            calls.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No scheduled calls</h3>
                  <p className="text-muted-foreground">Video consultation schedules will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {calls.map((call) => (
                  <Card key={call.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <Video className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{call.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{call.scheduled_time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={
                            call.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            call.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                            call.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }
                        >
                          {call.status}
                        </Badge>
                        {call.status === 'scheduled' && (
                          <Button size="sm">
                            <Phone className="h-4 w-4 mr-1" />
                            Join
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            notifications.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No notifications</h3>
                  <p className="text-muted-foreground">System notifications will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <Card key={notification.id} className={!notification.is_read ? 'bg-blue-50' : ''}>
                    <CardContent className="p-4 flex items-start gap-3">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1">
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.created_at}</p>
                      </div>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
