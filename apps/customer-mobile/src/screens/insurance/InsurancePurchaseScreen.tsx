/**
 * Insurance Purchase Screen - Customer Mobile App
 * Purchase insurance policy for a pet
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import InsuranceService, { InsurancePlan, InsurancePolicy } from '../../services/InsuranceService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface InsurancePurchaseScreenProps {
  route?: {
    params?: {
      planId: string;
      petId: string;
      vendorId?: string;
    };
  };
  navigation?: any;
}

export default function InsurancePurchaseScreen({
  route,
  navigation,
}: InsurancePurchaseScreenProps) {
  const { user } = useAuth();
  const planId = route?.params?.planId || '';
  const petId = route?.params?.petId || '';
  const vendorId = route?.params?.vendorId || '';

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [plan, setPlan] = useState<InsurancePlan | null>(null);
  const [pet, setPet] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [planId, petId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plans, petData] = await Promise.all([
        InsuranceService.getPlans(vendorId),
        // TODO: Load pet data from API
        Promise.resolve({ id: petId, name: 'Pet' }),
      ]);

      const selectedPlan = plans.find((p) => p.id === planId);
      if (selectedPlan) {
        setPlan(selectedPlan);
      }

      if (petData) {
        setPet(petData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load plan details');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!plan || !pet) {
      Alert.alert('Error', 'Missing plan or pet information');
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Purchase ${plan.name} insurance for ${pet.name}? Premium: ₹${plan.premium}/month`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            try {
              setPurchasing(true);
              // TODO: Upload documents first
              const documents: Array<{ type: string; url: string; name: string }> = [];

              const policy = await InsuranceService.purchasePolicy(
                vendorId || '',
                planId,
                petId,
                documents
              );

              if (policy) {
                Alert.alert(
                  'Policy Purchased',
                  'Your insurance policy has been purchased successfully!',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation?.navigate('BookingConfirmation', { bookingId: policy.policyId }),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', 'Failed to purchase policy');
              }
            } catch (error) {
              console.error('Error purchasing policy:', error);
              Alert.alert('Error', 'Failed to purchase policy');
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading plan details...
        </Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.semantic.error} />
        <Text style={[Typography.h3, styles.errorText]}>Plan not found</Text>
        <BrandedButton
          title="Go Back"
          onPress={() => navigation?.goBack()}
          variant="primary"
          fullWidth
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Purchase Insurance</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              {plan.name}
            </Text>
          </View>
        </View>

        {/* Plan Summary */}
        <View style={styles.summaryCard}>
          <Text style={[Typography.h3, styles.summaryTitle]}>Plan Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={[Typography.body, styles.summaryLabel]}>Pet:</Text>
            <Text style={[Typography.body, styles.summaryValue]}>{pet?.name || 'N/A'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[Typography.body, styles.summaryLabel]}>Coverage Amount:</Text>
            <Text style={[Typography.body, styles.summaryValue]}>
              ₹{plan.coverageAmount.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[Typography.body, styles.summaryLabel]}>Monthly Premium:</Text>
            <Text style={[Typography.h4, styles.summaryValue]}>₹{plan.premium}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[Typography.body, styles.summaryLabel]}>Deductible:</Text>
            <Text style={[Typography.body, styles.summaryValue]}>₹{plan.deductible}</Text>
          </View>
        </View>

        {/* Coverage Details */}
        {plan.coverage && plan.coverage.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Coverage Includes</Text>
            <View style={styles.coverageList}>
              {plan.coverage.map((item, index) => (
                <View key={index} style={styles.coverageItem}>
                  <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                  <Text style={[Typography.bodySmall, styles.coverageText]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Exclusions */}
        {plan.exclusions && plan.exclusions.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Exclusions</Text>
            <View style={styles.exclusionsList}>
              {plan.exclusions.map((item, index) => (
                <View key={index} style={styles.exclusionItem}>
                  <Icon name="cancel" size={16} color={BrandColors.semantic.error} />
                  <Text style={[Typography.bodySmall, styles.exclusionText]}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Important Information */}
        <View style={styles.infoCard}>
          <Icon name="info" size={24} color={BrandColors.semantic.warning} />
          <View style={styles.infoContent}>
            <Text style={[Typography.bodySmall, styles.infoTitle]}>Important Information</Text>
            <Text style={[Typography.bodyTiny, styles.infoText]}>
              • Waiting period: {plan.waitingPeriod} days{'\n'}
              • Claim turnaround: {plan.claimTurnaroundTime} days{'\n'}
              • Network hospitals: {plan.networkHospitals}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Purchase Button */}
      <View style={styles.footer}>
        <View style={styles.priceRow}>
          <Text style={[Typography.body, styles.priceLabel]}>Monthly Premium</Text>
          <Text style={[Typography.h3, styles.priceValue]}>₹{plan.premium}</Text>
        </View>
        <BrandedButton
          title={purchasing ? 'Processing...' : 'Purchase Policy'}
          onPress={handlePurchase}
          disabled={purchasing}
          variant="primary"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: BrandColors.semantic.error,
    marginTop: Spacing.base,
    marginBottom: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 100,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  summaryCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  summaryTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    color: BrandColors.neutral.gray700,
  },
  summaryValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  coverageList: {
    gap: Spacing.sm,
  },
  coverageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  coverageText: {
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  exclusionsList: {
    gap: Spacing.sm,
  },
  exclusionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  exclusionText: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.semantic.warning + '20',
    borderRadius: BorderRadius.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    color: BrandColors.semantic.warning,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  infoText: {
    color: BrandColors.neutral.gray700,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
    gap: Spacing.base,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  priceLabel: {
    color: BrandColors.neutral.gray700,
  },
  priceValue: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
});

