/**
 * Community Screen - Mobile
 * Pet community, forums, and social features
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface CommunityScreenProps {
  phone: string;
  customerId?: string;
  onNavigate?: (screen: string, data?: any) => void;
}

export function CommunityScreen({
  phone,
  customerId,
  onNavigate,
}: CommunityScreenProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'forums' | 'events'>('feed');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'forums' && styles.tabActive]}
          onPress={() => setActiveTab('forums')}
        >
          <Text style={[styles.tabText, activeTab === 'forums' && styles.tabTextActive]}>
            Forums
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            Events
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'feed' && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Community Feed</Text>
            <Text style={styles.emptySubtitle}>
              Connect with other pet parents, share stories, and get advice
            </Text>
            <Text style={styles.comingSoon}>Coming Soon</Text>
          </View>
        )}

        {activeTab === 'forums' && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>Forums</Text>
            <Text style={styles.emptySubtitle}>
              Join discussions about pet care, health, training, and more
            </Text>
            <Text style={styles.comingSoon}>Coming Soon</Text>
          </View>
        )}

        {activeTab === 'events' && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Events</Text>
            <Text style={styles.emptySubtitle}>
              Discover pet events, meetups, and activities in your area
            </Text>
            <Text style={styles.comingSoon}>Coming Soon</Text>
          </View>
        )}
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
    backgroundColor: '#fff',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.semibold,
  },
  tabTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  comingSoon: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
});

