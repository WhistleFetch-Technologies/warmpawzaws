/**
 * Business Type Selector Screen - Vendor Mobile App
 * Matches web app BusinessTypeSelector component
 * Allows vendors to choose between Solo Provider and Multi-Staff Center
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface BusinessTypeSelectorScreenProps {
  route?: {
    params?: {
      roleName?: string;
    };
  };
  navigation?: any;
  onSelect?: (isSolo: boolean) => void;
}

export default function BusinessTypeSelectorScreen({
  route,
  navigation,
  onSelect,
}: BusinessTypeSelectorScreenProps) {
  const roleName = route?.params?.roleName || 'Service Provider';

  const handleSelect = (isSolo: boolean) => {
    if (onSelect) {
      onSelect(isSolo);
    }
    if (navigation) {
      if (isSolo) {
        navigation.navigate('SoloProviderOnboarding', {
          roleName,
        });
      } else {
        navigation.navigate('Onboarding', {
          isMultiStaff: true,
          roleName,
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        {navigation && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.body, styles.backButtonText]}>Back</Text>
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <Text style={[Typography.h1, styles.title]}>
            Select Your Business Type
          </Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Choose the option that best describes your {roleName} business
          </Text>
        </View>

        {/* Business Type Cards */}
        <View style={styles.cardsContainer}>
          {/* Solo Provider Card */}
          <TouchableOpacity
            style={[styles.card, styles.soloCard]}
            onPress={() => handleSelect(true)}
            activeOpacity={0.8}
          >
            <View style={styles.badgeContainer}>
              <View style={styles.recommendedBadge}>
                <Text style={styles.badgeText}>⭐ Recommended</Text>
              </View>
            </View>

            <View style={styles.cardHeader}>
              <View style={styles.iconCircleSolo}>
                <Icon name="person" size={40} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.cardTitle]}>
                Solo Provider
              </Text>
              <Text style={[Typography.bodySmall, styles.cardDescription]}>
                I work independently and provide services myself
              </Text>
            </View>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>One phone number</Text> - Use same number for business & operations
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Simplified registration</Text> - No GST or shop license required
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Privacy protected</Text> - Home address not shown to customers
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Quick setup</Text> - Get started in 5 minutes
                </Text>
              </View>
            </View>

            <View style={styles.perfectForContainer}>
              <Text style={styles.perfectForText}>
                <Text style={styles.perfectForBold}>Perfect for:</Text> Mobile groomers, freelance trainers, home-based pet sitters, independent vets
              </Text>
            </View>

            <BrandedButton
              title="Continue as Solo Provider →"
              onPress={() => handleSelect(true)}
              fullWidth
            />
          </TouchableOpacity>

          {/* Business/Center Card */}
          <TouchableOpacity
            style={[styles.card, styles.businessCard]}
            onPress={() => handleSelect(false)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconCircleBusiness}>
                <Icon name="business-center" size={40} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.cardTitle]}>
                Business / Center
              </Text>
              <Text style={[Typography.bodySmall, styles.cardDescription]}>
                I have a physical location with staff members
              </Text>
            </View>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Multiple staff</Text> - Add and manage team members
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Physical location</Text> - Customers visit your center
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Business documents</Text> - GST, shop license, registrations
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Advanced features</Text> - Inventory, multiple services, scheduling
                </Text>
              </View>
            </View>

            <View style={styles.perfectForContainerBusiness}>
              <Text style={styles.perfectForTextBusiness}>
                <Text style={styles.perfectForBold}>Perfect for:</Text> Pet clinics, grooming salons, training centers, pet hotels, retail stores
              </Text>
            </View>

            <BrandedButton
              title="Continue as Business →"
              onPress={() => handleSelect(false)}
              variant="outline"
              fullWidth
            />
          </TouchableOpacity>
        </View>

        {/* Upgrade Note */}
        <View style={styles.upgradeNote}>
          <Icon name="lightbulb" size={20} color={BrandColors.semantic.success} />
          <Text style={styles.upgradeText}>
            <Text style={styles.upgradeBold}>💡 Pro Tip:</Text> Start as a Solo Provider and upgrade to Business/Center later when you're ready to hire staff. It's easy and your data stays intact!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    gap: Spacing.xs,
  },
  backButtonText: {
    color: BrandColors.primary.orange,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    color: BrandColors.neutral.gray900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  soloCard: {
    borderColor: BrandColors.primary.orange,
  },
  businessCard: {
    borderColor: BrandColors.semantic.info,
  },
  badgeContainer: {
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  recommendedBadge: {
    backgroundColor: BrandColors.primary.orange,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.bodyTiny,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  iconCircleSolo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  iconCircleBusiness: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BrandColors.semantic.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  cardTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
  },
  featuresList: {
    gap: Spacing.base,
    marginBottom: Spacing.base,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  featureText: {
    ...Typography.bodySmall,
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  featureBold: {
    fontWeight: '600',
  },
  perfectForContainer: {
    backgroundColor: BrandColors.semantic.info + '20',
    borderWidth: 1,
    borderColor: BrandColors.semantic.info + '40',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  perfectForContainerBusiness: {
    backgroundColor: BrandColors.primary.purple + '20',
    borderWidth: 1,
    borderColor: BrandColors.primary.purple + '40',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  perfectForText: {
    ...Typography.bodySmall,
    color: BrandColors.semantic.info,
  },
  perfectForTextBusiness: {
    ...Typography.bodySmall,
    color: BrandColors.primary.purple,
  },
  perfectForBold: {
    fontWeight: '600',
  },
  upgradeNote: {
    flexDirection: 'row',
    backgroundColor: BrandColors.semantic.success + '20',
    borderWidth: 1,
    borderColor: BrandColors.semantic.success + '40',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  upgradeText: {
    ...Typography.bodySmall,
    color: BrandColors.semantic.success,
    flex: 1,
  },
  upgradeBold: {
    fontWeight: '600',
  },
});

