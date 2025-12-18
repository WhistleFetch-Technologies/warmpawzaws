/**
 * Profile Screen - Vendor Mobile App
 * Vendor profile and settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, Spacing } from '../../theme';
import { BrandedButton } from '../../components/BrandedButton';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ProfileScreen({ navigation }: any) {
  const { vendor, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    if (navigation) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[Typography.h2, styles.title]}>Profile</Text>
          
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Icon name="business-center" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={[Typography.h3, styles.businessName]}>
                  {vendor?.businessName || 'Business Name'}
                </Text>
                <Text style={[Typography.bodySmall, styles.businessPhone]}>
                  {vendor?.phone || ''}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation?.navigate('EditProfile')}
            >
              <Icon name="edit" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.menuText]}>
                Edit Profile
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation?.navigate('StaffList')}
            >
              <Icon name="people" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.menuText]}>
                Staff Management
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation?.navigate('ScheduleManagement')}
            >
              <Icon name="schedule" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.menuText]}>
                Schedule Management
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Icon name="settings" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.menuText]}>
                Settings
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Icon name="help" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.body, styles.menuText]}>
                Help & Support
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
          </View>

          <BrandedButton
            title="Logout"
            onPress={handleLogout}
            variant="destructive"
            fullWidth
          />
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xl,
  },
  profileCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  businessName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  businessPhone: {
    color: BrandColors.neutral.gray600,
  },
  menuSection: {
    marginBottom: Spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.base,
    marginBottom: Spacing.sm,
  },
  menuText: {
    flex: 1,
    color: BrandColors.neutral.gray900,
  },
});

