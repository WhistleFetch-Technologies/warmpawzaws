/**
 * Staff Management Screen
 * Staff CRUD and assignment
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
  Modal,
  FlatList,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi } from '../../services/api';

interface StaffManagementScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  specializations?: string[];
  services?: string[];
  isActive: boolean;
}

export function StaffManagementScreen({
  vendorId,
  onBack,
}: StaffManagementScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [currentStaff, setCurrentStaff] = useState<Partial<Staff>>({
    name: '',
    phone: '',
    email: '',
    role: 'staff',
    specializations: [],
    services: [],
    isActive: true,
  });

  useEffect(() => {
    loadStaff();
  }, [vendorId]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await VendorApi.getStaff(vendorId);
      setStaff(response.staff || []);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = () => {
    setEditingStaff(null);
    setCurrentStaff({
      name: '',
      phone: '',
      email: '',
      role: 'staff',
      specializations: [],
      services: [],
      isActive: true,
    });
    setShowAddModal(true);
  };

  const handleEditStaff = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setCurrentStaff(staffMember);
    setShowAddModal(true);
  };

  const handleDeleteStaff = async (staffId: string) => {
    Alert.alert(
      'Delete Staff',
      'Are you sure you want to remove this staff member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await VendorApi.deleteStaff(staffId);
              setStaff(staff.filter((s) => s.id !== staffId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete staff. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveStaff = async () => {
    if (!currentStaff.name || !currentStaff.phone) {
      Alert.alert('Required', 'Please fill in name and phone number');
      return;
    }

    setSaving(true);
    try {
      if (editingStaff) {
        await VendorApi.updateStaff(editingStaff.id, currentStaff);
        setStaff(staff.map((s) => (s.id === editingStaff.id ? { ...s, ...currentStaff } : s)));
      } else {
        const response = await VendorApi.addStaff(vendorId, currentStaff);
        setStaff([...staff, response.staff]);
      }
      setShowAddModal(false);
      setEditingStaff(null);
      setCurrentStaff({
        name: '',
        phone: '',
        email: '',
        role: 'staff',
        specializations: [],
        services: [],
        isActive: true,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save staff. Please try again.');
    } finally {
      setSaving(false);
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
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Staff Management</Text>
      </View>

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.staffCard}>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>{item.name}</Text>
              <Text style={styles.staffPhone}>{item.phone}</Text>
              {item.role && <Text style={styles.staffRole}>{item.role}</Text>}
            </View>
            <View style={styles.staffActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditStaff(item)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteStaff(item.id)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No staff members added yet</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddStaff}>
        <Text style={styles.addButtonText}>+ Add Staff</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingStaff ? 'Edit Staff' : 'Add Staff'}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>
                  Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter staff name"
                  value={currentStaff.name}
                  onChangeText={(text) => setCurrentStaff({ ...currentStaff, name: text })}
                />

                <Text style={styles.label}>
                  Phone <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone number"
                  value={currentStaff.phone}
                  onChangeText={(text) => setCurrentStaff({ ...currentStaff, phone: text })}
                  keyboardType="phone-pad"
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email (optional)"
                  value={currentStaff.email}
                  onChangeText={(text) => setCurrentStaff({ ...currentStaff, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Role</Text>
                <View style={styles.roleButtons}>
                  {['staff', 'doctor', 'groomer', 'trainer', 'walker'].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleButton,
                        currentStaff.role === role && styles.roleButtonSelected,
                      ]}
                      onPress={() => setCurrentStaff({ ...currentStaff, role })}
                    >
                      <Text
                        style={[
                          styles.roleButtonText,
                          currentStaff.role === role && styles.roleButtonTextSelected,
                        ]}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveStaff}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingStaff ? 'Update Staff' : 'Add Staff'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
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
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  staffCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  staffInfo: {
    marginBottom: spacing.sm,
  },
  staffName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  staffPhone: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  staffRole: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
  },
  staffActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: typography.fontSizes.sm,
    color: '#3B82F6',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.error,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  addButton: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: typography.fontSizes.lg,
    color: colors.text,
  },
  formSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
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
  roleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  roleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roleButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  roleButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  roleButtonTextSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

