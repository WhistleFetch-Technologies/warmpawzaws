/**
 * Wallet Top-Up Screen - Mobile
 * Add money to wallet with payment options
 * Identical functionality to web app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { WalletApi } from '../../services/api';

interface WalletTopUpScreenProps {
  phone: string;
  customerId?: string;
  currentBalance?: number;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (amount: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

export function WalletTopUpScreen({
  phone,
  customerId,
  currentBalance = 0,
  onBack,
  onNavigate,
  onSuccess,
}: WalletTopUpScreenProps) {
  const [amount, setAmount] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);

  const handleQuickAmount = (quickAmount: number) => {
    setSelectedAmount(quickAmount);
    setAmount(quickAmount.toString());
  };

  const handleTopUp = async () => {
    const topUpAmount = parseFloat(amount);
    
    if (!topUpAmount || topUpAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (topUpAmount < 100) {
      Alert.alert('Error', 'Minimum top-up amount is ₹100');
      return;
    }

    try {
      setLoading(true);
      const response = await WalletApi.topUpWallet(customerId || phone, topUpAmount);
      
      if (response.paymentUrl || response.razorpayOrderId) {
        // Navigate to payment screen
        if (onNavigate) {
          onNavigate('Payment', {
            orderId: response.razorpayOrderId,
            amount: topUpAmount,
            type: 'wallet_topup',
            onSuccess: () => {
              if (onSuccess) {
                onSuccess(topUpAmount);
              }
            },
          });
        }
      } else {
        Alert.alert('Success', `₹${topUpAmount} added to wallet successfully`, [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess(topUpAmount);
              } else {
                onBack();
              }
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error topping up wallet:', error);
      Alert.alert('Error', error.message || 'Failed to top up wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Up Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>₹{currentBalance.toLocaleString()}</Text>
        </View>

        {/* Quick Amounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Amounts</Text>
          <View style={styles.quickAmountsGrid}>
            {QUICK_AMOUNTS.map((quickAmount) => (
              <TouchableOpacity
                key={quickAmount}
                style={[
                  styles.quickAmountButton,
                  selectedAmount === quickAmount && styles.quickAmountButtonSelected,
                ]}
                onPress={() => handleQuickAmount(quickAmount)}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    selectedAmount === quickAmount && styles.quickAmountTextSelected,
                  ]}
                >
                  ₹{quickAmount}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Or Enter Custom Amount</Text>
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setSelectedAmount(null);
              }}
              placeholder="Enter amount"
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          <Text style={styles.helperText}>Minimum amount: ₹100</Text>
        </View>

        {/* Offers */}
        {offers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Offers</Text>
            {offers.map((offer, index) => (
              <View key={index} style={styles.offerCard}>
                <Text style={styles.offerTitle}>{offer.title}</Text>
                <Text style={styles.offerDescription}>{offer.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top Up Button */}
        <TouchableOpacity
          style={[
            styles.topUpButton,
            (!amount || parseFloat(amount) < 100 || loading) && styles.topUpButtonDisabled,
          ]}
          onPress={handleTopUp}
          disabled={!amount || parseFloat(amount) < 100 || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.topUpButtonText}>
              Top Up ₹{amount || '0'}
            </Text>
          )}
        </TouchableOpacity>
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
  balanceCard: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quickAmountButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary.50,
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  quickAmountTextSelected: {
    color: colors.primary,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    padding: spacing.md,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  offerCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  offerDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  topUpButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  topUpButtonDisabled: {
    backgroundColor: colors.gray.400,
  },
  topUpButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

