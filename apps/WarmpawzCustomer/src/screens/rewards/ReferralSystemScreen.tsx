/**
 * Referral System Screen - Mobile
 * Invite friends, share referral code, track referrals
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, ReferralApi } from '../../services/api';

interface ReferralSystemScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ReferralProfile {
  customerId: string;
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  monthlyReferrals: number;
  monthlyEarnings: number;
}

interface ReferralHistory {
  id: string;
  refereePhone: string;
  refereeName?: string;
  status: 'pending' | 'completed' | 'expired';
  appliedAt: string;
  completedAt?: string;
  referrerEarnings: number;
  refereeEarnings: number;
}

export function ReferralSystemScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: ReferralSystemScreenProps) {
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [referralHistory, setReferralHistory] = useState<ReferralHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  useEffect(() => {
    loadReferralProfile();
    if (activeTab === 'history') {
      loadReferralHistory();
    }
  }, [customerId, phone, activeTab]);

  const resolveCustomerId = async (): Promise<string> => {
    const fromProps = customerId?.trim() || '';
    if (fromProps) return fromProps;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    try {
      const cust = await CustomerApi.getCustomerByPhone(digits);
      const id = cust?.id ?? cust?.customer_id ?? cust?.customerId;
      return id != null ? String(id).trim() : '';
    } catch {
      return '';
    }
  };

  const phoneFallbackReferralCode = () => {
    const digits = phone.replace(/\D/g, '');
    return (digits.slice(-6) || 'REF123').toUpperCase();
  };

  const loadReferralProfile = async () => {
    try {
      setLoading(true);
      const resolvedId = await resolveCustomerId();

      if (resolvedId) {
        const [codeResponse, statsResponse] = await Promise.all([
          ReferralApi.getReferralCode(resolvedId).catch(() => ({
            referralCode: 'WARM' + resolvedId.slice(-4).toUpperCase(),
          })),
          ReferralApi.getReferralStats(resolvedId).catch(() => ({})),
        ]);

        setProfile({
          customerId: resolvedId,
          referralCode:
            codeResponse.referralCode || 'WARM' + resolvedId.slice(-4).toUpperCase(),
          totalReferrals: statsResponse.totalReferrals || 0,
          completedReferrals: statsResponse.completedReferrals || 0,
          pendingReferrals: statsResponse.pendingReferrals || 0,
          totalEarnings: statsResponse.totalEarnings || 0,
          monthlyReferrals: statsResponse.monthlyReferrals || 0,
          monthlyEarnings: statsResponse.monthlyEarnings || 0,
        });
      } else {
        setProfile({
          customerId: '',
          referralCode: phoneFallbackReferralCode(),
          totalReferrals: 0,
          completedReferrals: 0,
          pendingReferrals: 0,
          totalEarnings: 0,
          monthlyReferrals: 0,
          monthlyEarnings: 0,
        });
      }
    } catch (error: any) {
      console.error('Error loading referral profile:', error);
      setProfile({
        customerId: customerId?.trim() || '',
        referralCode: customerId
          ? 'WARM' + customerId.slice(-4).toUpperCase()
          : phoneFallbackReferralCode(),
        totalReferrals: 0,
        completedReferrals: 0,
        pendingReferrals: 0,
        totalEarnings: 0,
        monthlyReferrals: 0,
        monthlyEarnings: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReferralHistory = async () => {
    try {
      const resolvedId = await resolveCustomerId();
      if (resolvedId) {
        const response = await ReferralApi.getReferralHistory(resolvedId, 50);
        const history = response.history || response || [];
        
        const referralHistory: ReferralHistory[] = history.map((h: any) => ({
          id: h.id || h.referralId,
          refereePhone: h.refereePhone || '',
          refereeName: h.refereeName || '',
          status: h.status || 'pending',
          appliedAt: h.appliedAt || h.createdAt || new Date().toISOString(),
          completedAt: h.completedAt,
          referrerEarnings: h.referrerEarnings || 0,
          refereeEarnings: h.refereeEarnings || 0,
        }));
        
        setReferralHistory(referralHistory);
      } else {
        setReferralHistory([]);
      }
    } catch (error: any) {
      console.error('Error loading referral history:', error);
      setReferralHistory([]);
    }
  };

  const copyToClipboard = () => {
    if (profile?.referralCode) {
      Clipboard.setString(profile.referralCode);
      setCopied(true);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareReferral = async () => {
    if (!profile) return;

    const shareMessage = `Join Warmpawz! Use my code ${profile.referralCode} to join and get a welcome bonus!`;

    try {
      const result = await Share.share({
        message: shareMessage,
        title: 'Join Warmpawz!',
      });

      if (result.action === Share.sharedAction) {
        if (profile.customerId) {
          try {
            await ReferralApi.sendInvite({
              customerId: profile.customerId,
              message: shareMessage,
            });
          } catch (error) {
            console.log('Share tracking failed:', error);
          }
        }
        Alert.alert('Shared!', 'Your referral code has been shared');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      copyToClipboard();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'pending':
        return '#F59E0B';
      case 'expired':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'expired':
        return 'Expired';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (!profile) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>👥</Text>
          <Text style={styles.emptyStateText}>No referral profile found</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referral Program</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'overview' && styles.tabTextActive,
            ]}
          >
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'history' && styles.tabTextActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <View>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroIcon}>🎁</Text>
              <Text style={styles.heroTitle}>Invite Friends</Text>
              <Text style={styles.heroSubtitle}>
                Share your code and earn{' '}
                <Text style={styles.heroHighlight}>100 Pawints</Text> when they
                complete their first booking!
              </Text>
            </View>

            {/* Referral Code Card */}
            <View style={styles.referralCodeCard}>
              <Text style={styles.referralCodeLabel}>Your Referral Code</Text>
              <View style={styles.referralCodeContainer}>
                <Text style={styles.referralCode}>{profile.referralCode}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={copyToClipboard}
                >
                  <Text style={styles.copyButtonText}>
                    {copied ? '✓' : '📋'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={shareReferral}
              >
                <Text style={styles.shareButtonIcon}>📤</Text>
                <Text style={styles.shareButtonText}>Share Code</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>👥</Text>
                <Text style={styles.statValue}>
                  {profile.totalReferrals || 0}
                </Text>
                <Text style={styles.statLabel}>Total Referrals</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>✅</Text>
                <Text style={styles.statValue}>
                  {profile.completedReferrals || 0}
                </Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>⏳</Text>
                <Text style={styles.statValue}>
                  {profile.pendingReferrals || 0}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>💰</Text>
                <Text style={styles.statValue}>
                  ₹{profile.totalEarnings?.toLocaleString('en-IN') || '0'}
                </Text>
                <Text style={styles.statLabel}>Total Earnings</Text>
              </View>
            </View>

            {/* How It Works */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How It Works</Text>
              <View style={styles.stepsList}>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Share Your Code</Text>
                    <Text style={styles.stepDescription}>
                      Share your unique referral code with friends and family
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>They Join & Book</Text>
                    <Text style={styles.stepDescription}>
                      Your friend uses your code and completes their first
                      booking of ₹500+
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>You Both Earn</Text>
                    <Text style={styles.stepDescription}>
                      You earn 100 Pawints, and your friend gets ₹100 wallet
                      credit!
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Rewards Info */}
            <View style={styles.rewardsInfo}>
              <Text style={styles.rewardsInfoTitle}>🎉 Rewards</Text>
              <View style={styles.rewardsList}>
                <View style={styles.rewardItem}>
                  <Text style={styles.rewardItemIcon}>🎁</Text>
                  <View style={styles.rewardItemContent}>
                    <Text style={styles.rewardItemTitle}>For You</Text>
                    <Text style={styles.rewardItemDescription}>
                      100 Pawints per successful referral
                    </Text>
                  </View>
                </View>
                <View style={styles.rewardItem}>
                  <Text style={styles.rewardItemIcon}>💰</Text>
                  <View style={styles.rewardItemContent}>
                    <Text style={styles.rewardItemTitle}>For Your Friend</Text>
                    <Text style={styles.rewardItemDescription}>
                      ₹100 wallet credit on first booking
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Monthly Stats */}
            {profile.monthlyReferrals > 0 && (
              <View style={styles.monthlyStats}>
                <Text style={styles.monthlyStatsTitle}>This Month</Text>
                <View style={styles.monthlyStatsGrid}>
                  <View style={styles.monthlyStatItem}>
                    <Text style={styles.monthlyStatValue}>
                      {profile.monthlyReferrals}
                    </Text>
                    <Text style={styles.monthlyStatLabel}>Referrals</Text>
                  </View>
                  <View style={styles.monthlyStatItem}>
                    <Text style={styles.monthlyStatValue}>
                      ₹{profile.monthlyEarnings?.toLocaleString('en-IN') || '0'}
                    </Text>
                    <Text style={styles.monthlyStatLabel}>Earnings</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <View>
            <Text style={styles.sectionTitle}>Referral History</Text>
            {referralHistory.length > 0 ? (
              <View style={styles.historyList}>
                {referralHistory.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyPhone}>
                          {item.refereePhone}
                        </Text>
                        {item.refereeName && (
                          <Text style={styles.historyName}>
                            {item.refereeName}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(item.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(item.status) },
                          ]}
                        >
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.historyDetails}>
                      <View style={styles.historyDetailItem}>
                        <Text style={styles.historyDetailLabel}>Applied:</Text>
                        <Text style={styles.historyDetailValue}>
                          {new Date(item.appliedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {item.completedAt && (
                        <View style={styles.historyDetailItem}>
                          <Text style={styles.historyDetailLabel}>
                            Completed:
                          </Text>
                          <Text style={styles.historyDetailValue}>
                            {new Date(item.completedAt).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {item.referrerEarnings > 0 && (
                        <View style={styles.historyEarnings}>
                          <Text style={styles.historyEarningsLabel}>
                            You Earned:
                          </Text>
                          <Text style={styles.historyEarningsValue}>
                            +{item.referrerEarnings} Pawints
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📜</Text>
                <Text style={styles.emptyStateText}>
                  No referral history yet
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Start sharing your code to see referrals here!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
  },
  headerTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
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
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  heroSection: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  heroIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  heroHighlight: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  referralCodeCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  referralCodeLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  referralCode: {
    flex: 1,
    fontSize: typography.fontSizes['2xl'],
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray['100'],
  },
  copyButtonText: {
    fontSize: typography.fontSizes.lg,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  shareButtonIcon: {
    fontSize: typography.fontSizes.lg,
  },
  shareButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.white,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  statIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  stepsList: {
    gap: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.white,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  rewardsInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  rewardsInfoTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  rewardsList: {
    gap: spacing.md,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardItemIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  rewardItemContent: {
    flex: 1,
  },
  rewardItemTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  rewardItemDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  monthlyStats: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  monthlyStatsTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  monthlyStatsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  monthlyStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyStatValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  monthlyStatLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  historyList: {
    gap: spacing.md,
  },
  historyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  historyInfo: {
    flex: 1,
  },
  historyPhone: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  historyName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: 'bold',
  },
  historyDetails: {
    gap: spacing.xs,
  },
  historyDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDetailLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  historyDetailValue: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    fontWeight: '600',
  },
  historyEarnings: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  historyEarningsLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  historyEarningsValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.success,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

