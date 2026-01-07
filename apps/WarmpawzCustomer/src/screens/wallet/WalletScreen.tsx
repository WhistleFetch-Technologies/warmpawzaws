/**
 * Wallet Screen - Mobile
 * Wallet management, top-up, and transaction history
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
  TextInput,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { WalletApi } from '../../services/api';

interface WalletScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  source: string;
  createdAt: string;
  balanceAfter?: number;
  status?: string;
}

interface WalletData {
  balance: number;
  totalEarned?: number;
  totalSpent?: number;
  transactions: Transaction[];
}

interface TopUpOffer {
  amount: number;
  bonusPercentage?: number;
  bonusAmount?: number;
  totalAmount?: number;
  popular?: boolean;
}

export function WalletScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: WalletScreenProps) {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [topUpOffers, setTopUpOffers] = useState<TopUpOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadWalletData();
    loadTopUpOffers();
  }, [customerId]);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      if (customerId) {
        // ✅ WIRED: Using actual API call (Task 5 - Endpoint Wiring)
        const response = await WalletApi.getWallet(customerId);
        setWalletData({
          balance: response.balance || 0,
          totalEarned: response.totalEarned || 0,
          totalSpent: response.totalSpent || 0,
          transactions: response.transactions || [],
        });
      }
    } catch (error: any) {
      console.error('Error loading wallet:', error);
      Alert.alert('Error', error.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const loadTopUpOffers = async () => {
    try {
      if (customerId) {
        // ✅ WIRED: Using actual API call (Task 5 - Endpoint Wiring)
        const response = await WalletApi.getTopupOffers(customerId);
        setTopUpOffers(response.offers || []);
      }
    } catch (error: any) {
      console.error('Error loading offers:', error);
      // Fallback to empty array if API fails
      setTopUpOffers([]);
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!customerId) {
      Alert.alert('Error', 'Customer ID not available');
      return;
    }

    try {
      setProcessing(true);
      // TODO: Replace with actual API call when available
      // const response = await WalletApi.initiateTopup(customerId, amount);
      // Handle Razorpay payment flow
      
      Alert.alert(
        'Top-up Initiated',
        `Top-up of ₹${amount} initiated. Complete payment to add money to wallet.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowTopUpModal(false);
              setSelectedAmount(null);
              setCustomAmount('');
              loadWalletData();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error initiating top-up:', error);
      Alert.alert('Error', 'Failed to initiate top-up. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomAmount = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < 100) {
      Alert.alert('Error', 'Minimum top-up amount is ₹100');
      return;
    }
    handleTopUp(amount);
  };

  const getFilteredTransactions = () => {
    if (!walletData?.transactions) return [];
    if (filter === 'all') return walletData.transactions;
    return walletData.transactions.filter((txn) => txn.type === filter);
  };

  const getTransactionIcon = (type: string) => {
    return type === 'credit' ? '➕' : '➖';
  };

  const getTransactionColor = (type: string) => {
    return type === 'credit' ? {colors.success} : '#EF4444';
  };

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
        <Text style={styles.headerTitle}>My Wallet</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Wallet Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{walletData?.balance?.toLocaleString('en-IN') || '0'}
          </Text>
          {walletData && (
            <View style={styles.balanceStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Earned</Text>
                <Text style={styles.statValue}>
                  ₹{walletData.totalEarned?.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Spent</Text>
                <Text style={styles.statValue}>
                  ₹{walletData.totalSpent?.toLocaleString('en-IN') || '0'}
                </Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.addMoneyButton}
            onPress={() => setShowTopUpModal(true)}
          >
            <Text style={styles.addMoneyIcon}>➕</Text>
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => setShowHistory(true)}
          >
            <Text style={styles.quickActionIcon}>📜</Text>
            <Text style={styles.quickActionText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => {
              Alert.alert('Info', 'Withdraw feature coming soon');
            }}
          >
            <Text style={styles.quickActionIcon}>💸</Text>
            <Text style={styles.quickActionText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => setShowHistory(true)}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {walletData?.transactions && walletData.transactions.length > 0 ? (
            <View style={styles.transactionsList}>
              {walletData.transactions.slice(0, 5).map((txn) => (
                <View key={txn.id} style={styles.transactionCard}>
                  <View style={styles.transactionIcon}>
                    <Text style={styles.transactionIconText}>
                      {getTransactionIcon(txn.type)}
                    </Text>
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDescription}>
                      {txn.description}
                    </Text>
                    <Text style={styles.transactionSource}>{txn.source}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.transactionAmount}>
                    <Text
                      style={[
                        styles.transactionAmountText,
                        { color: getTransactionColor(txn.type) },
                      ]}
                    >
                      {txn.type === 'credit' ? '+' : '-'}₹
                      {txn.amount.toLocaleString('en-IN')}
                    </Text>
                    {txn.balanceAfter !== undefined && (
                      <Text style={styles.transactionBalance}>
                        Balance: ₹{txn.balanceAfter.toLocaleString('en-IN')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>💳</Text>
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add money to your wallet to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Top-Up Modal */}
      <Modal
        visible={showTopUpModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowTopUpModal(false);
          setSelectedAmount(null);
          setCustomAmount('');
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Money to Wallet</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTopUpModal(false);
                  setSelectedAmount(null);
                  setCustomAmount('');
                }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Quick Amounts */}
              {topUpOffers.length > 0 && (
                <View style={styles.quickAmounts}>
                  <Text style={styles.quickAmountsLabel}>Quick Add</Text>
                  <View style={styles.quickAmountsGrid}>
                    {topUpOffers.map((offer) => (
                      <TouchableOpacity
                        key={offer.amount}
                        style={[
                          styles.quickAmountButton,
                          selectedAmount === offer.amount &&
                            styles.quickAmountButtonActive,
                          offer.popular && styles.quickAmountButtonPopular,
                        ]}
                        onPress={() => {
                          setSelectedAmount(offer.amount);
                          setCustomAmount('');
                        }}
                      >
                        {offer.popular && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularBadgeText}>Popular</Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.quickAmountText,
                            selectedAmount === offer.amount &&
                              styles.quickAmountTextActive,
                          ]}
                        >
                          ₹{offer.amount}
                        </Text>
                        {offer.bonusAmount && offer.bonusAmount > 0 && (
                          <Text style={styles.bonusText}>
                            +₹{offer.bonusAmount} bonus
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Custom Amount */}
              <View style={styles.customAmountSection}>
                <Text style={styles.customAmountLabel}>Or Enter Custom Amount</Text>
                <TextInput
                  style={styles.customAmountInput}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  placeholder="Enter amount (min ₹100)"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSecondary}
                />
                {customAmount && parseFloat(customAmount) >= 100 && (
                  <Text style={styles.customAmountHint}>
                    You will add ₹{parseFloat(customAmount).toLocaleString('en-IN')} to your wallet
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowTopUpModal(false);
                  setSelectedAmount(null);
                  setCustomAmount('');
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  if (selectedAmount) {
                    handleTopUp(selectedAmount);
                  } else if (customAmount) {
                    handleCustomAmount();
                  } else {
                    Alert.alert('Error', 'Please select or enter an amount');
                  }
                }}
                disabled={processing || (!selectedAmount && !customAmount)}
              >
                {processing ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>
                    Add ₹
                    {selectedAmount
                      ? selectedAmount.toLocaleString('en-IN')
                      : customAmount
                      ? parseFloat(customAmount).toLocaleString('en-IN')
                      : '0'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction History</Text>
              <TouchableOpacity
                onPress={() => setShowHistory(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
              {(['all', 'credit', 'debit'] as const).map((filterType) => (
                <TouchableOpacity
                  key={filterType}
                  style={[
                    styles.filterTab,
                    filter === filterType && styles.filterTabActive,
                  ]}
                  onPress={() => setFilter(filterType)}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      filter === filterType && styles.filterTabTextActive,
                    ]}
                  >
                    {filterType === 'all'
                      ? 'All'
                      : filterType === 'credit'
                      ? 'Credits'
                      : 'Debits'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.modalBody}>
              {getFilteredTransactions().length > 0 ? (
                <View style={styles.transactionsList}>
                  {getFilteredTransactions().map((txn) => (
                    <View key={txn.id} style={styles.transactionCard}>
                      <View style={styles.transactionIcon}>
                        <Text style={styles.transactionIconText}>
                          {getTransactionIcon(txn.type)}
                        </Text>
                      </View>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionDescription}>
                          {txn.description}
                        </Text>
                        <Text style={styles.transactionSource}>{txn.source}</Text>
                        <Text style={styles.transactionDate}>
                          {new Date(txn.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.transactionAmount}>
                        <Text
                          style={[
                            styles.transactionAmountText,
                            { color: getTransactionColor(txn.type) },
                          ]}
                        >
                          {txn.type === 'credit' ? '+' : '-'}₹
                          {txn.amount.toLocaleString('en-IN')}
                        </Text>
                        {txn.balanceAfter !== undefined && (
                          <Text style={styles.transactionBalance}>
                            ₹{txn.balanceAfter.toLocaleString('en-IN')}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>📜</Text>
                  <Text style={styles.emptyStateText}>
                    No {filter !== 'all' ? filter : ''} transactions found
                  </Text>
                </View>
              )}
            </ScrollView>
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
  content: {
    flex: 1,
    padding: spacing.md,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.md,
  },
  balanceStats: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    opacity: 0.8,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.white,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  addMoneyIcon: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  addMoneyText: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    color: colors.primary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
  section: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  viewAllText: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    fontWeight: '600',
  },
  transactionsList: {
    gap: spacing.sm,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray['200'],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  transactionIconText: {
    fontSize: 24,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: typography.fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  transactionSource: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  transactionDate: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: typography.fontSizes.md,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  transactionBalance: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
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
    maxHeight: 500,
  },
  quickAmounts: {
    marginBottom: spacing.lg,
  },
  quickAmountsLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickAmountButton: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray['200'],
    position: 'relative',
  },
  quickAmountButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.error + 20% opacity,
  },
  quickAmountButtonPopular: {
    borderColor: '#F59E0B',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  popularBadgeText: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    fontWeight: 'bold',
  },
  quickAmountText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  quickAmountTextActive: {
    color: colors.primary,
  },
  bonusText: {
    fontSize: typography.fontSizes.xs,
    color: colors.success,
    fontWeight: '600',
  },
  customAmountSection: {
    marginTop: spacing.md,
  },
  customAmountLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  customAmountInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
  },
  customAmountHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  filterTab: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: colors.white,
  },
});

