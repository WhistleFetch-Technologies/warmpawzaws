/**
 * Insurance Claims Screen - Customer Mobile App
 * File and track insurance claims
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
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import InsuranceService, { InsuranceClaim } from '../../services/InsuranceService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface InsuranceClaimsScreenProps {
  route?: {
    params?: {
      policyId: string;
    };
  };
  navigation?: any;
}

export default function InsuranceClaimsScreen({
  route,
  navigation,
}: InsuranceClaimsScreenProps) {
  const { user } = useAuth();
  const policyId = route?.params?.policyId || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [claimType, setClaimType] = useState<'medical' | 'accident' | 'illness' | 'surgery'>('medical');
  const [claimAmount, setClaimAmount] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadClaims();
  }, [policyId]);

  const loadClaims = async () => {
    try {
      setLoading(true);
      // TODO: Load claims from API
      setClaims([]);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!claimAmount || !incidentDate || !description) {
      Alert.alert('Required', 'Please fill all fields');
      return;
    }

    try {
      setSubmitting(true);
      const claim = await InsuranceService.fileClaim(
        policyId,
        claimType,
        parseFloat(claimAmount),
        incidentDate,
        description,
        [] // TODO: Upload documents
      );

      if (claim) {
        Alert.alert('Claim Submitted', 'Your claim has been submitted successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowForm(false);
              loadClaims();
            },
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to submit claim');
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      Alert.alert('Error', 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'paid':
        return BrandColors.semantic.success;
      case 'under_review':
        return BrandColors.semantic.warning;
      case 'rejected':
        return BrandColors.semantic.error;
      default:
        return BrandColors.neutral.gray400;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading claims...
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
            <Text style={[Typography.h2, styles.headerTitle]}>Insurance Claims</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              File and track your claims
            </Text>
          </View>
        </View>

        {/* New Claim Button */}
        <View style={styles.actionContainer}>
          <BrandedButton
            title={showForm ? 'Cancel' : 'File New Claim'}
            onPress={() => setShowForm(!showForm)}
            variant={showForm ? 'secondary' : 'primary'}
            fullWidth
          />
        </View>

        {/* Claim Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={[Typography.h3, styles.formTitle]}>File New Claim</Text>

            {/* Claim Type */}
            <View style={styles.formSection}>
              <Text style={[Typography.bodySmall, styles.formLabel]}>Claim Type</Text>
              <View style={styles.typeButtons}>
                {(['medical', 'accident', 'illness', 'surgery'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      claimType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setClaimType(type)}
                  >
                    <Text
                      style={[
                        Typography.bodyTiny,
                        claimType === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Claim Amount */}
            <View style={styles.formSection}>
              <Text style={[Typography.bodySmall, styles.formLabel]}>Claim Amount (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter claim amount"
                placeholderTextColor={BrandColors.neutral.gray400}
                value={claimAmount}
                onChangeText={setClaimAmount}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Incident Date */}
            <View style={styles.formSection}>
              <Text style={[Typography.bodySmall, styles.formLabel]}>Incident Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={BrandColors.neutral.gray400}
                value={incidentDate}
                onChangeText={setIncidentDate}
              />
            </View>

            {/* Description */}
            <View style={styles.formSection}>
              <Text style={[Typography.bodySmall, styles.formLabel]}>Description</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Describe the incident..."
                placeholderTextColor={BrandColors.neutral.gray400}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            <BrandedButton
              title={submitting ? 'Submitting...' : 'Submit Claim'}
              onPress={handleSubmitClaim}
              disabled={submitting}
              variant="primary"
              fullWidth
            />
          </View>
        )}

        {/* Claims List */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Previous Claims</Text>
          {claims.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="description" size={48} color={BrandColors.neutral.gray300} />
              <Text style={[Typography.body, styles.emptyText]}>No claims filed yet</Text>
            </View>
          ) : (
            <View style={styles.claimsList}>
              {claims.map((claim) => (
                <View key={claim.claimId} style={styles.claimCard}>
                  <View style={styles.claimHeader}>
                    <View style={styles.claimInfo}>
                      <Text style={[Typography.body, styles.claimType]}>
                        {claim.claimType.toUpperCase()}
                      </Text>
                      <Text style={[Typography.bodySmall, styles.claimDate]}>
                        {new Date(claim.incidentDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(claim.status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          Typography.bodyTiny,
                          { color: getStatusColor(claim.status) },
                        ]}
                      >
                        {claim.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[Typography.bodySmall, styles.claimAmount]}>
                    ₹{claim.claimAmount.toLocaleString()}
                  </Text>
                  {claim.description && (
                    <Text style={[Typography.bodyTiny, styles.claimDescription]} numberOfLines={2}>
                      {claim.description}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
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
    paddingBottom: Spacing.xl,
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
  actionContainer: {
    padding: Spacing.lg,
  },
  formCard: {
    margin: Spacing.lg,
    marginTop: 0,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  formTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  formSection: {
    marginBottom: Spacing.base,
  },
  formLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  typeButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  textArea: {
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  claimsList: {
    gap: Spacing.base,
  },
  claimCard: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  claimInfo: {
    flex: 1,
  },
  claimType: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  claimDate: {
    color: BrandColors.neutral.gray600,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  claimAmount: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  claimDescription: {
    color: BrandColors.neutral.gray600,
  },
});

