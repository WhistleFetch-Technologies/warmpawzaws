/**
 * Profile Screen - Customer Mobile App
 * User profile and settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ProfileScreenProps {
  navigation?: any;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    { icon: 'pets', label: 'My Pets', onPress: () => navigation?.navigate('Pets') },
    { icon: 'account-balance-wallet', label: 'Wallet', onPress: () => navigation?.navigate('Wallet') },
    { icon: 'notifications', label: 'Notifications', onPress: () => navigation?.navigate('Notifications') },
    { icon: 'help', label: 'Help & Support', onPress: () => {} },
    { icon: 'settings', label: 'Settings', onPress: () => {} },
    { icon: 'logout', label: 'Logout', onPress: logout, color: BrandColors.semantic.error },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Icon name="person" size={40} color={BrandColors.primary.orange} />
          </View>
          <Text style={[Typography.h2, styles.name]}>{user?.name || 'User'}</Text>
          <Text style={[Typography.bodySmall, styles.phone]}>{user?.phone || ''}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation?.navigate('EditProfile')}
          >
            <Text style={[Typography.bodySmall, { color: BrandColors.primary.orange }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Icon
                  name={item.icon}
                  size={24}
                  color={item.color || BrandColors.neutral.gray700}
                />
                <Text
                  style={[
                    Typography.body,
                    styles.menuItemLabel,
                    item.color && { color: item.color },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
          ))}
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
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  name: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  phone: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.base,
  },
  editButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.primary.orange,
  },
  menu: {
    padding: Spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  menuItemLabel: {
    color: BrandColors.neutral.gray700,
  },
});

