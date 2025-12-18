/**
 * Staff List Screen - Vendor Mobile App
 * Lists all staff members for a vendor
 * Matches web app StaffManagement component
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import { BrandedButton } from '../../components/BrandedButton';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  specializations: string[];
  experience: number;
  degree: string;
  bio: string;
  consultationFee: number;
  photo: string;
  isActive: boolean;
  totalAppointments: number;
  completedAppointments: number;
  totalEarnings: number;
  rating: number;
  reviewCount: number;
  role: string;
  roleType: string;
}

export default function StaffListScreen({ navigation }: any) {
  const { vendor } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (vendor?.id) {
      loadStaff();
    }
  }, [vendor]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/vendor/${vendor?.id}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter out null values and invalid IDs (staffsvc_ are service records, not staff)
        const validStaff = (data.staff || [])
          .filter((s: any) => s !== null && s !== undefined && s.id && !s.id.startsWith('staffsvc_'))
          .map((s: any) => ({
            id: s.id,
            fullName: s.fullName || s.name || 'Unknown',
            email: s.email || '',
            phone: s.phone || '',
            specializations: s.specializations || [],
            experience: s.experience || 0,
            degree: s.degree || '',
            bio: s.bio || '',
            consultationFee: s.consultationFee || 0,
            photo: s.photo || '',
            isActive: s.isActive !== false,
            totalAppointments: s.totalAppointments || 0,
            completedAppointments: s.completedAppointments || 0,
            totalEarnings: s.totalEarnings || 0,
            rating: s.rating || 0,
            reviewCount: s.reviewCount || 0,
            role: s.role || 'Staff',
            roleType: s.roleType || 'general',
          }));
        setStaff(validStaff);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', 'Failed to load staff members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStaff();
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    Alert.alert(
      'Delete Staff',
      `Are you sure you want to remove ${staffName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/staff/${staffId}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${publicAnonKey}`,
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Success', 'Staff member removed successfully');
                loadStaff();
              } else {
                throw new Error('Failed to delete staff');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove staff member');
            }
          },
        },
      ]
    );
  };

  const renderStaffCard = (member: Staff) => (
    <TouchableOpacity
      key={member.id}
      style={styles.staffCard}
      onPress={() => {
        navigation?.navigate('StaffDetail', { staffId: member.id });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.staffHeader}>
        <View style={styles.staffAvatar}>
          {member.photo ? (
            <Text style={styles.avatarText}>Photo</Text>
          ) : (
            <Icon name="person" size={32} color={BrandColors.primary.orange} />
          )}
        </View>
        <View style={styles.staffInfo}>
          <View style={styles.staffNameRow}>
            <Text style={[Typography.h4, styles.staffName]}>
              {member.fullName}
            </Text>
            {member.isActive ? (
              <View style={styles.activeBadge}>
                <Text style={[Typography.bodyTiny, styles.activeBadgeText]}>
                  Active
                </Text>
              </View>
            ) : (
              <View style={styles.inactiveBadge}>
                <Text style={[Typography.bodyTiny, styles.inactiveBadgeText]}>
                  Inactive
                </Text>
              </View>
            )}
          </View>
          <Text style={[Typography.bodySmall, styles.staffRole]}>
            {member.role}
          </Text>
          {member.specializations.length > 0 && (
            <View style={styles.specializationsContainer}>
              {member.specializations.slice(0, 2).map((spec, idx) => (
                <View key={idx} style={styles.specializationTag}>
                  <Text style={[Typography.bodyTiny, styles.specializationText]}>
                    {spec}
                  </Text>
                </View>
              ))}
              {member.specializations.length > 2 && (
                <Text style={[Typography.bodyTiny, styles.moreSpecs]}>
                  +{member.specializations.length - 2} more
                </Text>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            navigation?.navigate('StaffDetail', { staffId: member.id });
          }}
        >
          <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
        </TouchableOpacity>
      </View>

      <View style={styles.staffStats}>
        <View style={styles.statItem}>
          <Icon name="event" size={16} color={BrandColors.neutral.gray600} />
          <Text style={[Typography.bodySmall, styles.statText]}>
            {member.totalAppointments} appointments
          </Text>
        </View>
        {member.rating > 0 && (
          <View style={styles.statItem}>
            <Icon name="star" size={16} color={BrandColors.semantic.warning} />
            <Text style={[Typography.bodySmall, styles.statText]}>
              {member.rating.toFixed(1)} ({member.reviewCount})
            </Text>
          </View>
        )}
        {member.consultationFee > 0 && (
          <View style={styles.statItem}>
            <Icon name="attach-money" size={16} color={BrandColors.semantic.success} />
            <Text style={[Typography.bodySmall, styles.statText]}>
              ₹{member.consultationFee}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.staffActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            navigation?.navigate('StaffDetail', { staffId: member.id });
          }}
        >
          <Icon name="edit" size={18} color={BrandColors.primary.orange} />
          <Text style={[Typography.bodySmall, styles.actionButtonText]}>
            View Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteStaff(member.id, member.fullName)}
        >
          <Icon name="delete" size={18} color={BrandColors.semantic.error} />
          <Text style={[Typography.bodySmall, styles.deleteButtonText]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading && staff.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading staff...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[Typography.h2, styles.title]}>Staff Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            navigation?.navigate('AddStaff', { mode: 'create' });
          }}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Staff List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BrandColors.primary.orange}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {staff.length > 0 ? (
          <View style={styles.staffList}>
            {staff.map(renderStaffCard)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="people" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.h3, styles.emptyTitle]}>No Staff Members</Text>
            <Text style={[Typography.bodySmall, styles.emptyText]}>
              Add staff members to manage your team
            </Text>
            <BrandedButton
              title="Add Staff Member"
              onPress={() => {
                navigation?.navigate('AddStaff', { mode: 'create' });
              }}
              fullWidth
              style={styles.emptyButton}
            />
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  title: {
    color: BrandColors.neutral.gray900,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  staffList: {
    padding: Spacing.base,
    gap: Spacing.base,
  },
  staffCard: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    marginBottom: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.base,
    gap: Spacing.base,
  },
  staffAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...Typography.bodyTiny,
    color: BrandColors.primary.orange,
  },
  staffInfo: {
    flex: 1,
  },
  staffNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  staffName: {
    color: BrandColors.neutral.gray900,
  },
  activeBadge: {
    backgroundColor: BrandColors.semantic.success + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  activeBadgeText: {
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
  inactiveBadge: {
    backgroundColor: BrandColors.neutral.gray300,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  inactiveBadgeText: {
    color: BrandColors.neutral.gray600,
    fontWeight: '600',
  },
  staffRole: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  specializationTag: {
    backgroundColor: BrandColors.primary.orange + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  specializationText: {
    color: BrandColors.primary.orange,
  },
  moreSpecs: {
    color: BrandColors.neutral.gray600,
  },
  moreButton: {
    padding: Spacing.xs,
  },
  staffStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
    marginBottom: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    color: BrandColors.neutral.gray700,
  },
  staffActions: {
    flexDirection: 'row',
    gap: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.primary.orange + '20',
  },
  actionButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: BrandColors.semantic.error + '20',
  },
  deleteButtonText: {
    color: BrandColors.semantic.error,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyTitle: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    maxWidth: 200,
  },
});

