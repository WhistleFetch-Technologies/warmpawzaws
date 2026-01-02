/**
 * Vendor Onboarding Screen
 * Dynamic onboarding form based on role
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi } from '../../services/api';
import { GradientBackground, BrandedCard, StatusIcon } from '../../components/branded';

interface VendorOnboardingScreenProps {
  phone: string;
  roleId: string;
  roleName?: string;
  onComplete: (data: any) => void;
  onBack?: () => void;
  initialData?: any;
}

export function VendorOnboardingScreen({
  phone,
  roleId,
  roleName,
  onComplete,
  onBack,
}: VendorOnboardingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSection, setCurrentSection] = useState(0);

  useEffect(() => {
    loadFormConfig();
  }, [roleId]);

  const loadFormConfig = async () => {
    try {
      setLoading(true);
      const config = await VendorApi.getRoleConfig(roleId);
      setFormConfig(config);
      if (config.config?.custom) {
        const initial: Record<string, any> = {};
        config.config.custom.forEach((field: any) => {
          if (field.defaultValue) {
            initial[field.id] = field.defaultValue;
          }
        });
        setFormData(initial);
      }
    } catch (error) {
      console.error('Error loading form config:', error);
      Alert.alert('Error', 'Failed to load onboarding form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateField = (field: any, value: any): string | null => {
    if (field.validation?.required && !value) {
      return `${field.label} is required`;
    }
    if (field.validation?.minLength && value && value.length < field.validation.minLength) {
      return `${field.label} must be at least ${field.validation.minLength} characters`;
    }
    if (field.validation?.pattern && value && !new RegExp(field.validation.pattern).test(value)) {
      return `${field.label} format is invalid`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    
    if (formConfig?.config?.custom) {
      formConfig.config.custom.forEach((field: any) => {
        const error = validateField(field, formData[field.id]);
        if (error) {
          newErrors[field.id] = error;
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Validation Error', 'Please fix all errors before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const applicationData = {
        roleId,
        phone,
        formData,
        serviceStyle: formData.serviceStyle || 'both',
        location: formData.location || null,
      };

      const response = await VendorApi.submitApplication(applicationData);
      onComplete(response);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.id] || '';
    const error = errors[field.id];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder={field.placeholder}
              value={value}
              onChangeText={(text) => {
                setFormData({ ...formData, [field.id]: text });
                if (errors[field.id]) {
                  setErrors({ ...errors, [field.id]: '' });
                }
              }}
              keyboardType={field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default'}
              autoCapitalize={field.type === 'email' ? 'none' : 'words'}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'textarea':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, error && styles.inputError]}
              placeholder={field.placeholder}
              value={value}
              onChangeText={(text) => {
                setFormData({ ...formData, [field.id]: text });
                if (errors[field.id]) {
                  setErrors({ ...errors, [field.id]: '' });
                }
              }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
          </View>
        );

      case 'select':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <View style={styles.selectContainer}>
              {field.options?.map((option: any) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.selectOption,
                    value === option.value && styles.selectOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, [field.id]: option.value });
                    if (errors[field.id]) {
                      setErrors({ ...errors, [field.id]: '' });
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      value === option.value && styles.selectOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'number':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label} {field.validation?.required && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder={field.placeholder}
              value={value.toString()}
              onChangeText={(text) => {
                const numValue = text ? parseFloat(text) : '';
                setFormData({ ...formData, [field.id]: numValue });
                if (errors[field.id]) {
                  setErrors({ ...errors, [field.id]: '' });
                }
              }}
              keyboardType="numeric"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!formConfig) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load form configuration</Text>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const sections = formConfig.config?.sections || [];
  const currentSectionData = sections[currentSection];

  return (
    <GradientBackground variant="peach">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {onBack && (
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
            <View style={styles.iconContainer}>
              <StatusIcon icon="info" size={100} />
            </View>
            <Text style={styles.title}>
              {currentSectionData?.title || roleName || 'Vendor'} Information
            </Text>
            {sections.length > 1 && (
              <Text style={styles.progressText}>
                Section {currentSection + 1} of {sections.length}
              </Text>
            )}
          </View>

          <BrandedCard>
            {currentSectionData && (
              <View style={styles.section}>
                {currentSectionData.description && (
                  <Text style={styles.sectionDescription}>{currentSectionData.description}</Text>
                )}

                {currentSectionData.fields?.map((field: any) => renderField(field))}
              </View>
            )}

            <View style={styles.navigationContainer}>
          {currentSection > 0 && (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setCurrentSection(currentSection - 1)}
            >
              <Text style={styles.navButtonText}>← Previous</Text>
            </TouchableOpacity>
          )}

          {currentSection < sections.length - 1 ? (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary]}
              onPress={() => setCurrentSection(currentSection + 1)}
            >
              <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          )}
            </View>
          </BrandedCard>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSizes.md,
    color: colors.error,
    marginBottom: spacing.md,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  progressText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.error,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSizes.xs,
    color: colors.error,
    marginTop: spacing.xs / 2,
  },
  helpText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  selectContainer: {
    gap: spacing.sm,
  },
  selectOption: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  selectOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  selectOptionText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  selectOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  navButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  navButtonPrimary: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  navButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  navButtonTextPrimary: {
    color: colors.primary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
});

