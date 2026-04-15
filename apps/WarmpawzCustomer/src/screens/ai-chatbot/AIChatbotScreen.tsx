/**
 * AI Chatbot Screen - Mobile
 * AWS Bedrock-powered chatbot with symptoms checker, booking assist, and support
 * Phase 3: AI Chatbot Integration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { AIChatbotApi, SupportCrmApi } from '../../services/api';

const BOOKING_CATEGORY_IDS = [
  'vet',
  'grooming',
  'training',
  'boarding',
  'walker',
  'pharmacy',
  'cafe',
  'resort',
] as const;

function inferCategoryFromBookingMessage(msg: string): string | null {
  const m = msg.toLowerCase().trim();
  if (!m) return null;
  if (/\b(grooming|groom|groomer|bath|trim|haircut)\b/.test(m)) return 'grooming';
  if (/\b(walk|walker|walking)\b/.test(m)) return 'walker';
  if (/\b(train|trainer|training|behavior|behaviourist)\b/.test(m)) return 'training';
  if (/\b(board|boarding|kennel|daycare)\b/.test(m)) return 'boarding';
  if (/\b(vet|veterinar|veterinary|doctor|clinic)\b/.test(m)) return 'vet';
  if (/\b(pharmacy|medicine|medication)\b/.test(m)) return 'pharmacy';
  if (/\b(cafe|café)\b/.test(m)) return 'cafe';
  if (/\b(resort|holiday)\b/.test(m)) return 'resort';
  return null;
}

function alignBookingSearchPath(path: string, userMessage: string): string {
  if (!path.startsWith('/search')) return path;
  const cat = inferCategoryFromBookingMessage(userMessage);
  if (!cat) return path;
  try {
    const qIdx = path.indexOf('?');
    const base = qIdx >= 0 ? path.slice(0, qIdx) : path;
    const sp = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');
    const cur = sp.get('category') || '';
    if (cur === cat) return path;
    if (cur === 'vet' && cat !== 'vet') {
      sp.set('category', cat);
      if (!sp.get('q')?.trim()) sp.set('q', userMessage.trim());
      return `${base}?${sp.toString()}`;
    }
    if (!cur) {
      sp.set('category', cat);
      if (!sp.get('q')?.trim()) sp.set('q', userMessage.trim());
      return `${base}?${sp.toString()}`;
    }
  } catch {
    /* ignore */
  }
  return path;
}

interface AIChatbotScreenProps {
  phone: string;
  customerId?: string;
  petId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: string;
  intent?: string;
  suggestedActions?: string[];
  requiresAgent?: boolean;
}

