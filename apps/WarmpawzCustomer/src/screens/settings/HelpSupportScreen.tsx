/**
 * Help Support Screen - Mobile
 * Help and support center
 * Identical functionality to web app
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface HelpSupportScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export function HelpSupportScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: HelpSupportScreenProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const faqsSectionOffsetY = useRef(0);

  const categories = ['all', 'bookings', 'payments', 'account', 'services', 'other'];

  const goToFaqs = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, faqsSectionOffsetY.current - 12),
      animated: true,
    });
  };

  const openChat = () => {
    if (onNavigate) {
      const digits = phone.replace(/\D/g, '') || 'guest';
      onNavigate('Chat', {
        type: 'support',
        matchId: `customer-support-${digits}`,
        recipientName: 'Warmpawz Support',
      });
    }
  };

  const openAiAssistant = () => {
    if (onNavigate) {
      onNavigate('AIChatbot');
    }
  };

  useEffect(() => {
    loadFAQs();
  }, [activeCategory]);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getFAQs();
      let faqsData = Array.isArray(response) ? response : response.faqs || [];
      
      if (activeCategory !== 'all') {
        faqsData = faqsData.filter((faq: FAQ) => faq.category === activeCategory);
      }
      
      setFaqs(faqsData);
    } catch (error) {
      console.error('Error loading FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await CustomerApi.contactSupport({
        subject: contactSubject,
        message: contactMessage,
        customerId: customerId || phone,
      });
      
      Alert.alert('Success', 'Your message has been sent. We\'ll get back to you soon!');
      setContactSubject('');
      setContactMessage('');
      setShowContactForm(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary support entry points (FAQ / chat / email) */}
        <TouchableOpacity
          style={styles.supportMenuRow}
          onPress={goToFaqs}
          activeOpacity={0.7}
        >
          <View style={[styles.supportMenuIconWrap, { backgroundColor: '#e0f2fe' }]}>
            <Text style={styles.supportMenuIcon}>?</Text>
          </View>
          <View style={styles.supportMenuTextCol}>
            <Text style={styles.supportMenuTitle}>FAQ</Text>
            <Text style={styles.supportMenuSubtitle}>Find answers to common questions</Text>
          </View>
          <Text style={styles.supportMenuChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.supportMenuRow}
          onPress={openChat}
          activeOpacity={0.7}
        >
          <View style={[styles.supportMenuIconWrap, { backgroundColor: '#dcfce7' }]}>
            <Text style={styles.supportMenuIcon}>💬</Text>
          </View>
          <View style={styles.supportMenuTextCol}>
            <Text style={styles.supportMenuTitle}>Chat with Us</Text>
            <Text style={styles.supportMenuSubtitle}>Get instant support</Text>
          </View>
          <Text style={styles.supportMenuChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.supportMenuRow}
          onPress={() => setShowContactForm(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.supportMenuIconWrap, { backgroundColor: '#ede9fe' }]}>
            <Text style={styles.supportMenuIcon}>✉️</Text>
          </View>
          <View style={styles.supportMenuTextCol}>
            <Text style={styles.supportMenuTitle}>Email Support</Text>
            <Text style={styles.supportMenuSubtitle}>Send us a message</Text>
          </View>
          <Text style={styles.supportMenuChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.aiAssistantRow}
          onPress={openAiAssistant}
          activeOpacity={0.7}
        >
          <Text style={styles.quickActionIcon}>🤖</Text>
          <View style={styles.supportMenuTextCol}>
            <Text style={styles.supportMenuTitle}>AI Assistant</Text>
            <Text style={styles.supportMenuSubtitle}>Symptoms, booking, general questions</Text>
          </View>
          <Text style={styles.supportMenuChevron}>›</Text>
        </TouchableOpacity>

        {/* Contact Form */}
        {showContactForm && (
          <View style={styles.contactForm}>
            <Text style={styles.formTitle}>Contact Support</Text>
            <TextInput
              style={styles.formInput}
              value={contactSubject}
              onChangeText={setContactSubject}
              placeholder="Subject"
            />
            <TextInput
              style={[styles.formInput, styles.formTextArea]}
              value={contactMessage}
              onChangeText={setContactMessage}
              placeholder="Your message..."
              multiline
              numberOfLines={5}
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowContactForm(false);
                  setContactSubject('');
                  setContactMessage('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleContactSupport}
              >
                <Text style={styles.submitButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Categories */}
        <View style={styles.categoriesContainer}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categories}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  activeCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setActiveCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    activeCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQs */}
        <View
          style={styles.faqsContainer}
          onLayout={(e) => {
            faqsSectionOffsetY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : faqs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No FAQs found</Text>
            </View>
          ) : (
            faqs.map((faq) => (
              <TouchableOpacity
                key={faq.id}
                style={styles.faqCard}
                onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              >
                <View style={styles.faqQuestion}>
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <Text style={styles.faqIcon}>
                    {expandedFaq === faq.id ? '▲' : '▼'}
                  </Text>
                </View>
                {expandedFaq === faq.id && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  supportMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportMenuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  supportMenuIcon: {
    fontSize: 20,
  },
  supportMenuTextCol: {
    flex: 1,
  },
  supportMenuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  supportMenuSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  supportMenuChevron: {
    fontSize: 22,
    color: colors.textMuted,
    fontWeight: '300',
  },
  aiAssistantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  contactForm: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  formInput: {
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md,
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray['100'],
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  faqsContainer: {
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  faqCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  faqIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  faqAnswer: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
