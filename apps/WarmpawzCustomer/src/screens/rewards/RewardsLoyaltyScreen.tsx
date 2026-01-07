/**
 * Rewards & Loyalty Screen - Mobile
 * Loyalty points, rewards catalog, and tier management
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
  Alert,
  Modal,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, RewardsApi } from '../../services/api';

interface RewardsLoyaltyScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface LoyaltyProfile {
  customerId: string;
  points: number;
  totalPoints?: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  tierBenefits?: {
    cashbackPercentage: number;
    prioritySupport: boolean;
    exclusiveOffers: boolean;
    discountPercentage?: number;
  };
  pointsEarned?: number;
  pointsRedeemed?: number;
  lifetimePointsEarned?: number;
  lifetimePointsRedeemed?: number;
  pointsExpiringSoon?: number;
  nextTier?: string;
  pointsToNextTier?: number;
}

interface RewardItem {
  id: string;
  name: string;
  pointsCost: number;
  cashValue: number;
  type: 'discount' | 'freebie' | 'cashback';
  description: string;
  imageUrl?: string;
}

interface PointsHistory {
  id: string;
  type: 'earned' | 'redeemed' | 'expired';
  amount: number;
  description: string;
  date: string;
  source?: string;
}

export function RewardsLoyaltyScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: RewardsLoyaltyScreenProps) {
  const [loyaltyProfile, setLoyaltyProfile] = useState<LoyaltyProfile | null>(null);
  const [rewardsCatalog, setRewardsCatalog] = useState<RewardItem[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history'>('overview');
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  useEffect(() => {
    loadLoyaltyProfile();
    loadRewardsCatalog();
    if (activeTab === 'history') {
      loadPointsHistory();
    }
  }, [customerId, activeTab]);

  const loadLoyaltyProfile = async () => {
    try {
      setLoading(true);
      if (customerId) {
        const response = await RewardsApi.getPoints(customerId);
        const profileData = (response as any).profile || response;
        
        setLoyaltyProfile({
          customerId: customerId,
          points: profileData.pointsBalance || profileData.points || 0,
          totalPoints: profileData.totalPoints || profileData.pointsBalance || 0,
          tier: (profileData.tier?.name || 'Bronze') as any,
          tierBenefits: profileData.tier?.benefits || profileData.tierBenefits || {
            cashbackPercentage: 0,
            prioritySupport: false,
            exclusiveOffers: false,
            discountPercentage: 0,
          },
          pointsEarned: profileData.pointsBalance || 0,
          pointsRedeemed: profileData.totalPointsRedeemed || 0,
          lifetimePointsEarned: profileData.totalPointsEarned || profileData.lifetimePointsEarned || 0,
          lifetimePointsRedeemed: profileData.totalPointsRedeemed || profileData.lifetimePointsRedeemed || 0,
          nextTier: profileData.nextTier || 'Silver',
          pointsToNextTier: profileData.pointsToNextTier || 1000,
        });
      }
    } catch (error: any) {
      console.error('Error loading loyalty profile:', error);
      // Set default profile on error
      setLoyaltyProfile({
        customerId: customerId || '',
        points: 0,
        totalPoints: 0,
        tier: 'Bronze',
        tierBenefits: {
          cashbackPercentage: 0,
          prioritySupport: false,
          exclusiveOffers: false,
          discountPercentage: 0,
        },
        pointsEarned: 0,
        pointsRedeemed: 0,
        lifetimePointsEarned: 0,
        lifetimePointsRedeemed: 0,
        nextTier: 'Silver',
        pointsToNextTier: 1000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRewardsCatalog = async () => {
    try {
      if (customerId) {
        const response = await RewardsApi.getAvailableRewards(customerId);
        const rewardsData = (response as any).rewards || (response as any).catalog || Array.isArray(response) ? response : [];
      
      const formattedRewards: RewardItem[] = rewardsData.map((reward: any) => ({
        id: reward.id || reward.rewardId,
        name: reward.name || reward.rewardName,
        pointsCost: reward.pointsCost || reward.points_cost || reward.points || 0,
        cashValue: reward.cashValue || reward.cash_value || reward.value || 0,
        type: (reward.type || reward.rewardType || 'cashback') as any,
        description: reward.description || reward.rewardDescription || '',
        imageUrl: reward.imageUrl || reward.image || reward.image_url,
      }));
      
      setRewardsCatalog(formattedRewards);
    } catch (error: any) {
      console.error('Error loading rewards catalog:', error);
      // Set empty array on error
      setRewardsCatalog([]);
    }
  };

  const loadPointsHistory = async () => {
    try {
      if (customerId) {
        const response = await RewardsApi.getHistory(customerId, 50, 0);
        const historyData = response.history || response || [];
        
        const formattedHistory: PointsHistory[] = historyData.map((item: any) => ({
          id: item.id || item.transactionId,
          type: (item.type || 'earned') as any,
          amount: Math.abs(item.points || item.amount || 0),
          description: item.description || item.actionKey || 'Transaction',
          date: item.timestamp || item.created_at || item.date || new Date().toISOString(),
          source: item.source || item.referenceType || '',
        }));
        
        setPointsHistory(formattedHistory);
      }
    } catch (error: any) {
      console.error('Error loading points history:', error);
      setPointsHistory([]);
    }
  };

  const handleRedeem = async (reward: RewardItem) => {
    if (!loyaltyProfile || loyaltyProfile.points < reward.pointsCost) {
      Alert.alert('Insufficient Points', `You need ${reward.pointsCost} points to redeem this reward.`);
      return;
    }

    setSelectedReward(reward);
    setShowRedeemModal(true);
  };

  const confirmRedeem = async () => {
    if (!selectedReward || !customerId) return;

    if (!customerId) {
      Alert.alert('Error', 'Customer ID required');
      return;
    }

    try {
      setRedeeming(true);
      await RewardsApi.redeemPoints(customerId, {
        points: selectedReward.pointsCost,
        rewardId: selectedReward.id,
      });
      
      Alert.alert(
        'Success',
        `You've successfully redeemed ${selectedReward.pointsCost} points for ${selectedReward.name}!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowRedeemModal(false);
              setSelectedReward(null);
              loadLoyaltyProfile();
              loadRewardsCatalog();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error redeeming reward:', error);
      Alert.alert('Error', error.message || 'Failed to redeem reward. Please try again.');
    } finally {
      setRedeeming(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Diamond':
        return '#9333EA';
      case 'Platinum':
        return '#6B7280';
      case 'Gold':
        return '#F59E0B';
      case 'Silver':
        return colors.gray['400'];
      case 'Bronze':
      default:
        return '#CD7F32';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Diamond':
        return '💎';
      case 'Platinum':
        return '👑';
      case 'Gold':
        return '🏆';
      case 'Silver':
        return '⭐';
      case 'Bronze':
      default:
        return '🥉';
    }
  };

  const getTierProgress = () => {
    if (!loyaltyProfile) return { current: 0, next: 1000, percentage: 0 };

    const tiers = {
      Bronze: { min: 0, max: 1000 },
      Silver: { min: 1000, max: 5000 },
      Gold: { min: 5000, max: 20000 },
      Platinum: { min: 20000, max: 999999 },
      Diamond: { min: 999999, max: Infinity },
    };

    const currentTier = tiers[loyaltyProfile.tier] || tiers.Bronze;
    const currentPoints = loyaltyProfile.points || 0;
    const pointsInTier = currentPoints - currentTier.min;
    const tierRange = currentTier.max - currentTier.min;
    const percentage = Math.min((pointsInTier / tierRange) * 100, 100);

    return {
      current: currentPoints,
      next: currentTier.max === Infinity ? currentPoints : currentTier.max,
      percentage,
      pointsToNext: currentTier.max === Infinity ? 0 : currentTier.max - currentPoints,
    };
  };

  const progress = getTierProgress();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards & Loyalty</Text>
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
          style={[styles.tab, activeTab === 'rewards' && styles.tabActive]}
          onPress={() => setActiveTab('rewards')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'rewards' && styles.tabTextActive,
            ]}
          >
            Rewards
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
        {activeTab === 'overview' && loyaltyProfile && (
          <View>
            {/* Points Card */}
            <View
              style={[
                styles.pointsCard,
                { backgroundColor: getTierColor(loyaltyProfile.tier) },
              ]}
            >
              <View style={styles.pointsHeader}>
                <Text style={styles.tierIcon}>
                  {getTierIcon(loyaltyProfile.tier)}
                </Text>
                <View style={styles.tierInfo}>
                  <Text style={styles.tierName}>{loyaltyProfile.tier} Member</Text>
                  <Text style={styles.pointsLabel}>Your Points</Text>
                </View>
              </View>
              <Text style={styles.pointsAmount}>
                {loyaltyProfile.points?.toLocaleString('en-IN') || '0'}
              </Text>
              <Text style={styles.pointsSubtext}>Pawints</Text>

              {/* Tier Progress */}
              {loyaltyProfile.nextTier && progress.pointsToNext > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress.percentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {progress.pointsToNext} points to {loyaltyProfile.nextTier}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>📈</Text>
                <Text style={styles.statValue}>
                  {loyaltyProfile.lifetimePointsEarned?.toLocaleString('en-IN') || '0'}
                </Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>🎁</Text>
                <Text style={styles.statValue}>
                  {loyaltyProfile.lifetimePointsRedeemed?.toLocaleString('en-IN') || '0'}
                </Text>
                <Text style={styles.statLabel}>Total Redeemed</Text>
              </View>
            </View>

            {/* Tier Benefits */}
            {loyaltyProfile.tierBenefits && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tier Benefits</Text>
                <View style={styles.benefitsList}>
                  {loyaltyProfile.tierBenefits.cashbackPercentage > 0 && (
                    <View style={styles.benefitItem}>
                      <Text style={styles.benefitIcon}>💰</Text>
                      <Text style={styles.benefitText}>
                        {loyaltyProfile.tierBenefits.cashbackPercentage}% Cashback
                      </Text>
                    </View>
                  )}
                  {loyaltyProfile.tierBenefits.discountPercentage !== undefined &&
                    loyaltyProfile.tierBenefits.discountPercentage > 0 && (
                      <View style={styles.benefitItem}>
                        <Text style={styles.benefitIcon}>🎫</Text>
                        <Text style={styles.benefitText}>
                          {loyaltyProfile.tierBenefits.discountPercentage}% Discount
                        </Text>
                      </View>
                    )}
                  {loyaltyProfile.tierBenefits.prioritySupport && (
                    <View style={styles.benefitItem}>
                      <Text style={styles.benefitIcon}>⚡</Text>
                      <Text style={styles.benefitText}>Priority Support</Text>
                    </View>
                  )}
                  {loyaltyProfile.tierBenefits.exclusiveOffers && (
                    <View style={styles.benefitItem}>
                      <Text style={styles.benefitIcon}>✨</Text>
                      <Text style={styles.benefitText}>Exclusive Offers</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => setActiveTab('rewards')}
              >
                <Text style={styles.quickActionIcon}>🎁</Text>
                <Text style={styles.quickActionText}>Browse Rewards</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => setActiveTab('history')}
              >
                <Text style={styles.quickActionIcon}>📜</Text>
                <Text style={styles.quickActionText}>View History</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <View>
            <Text style={styles.sectionTitle}>Available Rewards</Text>
            {rewardsCatalog.length > 0 ? (
              <View style={styles.rewardsList}>
                {rewardsCatalog.map((reward) => {
                  const canAfford =
                    loyaltyProfile && loyaltyProfile.points >= reward.pointsCost;

                  return (
                    <View key={reward.id} style={styles.rewardCard}>
                      <View style={styles.rewardIcon}>
                        <Text style={styles.rewardIconText}>
                          {reward.type === 'cashback'
                            ? '💰'
                            : reward.type === 'discount'
                            ? '🎫'
                            : '🎁'}
                        </Text>
                      </View>
                      <View style={styles.rewardInfo}>
                        <Text style={styles.rewardName}>{reward.name}</Text>
                        <Text style={styles.rewardDescription}>
                          {reward.description}
                        </Text>
                        <View style={styles.rewardFooter}>
                          <View>
                            <Text style={styles.rewardPoints}>
                              {reward.pointsCost} points
                            </Text>
                            <Text style={styles.rewardValue}>
                              Worth ₹{reward.cashValue}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.redeemButton,
                              !canAfford && styles.redeemButtonDisabled,
                            ]}
                            onPress={() => handleRedeem(reward)}
                            disabled={!canAfford}
                          >
                            <Text
                              style={[
                                styles.redeemButtonText,
                                !canAfford && styles.redeemButtonTextDisabled,
                              ]}
                            >
                              Redeem
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {!canAfford && loyaltyProfile && (
                          <Text style={styles.insufficientPoints}>
                            Need {reward.pointsCost - loyaltyProfile.points} more
                            points
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🎁</Text>
                <Text style={styles.emptyStateText}>No rewards available</Text>
              </View>
            )}
          </View>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <View>
            <Text style={styles.sectionTitle}>Points History</Text>
            {pointsHistory.length > 0 ? (
              <View style={styles.historyList}>
                {pointsHistory.map((item) => (
                  <View key={item.id} style={styles.historyCard}>
                    <View
                      style={[
                        styles.historyIcon,
                        {
                          backgroundColor:
                            item.type === 'earned'
                              ? '#10B98120'
                              : item.type === 'redeemed'
                              ? '#EF444420'
                              : '#6B728020',
                        },
                      ]}
                    >
                      <Text style={styles.historyIconText}>
                        {item.type === 'earned'
                          ? '➕'
                          : item.type === 'redeemed'
                          ? '➖'
                          : '⏰'}
                      </Text>
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDescription}>
                        {item.description}
                      </Text>
                      {item.source && (
                        <Text style={styles.historySource}>{item.source}</Text>
                      )}
                      <Text style={styles.historyDate}>
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyAmount,
                        {
                          color:
                            item.type === 'earned'
                              ? {colors.success}
                              : item.type === 'redeemed'
                              ? '#EF4444'
                              : '#6B7280',
                        },
                      ]}
                    >
                      {item.type === 'earned' ? '+' : '-'}
                      {item.amount}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📜</Text>
                <Text style={styles.emptyStateText}>No points history yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Start earning points by booking services!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Redeem Confirmation Modal */}
      <Modal
        visible={showRedeemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowRedeemModal(false);
          setSelectedReward(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Redemption</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowRedeemModal(false);
                  setSelectedReward(null);
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedReward && (
              <View style={styles.modalBody}>
                <View style={styles.redeemRewardCard}>
                  <Text style={styles.redeemRewardIcon}>
                    {selectedReward.type === 'cashback'
                      ? '💰'
                      : selectedReward.type === 'discount'
                      ? '🎫'
                      : '🎁'}
                  </Text>
                  <Text style={styles.redeemRewardName}>
                    {selectedReward.name}
                  </Text>
                  <Text style={styles.redeemRewardDescription}>
                    {selectedReward.description}
                  </Text>
                  <View style={styles.redeemRewardCost}>
                    <Text style={styles.redeemRewardCostLabel}>Cost:</Text>
                    <Text style={styles.redeemRewardCostValue}>
                      {selectedReward.pointsCost} points
                    </Text>
                  </View>
                  {loyaltyProfile && (
                    <View style={styles.redeemBalance}>
                      <Text style={styles.redeemBalanceLabel}>
                        Your balance after:
                      </Text>
                      <Text style={styles.redeemBalanceValue}>
                        {loyaltyProfile.points - selectedReward.pointsCost} points
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowRedeemModal(false);
                  setSelectedReward(null);
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmRedeem}
                disabled={redeeming}
              >
                {redeeming ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  pointsCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  tierIcon: {
    fontSize: 48,
    marginRight: spacing.md,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  pointsLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.white,
    opacity: 0.9,
  },
  pointsAmount: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  pointsSubtext: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.md,
  },
  progressContainer: {
    width: '100%',
    marginTop: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
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
  benefitsList: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  benefitText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  quickActionText: {
    fontSize: typography.fontSizes.xs,
    color: colors.text,
    fontWeight: '600',
  },
  rewardsList: {
    gap: spacing.md,
  },
  rewardCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  rewardIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray['200'],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rewardIconText: {
    fontSize: 32,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardName: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  rewardDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  rewardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardPoints: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  rewardValue: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  redeemButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  redeemButtonDisabled: {
    backgroundColor: colors.gray['200'],
  },
  redeemButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    fontWeight: 'bold',
  },
  redeemButtonTextDisabled: {
    color: colors.textSecondary,
  },
  insufficientPoints: {
    fontSize: typography.fontSizes.xs,
    color: '#EF4444',
    marginTop: spacing.xs,
  },
  historyList: {
    gap: spacing.md,
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  historyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  historyIconText: {
    fontSize: 24,
  },
  historyInfo: {
    flex: 1,
  },
  historyDescription: {
    fontSize: typography.fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  historySource: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  historyDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  historyAmount: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  modalTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray['100'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: typography.fontSizes.xl,
    color: colors.text,
  },
  modalBody: {
    padding: spacing.md,
  },
  redeemRewardCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  redeemRewardIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  redeemRewardName: {
    fontSize: typography.fontSizes.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  redeemRewardDescription: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  redeemRewardCost: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  redeemRewardCostLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  redeemRewardCostValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  redeemBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  redeemBalanceLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  redeemBalanceValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonTextSecondary: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    fontWeight: 'bold',
  },
  modalButtonTextPrimary: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    fontWeight: 'bold',
  },
});

