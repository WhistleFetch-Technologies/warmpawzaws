/**
 * Chat Screen - Mobile
 * Chat with vendor/staff for bookings
 * Identical functionality to web app
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { DatingChatApi } from '../../services/api';

interface ChatScreenProps {
  bookingId: string;
  matchId?: string;
  senderId: string;
  recipientName?: string;
  recipientAvatar?: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Message {
  id: string;
  senderId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string;
  timestamp: string;
  isRead: boolean;
}

export function ChatScreen({
  bookingId,
  matchId,
  senderId,
  recipientName = 'Support',
  recipientAvatar,
  phone,
  onBack,
  onNavigate,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const chatMatchId = matchId || bookingId;

  useEffect(() => {
    loadMessages();
    // TODO: Set up real-time message listener
  }, []);

  const loadMessages = async () => {
    try {
      if (chatMatchId) {
        const response = await DatingChatApi.getMessages(chatMatchId, 50, 0);
        setMessages(response.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !chatMatchId) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      await DatingChatApi.sendMessage(chatMatchId, senderId, messageText);
      // Reload messages
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === senderId;
    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.messageOwn : styles.messageOther,
        ]}
      >
        {!isOwn && recipientAvatar && (
          <Image source={{ uri: recipientAvatar }} style={styles.avatar} />
        )}
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwn ? styles.messageTextOwn : styles.messageTextOther,
            ]}
          >
            {item.message}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwn ? styles.messageTimeOwn : styles.messageTimeOther,
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        {recipientAvatar && (
          <Image source={{ uri: recipientAvatar }} style={styles.headerAvatar} />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{recipientName}</Text>
          <Text style={styles.headerStatus}>Online</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          inverted={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: '#16a34a',
  },
  placeholder: {
    width: 60,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  messageOwn: {
    justifyContent: 'flex-end',
  },
  messageOther: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.xs,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.xs,
  },
  messageBubbleOther: {
    backgroundColor: colors.gray.200,
    borderBottomLeftRadius: borderRadius.xs,
  },
  messageText: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  messageTextOwn: {
    color: colors.white,
  },
  messageTextOther: {
    color: colors.text,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeOther: {
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.gray.100,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
    marginRight: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray.400,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

