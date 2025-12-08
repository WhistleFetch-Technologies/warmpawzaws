import { useState, useEffect, useCallback } from 'react';

interface ChatMessage {
  id: string;
  consultationId: string;
  senderId: string;
  senderName: string;
  senderType: 'customer' | 'vendor';
  message: string;
  timestamp: string;
  read: boolean;
}

interface UseAWSChimeChatProps {
  consultationId: string;
  userId: string;
  userName: string;
  userType: 'customer' | 'vendor';
}

export function useAWSChimeChat({
  consultationId,
  userId,
  userName,
  userType
}: UseAWSChimeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 2 seconds
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [consultationId]);

  useEffect(() => {
    // Poll for typing indicators
    const interval = setInterval(checkTyping, 1000);
    return () => clearInterval(interval);
  }, [consultationId]);

  const loadMessages = async () => {
    try {
      const res = await fetch(
        `/make-server-3dd53475/video/consultation/${consultationId}/chat/messages`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    try {
      const res = await fetch(
        `/make-server-3dd53475/video/consultation/${consultationId}/chat/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          },
          body: JSON.stringify({
            senderId: userId,
            senderName: userName,
            senderType: userType,
            message
          })
        }
      );

      if (res.ok) {
        await loadMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const markAsRead = async (messageIds: string[]) => {
    try {
      await fetch(
        `/make-server-3dd53475/video/consultation/${consultationId}/chat/read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          },
          body: JSON.stringify({ messageIds })
        }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendTypingIndicator = async (typing: boolean) => {
    setIsTyping(typing);
    try {
      await fetch(
        `/make-server-3dd53475/video/consultation/${consultationId}/chat/typing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          },
          body: JSON.stringify({
            userId,
            userType,
            isTyping: typing
          })
        }
      );
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  };

  const checkTyping = async () => {
    try {
      const res = await fetch(
        `/make-server-3dd53475/video/consultation/${consultationId}/chat/typing`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        const remoteTyping = data.typing.some(
          (t: any) => t.userId !== userId && t.userType !== userType
        );
        setRemoteTyping(remoteTyping);
      }
    } catch (error) {
      // Silent fail
    }
  };

  return {
    messages,
    loading,
    isTyping,
    remoteTyping,
    sendMessage,
    markAsRead,
    sendTypingIndicator
  };
}
