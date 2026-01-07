/**
 * Staff Assignment Screen
 * Assign staff to bookings
 * Batch 1 - Screen 3
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi, StaffAssignmentApi } from '../../services/api';

interface StaffAssignmentScreenProps {
  bookingId: string;
  vendorId: string;
  onBack?: () => void;
  onComplete?: (assignments: any[]) => void;
}

interface StaffMember {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  isAvailable?: boolean;
}

export function StaffAssignmentScreen({
  bookingId,
  vendorId,
  onBack,
  onComplete,
}: StaffAssignmentScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await VendorApi.getStaff(vendorId);
      const staff = Array.isArray(response) ? response : response.staff || [];
      setStaffList(staff);
    } catch (error) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', 'Failed to load staff list');
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    if (selectedStaff.includes(staffId)) {
      setSelectedStaff(selectedStaff.filter(id => id !== staffId));
    } else {
      setSelectedStaff([...selectedStaff, staffId]);
    }
  };

  const handleAssign = async () => {
    if (selectedStaff.length === 0) {
      Alert.alert('Error', 'Please select at least one staff member');
      return;
    }

    setSaving(true);
    try {
      const assignmentTypes = selectedStaff.map((_, index) => 
        index === 0 ? 'primary' : 'secondary'
      );
      
      const response = await StaffAssignmentApi.assignStaff(
        bookingId,
        selectedStaff,
        assignmentTypes
      );

      if (response.success || response.assignments) {
        Alert.alert('Success', 'Staff assigned successfully!', [
          {
            text: 'OK',
            onPress: () => {
              if (onComplete) {
                onComplete(response.assignments || []);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to assign staff');
      }
    } catch (error: any) {
      console.error('Error assigning staff:', error);
      Alert.alert('Error', error.message || 'Failed to assign staff. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderStaffItem = ({ item }: { item: StaffMember }) => {
    const isSelected = selectedStaff.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.staffCard,
          isSelected && styles.staffCardSelected,
        ]}
        onPress={() => toggleStaffSelection(item.id)}
      >
        <View style={styles.staffInfo}>
          <Text style={styles.staffName}>{item.name}</Text>
          {item.role && (
            <Text style={styles.staffRole}>{item.role}</Text>
          )}
          {item.phone && (
            <Text style={styles.staffPhone}>{item.phone}</Text>
          )}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
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
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Assign Staff</Text>
        <Text style={styles.subtitle}>Select staff members for this booking</Text>
      </View>

      <FlatList
        data={staffList}
        keyExtractor={(item) => item.id}
        renderItem={renderStaffItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No staff members available</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.selectedCount}>
          {selectedStaff.length} staff member{selectedStaff.length !== 1 ? 's' : ''} selected
        </Text>
        <TouchableOpacity
          style={[styles.assignButton, (saving || selectedStaff.length === 0) && styles.assignButtonDisabled]}
          onPress={handleAssign}
          disabled={saving || selectedStaff.length === 0}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.assignButtonText}>Assign Staff</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  staffCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  staffRole: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  staffPhone: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectedCount: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  assignButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  assignButtonDisabled: {
    opacity: 0.5,
  },
  assignButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
});

