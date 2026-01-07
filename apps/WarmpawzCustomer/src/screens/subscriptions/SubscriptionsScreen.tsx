/**
 * Subscriptions Screen - Mobile
 * Manage recurring service subscriptions
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
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi, SubscriptionApi } from '../../services/api';

interface SubscriptionsScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Subscription {
  id: string;
  serviceType: string;
  serviceName: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  nextDelivery: string;
  status: 'active' | 'paused' | 'cancelled';
  amount: number;
  petName?: string;
}

export function SubscriptionsScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: SubscriptionsScreenProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      if (customerId) {
        const response = await SubscriptionApi.getSubscriptions(customerId);
        const subscriptionsData = (response as any).subscriptions || Array.isArray(response) ? response : [];
        
        const formattedSubscriptions: Subscription[] = subscriptionsData.map((sub: any) => ({
          id: sub.id || sub.subscriptionId,
          serviceType: sub.serviceType || sub.service_type || 'service',
          serviceName: sub.planName || sub.serviceName || sub.name || 'Subscription',
          frequency: (sub.billingCycle || sub.frequency || 'monthly') as any,
          nextDelivery: sub.nextBillingDate || sub.nextDelivery || new Date().toISOString(),
          status: (sub.status || 'active') as any,
          amount: sub.price || sub.amount || 0,
          petName: sub.petName || sub.pet_name,
        }));
        
        setSubscriptions(formattedSubscriptions);
      }
    } catch (error: any) {
      console.error('Error loading subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (subscriptionId: string) => {
    Alert.alert(
      'Pause Subscription',
      'Are you sure you want to pause this subscription?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause',
          onPress: async () => {
            try {
              await SubscriptionApi.pauseSubscription(subscriptionId);
              setSubscriptions(subscriptions.map(sub =>
                sub.id === subscriptionId ? { ...sub, status: 'paused' } : sub
              ));
              Alert.alert('Success', 'Subscription paused successfully');
            } catch (error: any) {
              console.error('Error pausing subscription:', error);
              Alert.alert('Error', error.message || 'Failed to pause subscription');
            }
          },
        },
      ]
    );
  };

  const handleResume = async (subscriptionId: string) => {
    try {
      await SubscriptionApi.resumeSubscription(subscriptionId);
      setSubscriptions(subscriptions.map(sub =>
        sub.id === subscriptionId ? { ...sub, status: 'active' } : sub
      ));
      Alert.alert('Success', 'Subscription resumed successfully');
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      Alert.alert('Error', error.message || 'Failed to resume subscription');
    }
  };

  const handleCancel = async (subscriptionId: string) => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel this subscription?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await SubscriptionApi.cancelSubscription(subscriptionId, 'Customer requested cancellation');
              setSubscriptions(subscriptions.map(sub =>
                sub.id === subscriptionId ? { ...sub, status: 'cancelled' } : sub
              ));
              Alert.alert('Success', 'Subscription cancelled successfully');
            } catch (error: any) {
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', error.message || 'Failed to cancel subscription');
            }
          },
        },
      ]
    );
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      biweekly: 'Bi-weekly',
      monthly: 'Monthly',
    };
    return labels[freq] || freq;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#16a34a';
      case 'paused': return '#f59e0b';
      case 'cancelled': return {colors.error};
      default: return colors.textSecondary;
    }
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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriptions</Text>
        <View style={styles.placeholder} />
      </View>

      {subscriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Active Subscriptions</Text>
          <Text style={styles.emptySubtitle}>
            Subscribe to services for automatic recurring deliveries
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {subscriptions.map((subscription) => (
            <View key={subscription.id} style={styles.subscriptionCard}>
              <View style={styles.subscriptionHeader}>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.serviceName}>{subscription.serviceName}</Text>
                  {subscription.petName && (
                    <Text style={styles.petName}>For {subscription.petName}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(subscription.status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(subscription.status) },
                    ]}
                  >
                    {subscription.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.subscriptionDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Frequency</Text>
                  <Text style={styles.detailValue}>
                    {getFrequencyLabel(subscription.frequency)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Next Delivery</Text>
                  <Text style={styles.detailValue}>
                    {new Date(subscription.nextDelivery).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>₹{subscription.amount.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                {subscription.status === 'active' && (
                  <>
                    <TouchableOpacity
                      style={styles.pauseButton}
                      onPress={() => handlePause(subscription.id)}
                    >
                      <Text style={styles.pauseButtonText}>Pause</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => handleCancel(subscription.id)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
                {subscription.status === 'paused' && (
                  <TouchableOpacity
                    style={styles.resumeButton}
                    onPress={() => handleResume(subscription.id)}
                  >
                    <Text style={styles.resumeButtonText}>Resume</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  subscriptionCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  subscriptionInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  subscriptionDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: colors.gray['100'],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  pauseButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  resumeButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.error + 20% opacity,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
});

