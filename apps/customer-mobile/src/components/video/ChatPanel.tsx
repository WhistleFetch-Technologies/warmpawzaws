/**
 * Chat Panel Component - Customer Mobile App
 * AWS Chime SDK chat integration
 * Matches web app chat functionality
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import chimeService, { ChimeChatMessage } from '../../services/chimeService';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ChatPanelProps {
  meetingId: string;
  userId: string;
  userName: string;
  otherUserName: string;
  onClose?: () => void;
}

export default function ChatPanel({
  meetingId,
  userId,
  userName,
  otherUserName,
  onClose,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChimeChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMessages();
    startPolling();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [meetingId]);

  const loadMessages = async () => {
    try {
      const chatMessages = await chimeService.getChatMessages(meetingId);
      setMessages(chatMessages);
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const startPolling = () => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Poll for new messages every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 2000);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || loading) {
      return;
    }

    const messageText = inputText.trim();
    setInputText('');
    setLoading(true);

    try {
      const newMessage = await chimeService.sendChatMessage(
        meetingId,
        messageText,
        userId,
        userName
      );
      
      setMessages(prev => [...prev, newMessage]);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Restore text on error
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChimeChatMessage }) => {
    const isOwnMessage = item.senderId === userId;
    
    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {!isOwnMessage && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
          {item.content}
        </Text>
        <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[Typography.h4, styles.headerTitle]}>Chat</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={BrandColors.neutral.gray700} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.messageId}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={BrandColors.neutral.gray400}
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim() || loading}
        >
          <Icon
            name="send"
            size={20}
            color={(!inputText.trim() || loading) ? BrandColors.neutral.gray400 : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.base,
  },
  messageContainer: {
    maxWidth: '75%',
    marginBottom: Spacing.base,
    padding: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: BrandColors.primary.orange,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.neutral.gray100,
  },
  senderName: {
    ...Typography.bodyTiny,
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  messageText: {
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  timestamp: {
    ...Typography.bodyTiny,
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.xs,
    fontSize: 10,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: BrandColors.neutral.gray200,
  },
});