export function AIChatbotScreen({
  phone,
  customerId,
  petId,
  onBack,
  onNavigate,
}: AIChatbotScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hi! I'm your Warmpawz AI Assistant. I can help you with:\n\n• Pet health symptoms checker\n• Smart booking assistance\n• General support questions\n\nHow can I help you today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'chat' | 'symptoms' | 'booking'>('chat');
  const scrollViewRef = useRef<ScrollView>(null);
  const lastBookingUrlRef = useRef<string | null>(null);

  const openBookingFromUrl = useCallback(
    (url: string | null | undefined) => {
      if (!onNavigate || !url) return;
      const u = String(url);
      if (u.startsWith('/search')) {
        let category: string | undefined;
        let searchQuery: string | undefined;
        try {
          const qi = u.indexOf('?');
          if (qi >= 0) {
            const sp = new URLSearchParams(u.slice(qi + 1));
            const c = sp.get('category')?.trim();
            if (c && (BOOKING_CATEGORY_IDS as readonly string[]).includes(c)) {
              category = c;
            }
            const qv = sp.get('q')?.trim();
            if (qv) searchQuery = qv;
          }
        } catch {
          /* ignore */
        }
        if (category) {
          onNavigate('ServiceDiscovery', { category });
          return;
        }
        if (searchQuery) {
          onNavigate('ServiceSearch', { query: searchQuery });
          return;
        }
        onNavigate('ServiceSearch', { browseProviders: true });
        return;
      }
      onNavigate('MainTabs', { screen: 'Services' });
    },
    [onNavigate]
  );

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    const sentText = inputText.trim();
    setInputText('');
    setSending(true);

    if (mode !== 'booking') {
      lastBookingUrlRef.current = null;
    }

    try {
      let response;
      
      if (mode === 'symptoms') {
        // Symptoms checker
        response = await AIChatbotApi.symptomsChecker({
          symptoms: sentText,
          petId,
          customerId,
          customerPhone: phone,
        });
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || 'I understand your concern. Please consult with a veterinarian for proper diagnosis.',
          timestamp: new Date().toISOString(),
          intent: 'symptoms',
          suggestedActions: ['Find Vet Clinic', 'Book Consultation', 'Search Providers'],
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        if (response.shouldSeeVet && response.vetBookingSuggested) {
          Alert.alert(
            'Veterinary Consultation Recommended',
            'Based on the symptoms, I recommend consulting with a veterinarian. Would you like me to help you find a nearby vet clinic?',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Find Vet',
                onPress: () => {
                  if (onNavigate) {
                    onNavigate('ServiceDiscovery', { category: 'vet' });
                  }
                },
              },
            ]
          );
        }
      } else if (mode === 'booking') {
        // Booking assist
        response = await AIChatbotApi.bookingAssist({
          query: sentText,
          customerId,
          customerPhone: phone,
          petId,
        });

        let bookingPath =
          typeof response.bookingUrl === 'string' && response.bookingUrl.startsWith('/')
            ? response.bookingUrl
            : '/search';
        bookingPath = alignBookingSearchPath(bookingPath, sentText);
        lastBookingUrlRef.current = bookingPath;

        const stepLabels = Array.isArray(response.nextSteps)
          ? response.nextSteps.filter(
              (s: unknown) =>
                typeof s === 'string' && s.trim() && !/^browse services$/i.test(String(s).trim())
            )
          : [];
        const suggestedActions = Array.from(
          new Set([...(stepLabels as string[]), 'Continue to booking', 'Browse Bookings'])
        );
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || "I'd be happy to help you book a service!",
          timestamp: new Date().toISOString(),
          intent: 'booking',
          suggestedActions,
        };
        
        setMessages(prev => [...prev, botMessage]);
      } else {
        // General chat
        response = await AIChatbotApi.chat({
          message: sentText,
          customerId,
          customerPhone: phone,
          conversationId: conversationId || undefined,
          petId,
          context: { widgetMode: 'chat' },
        });
        
        if (!conversationId && response.conversationId) {
          setConversationId(response.conversationId);
        }
        
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: 'bot',
          content: response.response || "I'm here to help!",
          timestamp: new Date().toISOString(),
          intent: response.intent,
          suggestedActions: ['Create Ticket', 'Contact Support'],
          requiresAgent: response.requiresAgent,
        };
        
        setMessages(prev => [...prev, botMessage]);
        
        // Check if agent handoff is needed
        if (response.requiresAgent) {
          Alert.alert(
            'Connect with Support Agent',
            'Would you like to be connected with a human support agent?',
            [
              { text: 'No, Continue', style: 'cancel' },
              {
                text: 'Yes, Connect',
                onPress: async () => {
                  await handleEscalateToAgent(response.conversationId || conversationId || '');
                },
              },
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again or contact support.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleEscalateToAgent = async (convId: string) => {
    try {
      const conversationHistory = messages
        .map(m => `${m.type}: ${m.content}`)
        .join('\n');
      
      const response = await AIChatbotApi.escalateToAgent({
        conversationId: convId,
        customerId,
        customerPhone: phone,
        reason: 'User requested human agent',
        conversationHistory,
      });
      
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        type: 'system',
        content: response.message || 'Your conversation has been escalated to a support agent. They will contact you shortly.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, systemMessage]);
      
      Alert.alert('Success', 'You have been connected with a support agent. They will contact you shortly.');
    } catch (error: any) {
      console.error('Error escalating to agent:', error);
      Alert.alert('Error', 'Failed to connect with agent. Please try again.');
    }
  };

  const handleSuggestedAction = (action: string) => {
    const a = action.toLowerCase();

    if ((a.includes('create') && a.includes('ticket')) || a.replace(/\s+/g, '') === 'createticket') {
      const recent = [...messages].reverse().filter(m => m.type === 'user').slice(0, 3);
      const transcript = recent.map(m => m.content).join('\n---\n').slice(0, 2000);
      void (async () => {
        try {
          await SupportCrmApi.createTicket({
            customerId,
            customerPhone: phone,
            subject: 'Support request (AI Assistant)',
            message: transcript || 'Customer requested support from AI Assistant.',
            source: 'ai_chatbot',
            priority: 'medium',
            category: 'general',
          });
          Alert.alert('Ticket created', 'Our support team will get back to you soon.');
        } catch (e: any) {
          console.error('createTicket', e);
          Alert.alert('Could not create ticket', 'Open Help & Support to reach us.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Help', onPress: () => onNavigate?.('HelpSupport') },
          ]);
        }
      })();
      return;
    }

    if (a.includes('contact') && a.includes('support')) {
      onNavigate?.('HelpSupport');
      return;
    }

    if ((a.includes('browse') && a.includes('booking')) || (a.includes('my') && a.includes('booking'))) {
      onNavigate?.('BookingList');
      return;
    }

    if (a === 'continue to booking') {
      openBookingFromUrl(lastBookingUrlRef.current);
      return;
    }

    if (a.includes('vet') || a.includes('clinic') || (a.includes('consultation') && !a.includes('tele'))) {
      onNavigate?.('ServiceDiscovery', { category: 'vet' });
      return;
    }

    if (a.includes('search') && a.includes('provider')) {
      onNavigate?.('ServiceDiscovery', {});
      return;
    }

    if (a.includes('browse') && a.includes('shop')) {
      onNavigate?.('Shop');
      return;
    }

    if (a.includes('book') || a.includes('slot') || a.includes('select service')) {
      openBookingFromUrl(lastBookingUrlRef.current || '/search');
    }
  };

  return (
    <ScreenShell style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'chat' && styles.modeButtonActive]}
              onPress={() => setMode('chat')}
            >
              <Text style={[styles.modeButtonText, mode === 'chat' && styles.modeButtonTextActive]}>
                Chat
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'symptoms' && styles.modeButtonActive]}
              onPress={() => setMode('symptoms')}
            >
              <Text style={[styles.modeButtonText, mode === 'symptoms' && styles.modeButtonTextActive]}>
                Symptoms
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'booking' && styles.modeButtonActive]}
              onPress={() => setMode('booking')}
            >
              <Text style={[styles.modeButtonText, mode === 'booking' && styles.modeButtonTextActive]}>
                Booking
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.type === 'user' ? styles.userMessage : styles.botMessage,
              ]}
            >
              <Text style={[
                styles.messageText,
                message.type === 'user' ? styles.userMessageText : styles.botMessageText,
              ]}>
                {message.content}
              </Text>
              
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <View style={styles.suggestedActions}>
                  {message.suggestedActions.map((action, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.actionButton}
                      onPress={() => handleSuggestedAction(action)}
                    >
                      <Text style={styles.actionButtonText}>{action}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {message.requiresAgent && (
                <TouchableOpacity
                  style={styles.escalateButton}
                  onPress={() => handleEscalateToAgent(conversationId || '')}
                >
                  <Text style={styles.escalateButtonText}>Connect with Agent</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          
          {sending && (
            <View style={styles.botMessage}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={mode === 'symptoms' ? 'Describe your pet\'s symptoms...' : mode === 'booking' ? 'What service do you need?' : 'Type your message...'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.semibold,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
  },
  messageContainer: {
    marginBottom: spacing.md,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: typography.fontSizes.md,
    lineHeight: 20,
  },
  userMessageText: {
    color: colors.white,
  },
  botMessageText: {
    color: colors.text,
  },
  suggestedActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  escalateButton: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error,
  },
  escalateButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.error,
    fontWeight: typography.fontWeights.semibold,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
  },
});

