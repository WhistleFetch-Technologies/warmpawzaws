/**
 * Insurance Services Screen - Mobile
 * Handles pet insurance provider selection and policy purchase
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
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, ApiService } from '../../services/api';

type ViewType = 
  | 'landing'
  | 'providers'
  | 'provider_detail'
  | 'plans'
  | 'policy_purchase'
  | 'confirmation';

interface InsuranceServicesScreenProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

interface InsuranceProvider {
  id: string;
  name: string;
  rating: number;
  completedPolicies: number;
  basePrice: number;
  description?: string;
}

interface InsurancePlan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  coverage: string;
  popular?: boolean;
}

export function InsuranceServicesScreen({
  phone,
  onBack,
  onNavigate,
  onViewBooking,
  data,
}: InsuranceServicesScreenProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string>('');
  const [pets, setPets] = useState<any[]>([]);
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<InsuranceProvider | null>(null);
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);
  const [stats, setStats] = useState({
    activeProviders: 0,
    policiesIssued: '10K+',
    rating: '4.7',
  });

  useEffect(() => {
    loadCustomerData();
    loadInsuranceData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      const customer = await CustomerApi.getCustomerByPhone(phone);
      if (customer) {
        setCustomerId(customer.id);
        const petsData = await CustomerApi.getPets(customer.id);
        setPets(petsData || []);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    }
  };

  const loadInsuranceData = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getServices({ roleId: 'pet_insurance' });
      const insuranceServices = response.services || [];
      
      // Get unique providers
      const vendorMap = new Map();
      insuranceServices.forEach((service: any) => {
        const vendorId = service.vendorId;
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            id: vendorId,
            name: service.vendorName,
            rating: service.vendorRating || 4.7,
            completedPolicies: service.vendorReviewCount || 0,
            basePrice: service.price || 999,
            description: service.description,
          });
        }
      });
      
      const allProviders = Array.from(vendorMap.values()) as InsuranceProvider[];
      setProviders(allProviders);
      
      setStats({
        activeProviders: allProviders.length || 12,
        policiesIssued: '10K+',
        rating: allProviders.length > 0 
          ? (allProviders.reduce((acc, p) => acc + (p.rating || 4.7), 0) / allProviders.length).toFixed(1)
          : '4.7',
      });

      // Load insurance plans from API
      try {
        const plansResponse = await CustomerApi.getInsurancePlans();
        const plansData = Array.isArray(plansResponse) ? plansResponse : (plansResponse as any).plans || [];
        
        const formattedPlans: InsurancePlan[] = plansData.map((plan: any) => ({
          id: plan.id || plan.planId,
          name: plan.name || plan.planName,
          price: plan.annualPremium || plan.premium || 0,
          period: '/year',
          features: plan.features || plan.benefits || [],
          coverage: `₹${(plan.coverageAmount || plan.coverage || 0).toLocaleString('en-IN')}`,
          popular: plan.popular || false,
        }));
        
        if (formattedPlans.length > 0) {
          setPlans(formattedPlans);
        } else {
          // Fallback to default plans if API returns empty
          setPlans([{
            id: 'basic',
            name: 'Basic Plan',
            price: 999,
            period: '/year',
            features: ['Accident coverage up to ₹50K', 'Emergency vet visits'],
            coverage: '₹50,000',
          }]);
        }
      } catch (planError) {
        console.warn('Failed to load insurance plans from API:', planError);
        // Keep existing default plans
      }
    } catch (error) {
      console.error('Error loading insurance data:', error);
      Alert.alert('Error', 'Failed to load insurance providers');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: InsuranceProvider) => {
    setSelectedProvider(provider);
    setCurrentView('provider_detail');
  };

  const handleViewPlans = () => {
    setCurrentView('plans');
  };

  const handlePlanSelect = (plan: InsurancePlan) => {
    setSelectedPlan(plan);
    if (pets.length === 1) {
      setSelectedPet(pets[0]);
      setCurrentView('policy_purchase');
    } else {
      // TODO: Show pet selection screen
      setCurrentView('policy_purchase');
    }
  };

  const handlePurchasePolicy = async () => {
    if (!selectedProvider || !selectedPlan || !selectedPet) {
      Alert.alert('Error', 'Please select provider, plan, and pet');
      return;
    }

    if (!customerId) {
      Alert.alert('Error', 'Customer ID required');
      return;
    }

    try {
      setLoading(true);
      // Calculate premium if needed
      const premium = selectedPlan.price;
      
      const response = await CustomerApi.purchaseInsurance(
        selectedPlan.id,
        customerId,
        selectedPet.id,
        premium
      );

      Alert.alert('Success', 'Insurance policy purchased successfully!', [
        { text: 'OK', onPress: () => setCurrentView('confirmation') },
      ]);
    } catch (error: any) {
      console.error('Error purchasing policy:', error);
      Alert.alert('Error', error.message || 'Failed to purchase policy. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLanding = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pet Insurance</Text>
        <Text style={styles.subtitle}>Protect your pet's health</Text>
      </View>

      <ScrollView style={styles.landingContent}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.activeProviders}</Text>
            <Text style={styles.statLabel}>Insurance Providers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.policiesIssued}</Text>
            <Text style={styles.statLabel}>Policies Issued</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>⭐ {stats.rating}</Text>
            <Text style={styles.statLabel}>Average Rating</Text>
          </View>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Why Pet Insurance?</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🛡️</Text>
            <Text style={styles.benefitText}>Comprehensive health coverage</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>💰</Text>
            <Text style={styles.benefitText}>Save on unexpected vet bills</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🏥</Text>
            <Text style={styles.benefitText}>Emergency care coverage</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>❤️</Text>
            <Text style={styles.benefitText}>Peace of mind for your pet</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setCurrentView('providers')}
        >
          <Text style={styles.primaryButtonText}>Browse Insurance Providers</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderProviders = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('landing')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insurance Providers</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <ScrollView style={styles.providerList}>
          {providers.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={styles.providerCard}
              onPress={() => handleProviderSelect(provider)}
            >
              <View style={styles.providerHeader}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerRating}>
                  ⭐ {provider.rating.toFixed(1)}
                </Text>
              </View>
              <Text style={styles.providerPolicies}>
                {provider.completedPolicies} policies issued
              </Text>
              <Text style={styles.providerPrice}>
                Starting from ₹{provider.basePrice}/year
              </Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderProviderDetail = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('providers')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedProvider?.name}</Text>
      </View>

      <ScrollView style={styles.providerDetailContainer}>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>
            ⭐ {selectedProvider?.rating.toFixed(1)} Rating
          </Text>
          <Text style={styles.policiesText}>
            {selectedProvider?.completedPolicies} policies issued
          </Text>
        </View>

        {selectedProvider?.description && (
          <Text style={styles.description}>{selectedProvider.description}</Text>
        )}

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Key Features</Text>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>Comprehensive coverage</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>Quick claim processing</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>24/7 customer support</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>Easy renewal process</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleViewPlans}
        >
          <Text style={styles.primaryButtonText}>View Insurance Plans</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderPlans = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('provider_detail')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insurance Plans</Text>
      </View>

      <ScrollView style={styles.plansContainer}>
        {plans.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              plan.popular && styles.planCardPopular,
            ]}
            onPress={() => handlePlanSelect(plan)}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Most Popular</Text>
              </View>
            )}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.planPriceContainer}>
              <Text style={styles.planPrice}>₹{plan.price.toLocaleString()}</Text>
              <Text style={styles.planPeriod}>{plan.period}</Text>
            </View>
            <Text style={styles.planCoverage}>Coverage: {plan.coverage}</Text>
            <View style={styles.planFeatures}>
              {plan.features.map((feature, idx) => (
                <View key={idx} style={styles.planFeatureItem}>
                  <Text style={styles.planFeatureIcon}>✓</Text>
                  <Text style={styles.planFeatureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.selectPlanButton,
                plan.popular && styles.selectPlanButtonPopular,
              ]}
              onPress={() => handlePlanSelect(plan)}
            >
              <Text
                style={[
                  styles.selectPlanButtonText,
                  plan.popular && styles.selectPlanButtonTextPopular,
                ]}
              >
                Select Plan
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPolicyPurchase = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentView('plans')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase Policy</Text>
      </View>

      <ScrollView style={styles.purchaseContainer}>
        {selectedPlan && (
          <View style={styles.selectedPlanCard}>
            <Text style={styles.selectedPlanName}>{selectedPlan.name}</Text>
            <Text style={styles.selectedPlanPrice}>
              ₹{selectedPlan.price.toLocaleString()}{selectedPlan.period}
            </Text>
            <Text style={styles.selectedPlanCoverage}>
              Coverage: {selectedPlan.coverage}
            </Text>
          </View>
        )}

        {selectedPet && (
          <View style={styles.selectedPetCard}>
            <Text style={styles.selectedPetTitle}>Pet</Text>
            <Text style={styles.selectedPetName}>{selectedPet.name}</Text>
            <Text style={styles.selectedPetBreed}>{selectedPet.breed}</Text>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Policy Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Provider:</Text>
            <Text style={styles.summaryValue}>{selectedProvider?.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plan:</Text>
            <Text style={styles.summaryValue}>{selectedPlan?.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pet:</Text>
            <Text style={styles.summaryValue}>{selectedPet?.name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Coverage:</Text>
            <Text style={styles.summaryValue}>{selectedPlan?.coverage}</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text style={styles.summaryTotalLabel}>Annual Premium:</Text>
            <Text style={styles.summaryTotalValue}>
              ₹{selectedPlan?.price.toLocaleString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handlePurchasePolicy}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Purchase Policy</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.confirmationContainer}>
        <Text style={styles.confirmationIcon}>✅</Text>
        <Text style={styles.confirmationTitle}>Policy Purchased!</Text>
        <Text style={styles.confirmationMessage}>
          Your pet insurance policy has been successfully purchased.
        </Text>
        {selectedPlan && (
          <View style={styles.confirmationDetails}>
            <Text style={styles.confirmationDetailText}>
              Plan: {selectedPlan.name}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Coverage: {selectedPlan.coverage}
            </Text>
            <Text style={styles.confirmationDetailText}>
              Premium: ₹{selectedPlan.price.toLocaleString()}/year
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
          <Text style={styles.primaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && currentView === 'landing') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentView === 'landing' && renderLanding()}
      {currentView === 'providers' && renderProviders()}
      {currentView === 'provider_detail' && renderProviderDetail()}
      {currentView === 'plans' && renderPlans()}
      {currentView === 'policy_purchase' && renderPolicyPurchase()}
      {currentView === 'confirmation' && renderConfirmation()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.white,
    opacity: 0.9,
  },
  landingContent: {
    flex: 1,
    padding: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
  statNumber: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  benefitsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  benefitText: {
    fontSize: typography.body,
    color: colors.text,
  },
  providerList: {
    flex: 1,
    padding: spacing.md,
  },
  providerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  providerName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  providerRating: {
    fontSize: typography.body,
    color: colors.primary,
  },
  providerPolicies: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  providerPrice: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  chevron: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    fontSize: 24,
    color: colors.textSecondary,
  },
  providerDetailContainer: {
    flex: 1,
    padding: spacing.md,
  },
  ratingContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ratingText: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  policiesText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  description: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: spacing.lg,
  },
  featuresTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureIcon: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: 'bold',
    marginRight: spacing.sm,
  },
  featureText: {
    fontSize: typography.body,
    color: colors.text,
  },
  plansContainer: {
    flex: 1,
    padding: spacing.md,
  },
  planCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray['200'],
    position: 'relative',
  },
  planCardPopular: {
    borderColor: colors.primary,
    backgroundColor: colors.error + 20% opacity,
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  popularBadgeText: {
    color: colors.white,
    fontSize: typography.caption,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  planPrice: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.primary,
  },
  planPeriod: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  planCoverage: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  planFeatures: {
    marginBottom: spacing.md,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  planFeatureIcon: {
    fontSize: typography.body,
    color: colors.primary,
    fontWeight: 'bold',
    marginRight: spacing.sm,
  },
  planFeatureText: {
    fontSize: typography.body,
    color: colors.text,
    flex: 1,
  },
  selectPlanButton: {
    backgroundColor: colors.gray['200'],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  selectPlanButtonPopular: {
    backgroundColor: colors.primary,
  },
  selectPlanButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  selectPlanButtonTextPopular: {
    color: colors.white,
  },
  purchaseContainer: {
    flex: 1,
    padding: spacing.md,
  },
  selectedPlanCard: {
    backgroundColor: colors.error + 20% opacity,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedPlanName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  selectedPlanPrice: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selectedPlanCoverage: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  selectedPetCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedPetTitle: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  selectedPetName: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selectedPetBreed: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
  },
  summaryTotalLabel: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  confirmationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  confirmationIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  confirmationTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  confirmationDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  confirmationDetailText: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

