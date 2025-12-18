/**
 * Insurance Plans Screen - Customer Mobile App
 * Browse and compare pet insurance plans
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
import InsuranceService, { InsurancePlan } from '../../services/InsuranceService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface InsurancePlansScreenProps {
  route?: {
    params?: {
      vendorId?: string;
    };
  };
  navigation?: any;
}

export default function InsurancePlansScreen({
  route,
  navigation,
}: InsurancePlansScreenProps) {
  const { user } = useAuth();
  const vendorId = route?.params?.vendorId;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);

  useEffect(() => {
    loadPlans();
  }, [vendorId]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const insurancePlans = await InsuranceService.getPlans(vendorId);
      setPlans(insurancePlans);
    } catch (error) {
      console.error('Error loading insurance plans:', error);
      Alert.alert('Error', 'Failed to load insurance plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: InsurancePlan) => {
    // Navigate to insurance purchase screen
    // First, navigate to pet selection if needed, or directly to purchase
    navigation?.navigate('PetSelection', {
      vendorId: vendorId || '',
      vendorName: 'Insurance Provider',
      roleId: 'pet_insurance',
      services: [],
      insurancePlanId: plan.id,
      onPetSelect: (petId: string) => {
        navigation?.navigate('InsurancePurchase', {
          planId: plan.id,
          petId: petId,
          vendorId: vendorId,
        });
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading insurance plans...
        </Text>
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
            <Text style={[Typography.h2, styles.headerTitle]}>Pet Insurance Plans</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Choose the best coverage for your pet
            </Text>
          </View>
        </View>

        {/* Plans List */}
        {plans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="security" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>No plans available</Text>
          </View>
        ) : (
          <View style={styles.plansList}>
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  selectedPlan?.id === plan.id && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan(plan)}
                activeOpacity={0.7}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <Text style={[Typography.h4, styles.planName]}>{plan.name}</Text>
                    <Text style={[Typography.bodySmall, styles.planDescription]}>
                      {plan.description}
                    </Text>
                  </View>
                  <Icon
                    name={
                      selectedPlan?.id === plan.id
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={24}
                    color={
                      selectedPlan?.id === plan.id
                        ? BrandColors.primary.orange
                        : BrandColors.neutral.gray400
                    }
                  />
                </View>

                <View style={styles.planDetails}>
                  <View style={styles.detailRow}>
                    <Icon name="payments" size={16} color={BrandColors.neutral.gray600} />
                    <Text style={[Typography.bodySmall, styles.detailText]}>
                      ₹{plan.premium}/month
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="account-balance-wallet" size={16} color={BrandColors.neutral.gray600} />
                    <Text style={[Typography.bodySmall, styles.detailText]}>
                      Coverage: ₹{plan.coverageAmount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Icon name="local-hospital" size={16} color={BrandColors.neutral.gray600} />
                    <Text style={[Typography.bodySmall, styles.detailText]}>
                      {plan.networkHospitals} network hospitals
                    </Text>
                  </View>
                </View>

                {plan.coverage && plan.coverage.length > 0 && (
                  <View style={styles.coverageContainer}>
                    <Text style={[Typography.bodySmall, styles.coverageTitle]}>Coverage:</Text>
                    <View style={styles.coverageList}>
                      {plan.coverage.slice(0, 3).map((item, index) => (
                        <View key={index} style={styles.coverageItem}>
                          <Icon name="check-circle" size={14} color={BrandColors.semantic.success} />
                          <Text style={[Typography.bodyTiny, styles.coverageText]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      {selectedPlan && (
        <View style={styles.footer}>
          <BrandedButton
            title={`Select ${selectedPlan.name}`}
            onPress={() => handleSelectPlan(selectedPlan)}
            variant="primary"
            fullWidth
          />
        </View>
      )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 80,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  plansList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  planCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  planCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.base,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  planDescription: {
    color: BrandColors.neutral.gray600,
  },
  planDetails: {
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    color: BrandColors.neutral.gray700,
  },
  coverageContainer: {
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  coverageTitle: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  coverageList: {
    gap: Spacing.xs,
  },
  coverageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  coverageText: {
    color: BrandColors.neutral.gray600,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});

