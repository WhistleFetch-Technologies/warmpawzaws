/**
 * Change Password Screen - Mobile
 * Change account password
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
import { CustomerApi } from '../../services/api';

interface ChangePasswordScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

export function ChangePasswordScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    try {
      setChanging(true);
      await CustomerApi.changePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
        customerId: customerId || phone,
      });

      Alert.alert(
        'Password Changed',
        'Your password has been changed successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else {
                onBack();
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please check your current password.');
    } finally {
      setChanging(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: '', color: '' };
    if (password.length < 6) return { strength: 'Weak', color: colors.error };
    if (password.length < 10) return { strength: 'Medium', color: colors.warning };
    return { strength: 'Strong', color: colors.success };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password *</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Text style={styles.eyeIcon}>{showCurrentPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password *</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min. 8 characters)"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Text style={styles.eyeIcon}>{showNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {newPassword.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.strength}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password *</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <Text style={styles.requirementItem}>• At least 8 characters</Text>
            <Text style={styles.requirementItem}>• Mix of letters and numbers</Text>
            <Text style={styles.requirementItem}>• Include special characters (recommended)</Text>
          </View>

          {/* Change Password Button */}
          <TouchableOpacity
            style={[
              styles.changeButton,
              (!currentPassword || !newPassword || !confirmPassword || changing || newPassword !== confirmPassword) && styles.changeButtonDisabled,
            ]}
            onPress={handleChangePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword || changing || newPassword !== confirmPassword}
          >
            {changing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.changeButtonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
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
  form: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.md,
  },
  eyeIcon: {
    fontSize: 20,
  },
  passwordStrengthContainer: {
    marginTop: spacing.xs,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
  requirementsContainer: {
    backgroundColor: colors.gray.100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  requirementItem: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  changeButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  changeButtonDisabled: {
    backgroundColor: colors.gray.400,
  },
  changeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

