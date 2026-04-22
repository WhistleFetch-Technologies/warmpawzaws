/**
 * Customer Home Screen
 * Main landing page with all service options
 * Updated with react-native-vector-icons for 100% design compliance
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { CustomerMessagesModal } from '../chat/CustomerMessagesModal';

const { width } = Dimensions.get('window');

const FAB_SIZE = 56;
const FAB_MARGIN = 12;
const DRAG_THRESHOLD = 4;

/**
 * Option A while dragging: left edge ≥ contentW/2 - FAB_MARGIN.
 * On release (and storage restore / size change), X snaps to extreme right (`maxX`); Y is preserved (clamped).
 */
function getCustomerChatFabBounds(
  contentW: number,
  contentH: number,
  rightOffset: number,
  bottomOffset: number,
) {
  const minXKeepOnScreen = FAB_MARGIN - contentW + rightOffset + FAB_SIZE;
  const minXRightHalf = contentW / 2 - FAB_MARGIN - contentW + rightOffset + FAB_SIZE;
  const minX = Math.max(minXKeepOnScreen, minXRightHalf);
  const maxX = rightOffset - FAB_MARGIN;
  const minY = FAB_MARGIN - contentH + bottomOffset + FAB_SIZE;
  const maxY = bottomOffset - FAB_MARGIN;
  return { minX, maxX, minY, maxY };
}

function clampCustomerChatFabOffset(
  nx: number,
  ny: number,
  contentW: number,
  contentH: number,
  rightOffset: number,
  bottomOffset: number,
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = getCustomerChatFabBounds(contentW, contentH, rightOffset, bottomOffset);
  let x: number;
  if (minX > maxX) {
    x = minX;
  } else {
    x = Math.max(minX, Math.min(maxX, nx));
  }
  return {
    x,
    y: Math.max(minY, Math.min(maxY, ny)),
  };
}

function snapCustomerChatFabToRight(
  ny: number,
  contentW: number,
  contentH: number,
  rightOffset: number,
  bottomOffset: number,
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = getCustomerChatFabBounds(contentW, contentH, rightOffset, bottomOffset);
  const snapX = minX > maxX ? minX : maxX;
  return {
    x: snapX,
    y: Math.max(minY, Math.min(maxY, ny)),
  };
}

interface CustomerHomeScreenProps {
  phone: string;
  customerId?: string;
  onNavigate: (screen: string, data?: any) => void;
  onProfileClick?: () => void;
  onPetClick?: (petId: string) => void;
  onAddPet?: () => void;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  age?: number;
  photo?: string;
}

interface UserData {
  name: string;
  phone: string;
  pets: Pet[];
  photo?: string;
}

export function CustomerHomeScreen({
  phone,
  customerId,
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet,
}: CustomerHomeScreenProps) {
  const [userData, setUserData] = useState<UserData>({
    name: 'User',
    phone: '',
    pets: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);
  const [chatFabOffset, setChatFabOffset] = useState({ x: 0, y: 0 });
  const chatFabOffsetRef = useRef(chatFabOffset);
  const dragMovedRef = useRef(false);
  const grantFabRef = useRef({ x: 0, y: 0 });

  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 60;

  const fabStorageKey = useMemo(
    () =>
      `warmpawz_customer_home_chat_fab_${(customerId || phone || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    [customerId, phone],
  );

  const rightFab = spacing.lg;
  const bottomFab = spacing.xl + 8;

  const getContentSize = useCallback(() => {
    const contentH = winH - insets.top - tabBarHeight;
    return { contentW: winW, contentH };
  }, [winW, winH, insets.top, tabBarHeight]);

  const clampFab = useCallback(
    (nx: number, ny: number) => {
      const { contentW, contentH } = getContentSize();
      return clampCustomerChatFabOffset(nx, ny, contentW, contentH, rightFab, bottomFab);
    },
    [getContentSize, rightFab, bottomFab],
  );

  const snapFabToRight = useCallback(
    (ny: number) => {
      const { contentW, contentH } = getContentSize();
      return snapCustomerChatFabToRight(ny, contentW, contentH, rightFab, bottomFab);
    },
    [getContentSize, rightFab, bottomFab],
  );

  useEffect(() => {
    chatFabOffsetRef.current = chatFabOffset;
  }, [chatFabOffset]);

  useEffect(() => {
    setChatFabOffset((prev) => snapFabToRight(prev.y));
  }, [snapFabToRight]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(fabStorageKey);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as { x?: number; y?: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const contentH = winH - insets.top - tabBarHeight;
          setChatFabOffset(snapCustomerChatFabToRight(parsed.y, winW, contentH, rightFab, bottomFab));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-load persisted position when the storage key (customer) changes; rotation is handled by snapFabToRight.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- winW/winH/insets intentionally omitted
  }, [fabStorageKey]);

  const persistFabOffset = useCallback(
    async (o: { x: number; y: number }) => {
      try {
        await AsyncStorage.setItem(fabStorageKey, JSON.stringify(o));
      } catch {
        /* ignore */
      }
    },
    [fabStorageKey],
  );

  // Cleanup
  useEffect(() => {
    loadUserData();

    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % 3);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [phone]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      const [profileResult, petsResult] = await Promise.all([
        CustomerApi.getProfile(phone).catch(() => null),
        CustomerApi.getPets(phone).catch(() => null),
      ]);

      if (profileResult?.profile) {
        setUserData((prev) => ({
          ...prev,
          name: profileResult.profile.firstName || 'User',
          phone: phone,
          photo: profileResult.profile.photo,
        }));
      }

      if (petsResult) {
        const pets = Array.isArray(petsResult) ? petsResult : 
                    Array.isArray(petsResult.pets) ? petsResult.pets : [];
        setUserData((prev) => ({
          ...prev,
          pets: pets,
        }));
        if (pets.length > 0 && !selectedPet) {
          setSelectedPet(pets[0]);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickServices = [
    { icon: 'medical-bag', label: 'Vet Care', color: '#3b82f6', screen: 'vet' },
    { icon: 'content-cut', label: 'Grooming', color: colors.primary, screen: 'grooming' },
    { icon: 'shopping', label: 'Shop', color: '#ec4899', screen: 'shop' },
    { icon: 'school', label: 'Training', color: '#8b5cf6', screen: 'training' },
    { icon: 'walk', label: 'Walker', color: colors.success, screen: 'walker' },
    { icon: 'home', label: 'Boarding', color: '#6366f1', screen: 'boarding' },
    { icon: 'heart', label: 'Adoption', color: '#ef4444', screen: 'adoption' },
    { icon: 'coffee', label: 'Pet Cafes', color: '#f59e0b', screen: 'cafes' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const openMessages = () => setMessagesModalOpen(true);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragMovedRef.current = false;
          grantFabRef.current = { ...chatFabOffsetRef.current };
        },
        onPanResponderMove: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > DRAG_THRESHOLD || Math.abs(gestureState.dy) > DRAG_THRESHOLD) {
            dragMovedRef.current = true;
          }
          const nx = grantFabRef.current.x + gestureState.dx;
          const ny = grantFabRef.current.y + gestureState.dy;
          if (dragMovedRef.current) {
            setChatFabOffset(clampFab(nx, ny));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (dragMovedRef.current) {
            const dragged = clampFab(
              grantFabRef.current.x + gestureState.dx,
              grantFabRef.current.y + gestureState.dy,
            );
            const next = snapFabToRight(dragged.y);
            setChatFabOffset(next);
            void persistFabOffset(next);
          } else {
            openMessages();
          }
          dragMovedRef.current = false;
        },
        onPanResponderTerminate: () => {
          dragMovedRef.current = false;
        },
      }),
    [clampFab, snapFabToRight, persistFabOffset],
  );

  return (
    <View style={styles.homeRoot}>
    <CustomerMessagesModal
      visible={messagesModalOpen}
      onClose={() => setMessagesModalOpen(false)}
      phone={phone}
      customerId={customerId}
      customerDisplayName={userData.name || 'Customer'}
      senderId={customerId || phone}
      onNavigate={onNavigate}
    />
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={onProfileClick}
            style={styles.profileButton}
          >
            {userData.photo ? (
              <Image source={{ uri: userData.photo }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {userData.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Hi, {userData.name}!</Text>
            {selectedPet && (
              <Text style={styles.subtitle}>How's {selectedPet.name} today?</Text>
            )}
            {!selectedPet && (
              <Text style={styles.subtitle}>Explore Warmpawz Services</Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={openMessages}
              style={styles.actionButton}
              accessibilityLabel="Messages"
            >
              <Icon name="message-text-outline" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onNavigate('ServiceSearch')}
              style={styles.actionButton}
            >
              <Icon name="magnify" size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onNavigate('NotificationCenter')}
              style={styles.actionButton}
            >
              <View style={styles.notificationBadge}>
                <Icon name="bell" size={20} color={colors.white} />
                <View style={styles.badgeDot} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pet Selector */}
        {userData.pets.length > 0 && (
          <View style={styles.petsSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsList}>
              {userData.pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={[
                    styles.petCard,
                    selectedPet?.id === pet.id && styles.petCardSelected,
                  ]}
                  onPress={() => {
                    setSelectedPet(pet);
                    onPetClick?.(pet.id);
                  }}
                >
                  {pet.photo ? (
                    <Image source={{ uri: pet.photo }} style={styles.petImage} />
                  ) : (
                    <View style={styles.petPlaceholder}>
                      <Text style={styles.petEmoji}>
                        {pet.type === 'dog' ? '🐕' : pet.type === 'cat' ? '🐈' : '🐾'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.petName}>{pet.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={onAddPet} style={styles.addPetCard}>
                <Icon name="plus" size={24} color={colors.white} />
                <Text style={styles.addPetLabel}>Add Pet</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Pet Dashboard */}
      {selectedPet && (
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardCard}>
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardTitle}>
                {selectedPet.name}'s Dashboard 🐾
              </Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </View>
            <Text style={styles.dashboardSubtitle}>
              {selectedPet.breed || selectedPet.type} • {selectedPet.age ? `${selectedPet.age} years old` : 'Age not set'}
            </Text>
            
            {/* Pet Metrics */}
            <View style={styles.metricsContainer}>
              <View style={[styles.metricCard, styles.metricPurple]}>
                <Icon name="chart-line" size={24} color={colors.text} />
                <Text style={styles.metricLabel}>Weight</Text>
                <Text style={styles.metricValue}>12.5 kg</Text>
                <Text style={styles.metricChange}>+0.5%</Text>
              </View>
              <View style={[styles.metricCard, styles.metricPink]}>
                <Icon name="calendar" size={24} color={colors.text} />
                <Text style={styles.metricLabel}>Checkup</Text>
                <Text style={styles.metricValue}>Oct 15</Text>
                <Text style={styles.metricChange}>14 days ago</Text>
              </View>
              <View style={[styles.metricCard, styles.metricGreen]}>
                <Icon name="heart" size={24} color={colors.text} />
                <Text style={styles.metricLabel}>Mood</Text>
                <Text style={styles.metricValue}>Happy</Text>
                <Text style={styles.metricEmoji}>😊</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Today's Hot Deals */}
      <View style={styles.dealsContainer}>
        <View style={styles.dealsHeader}>
          <Text style={styles.dealsTitle}>⚡ Today's Hot Deals</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dealsList}>
          <View style={[styles.dealCard, styles.dealBlue]}>
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>50% OFF</Text>
            </View>
            <Text style={styles.dealTitle}>Vet Checkup</Text>
            <View style={styles.dealPrice}>
              <Text style={styles.dealOriginalPrice}>₹998</Text>
              <Text style={styles.dealDiscountPrice}>₹499</Text>
            </View>
            <Icon name="stethoscope" size={40} color={colors.white} style={styles.dealIcon} />
            <TouchableOpacity
              style={styles.dealButton}
              onPress={() => onNavigate('VetServiceRouter')}
            >
              <Text style={styles.dealButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.dealCard, styles.dealGreen]}>
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>30% OFF</Text>
            </View>
            <Text style={styles.dealTitle}>Spa Grooming</Text>
            <View style={styles.dealPrice}>
              <Text style={styles.dealOriginalPrice}>₹1149</Text>
              <Text style={styles.dealDiscountPrice}>₹799</Text>
            </View>
            <Icon name="content-cut" size={40} color={colors.white} style={styles.dealIcon} />
            <TouchableOpacity
              style={styles.dealButton}
              onPress={() => onNavigate('GroomingServiceRouter')}
            >
              <Text style={styles.dealButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {/* Emergency ambulance — not live yet */}
      <View style={styles.emergencyContainer}>
        <View style={styles.emergencyCardComingSoon}>
          <View style={styles.emergencyContent}>
            <View style={styles.emergencyIconContainerMuted}>
              <Icon name="clock-outline" size={32} color={colors.white} />
            </View>
            <View style={styles.emergencyText}>
              <View style={styles.emergencyBadgeSoon}>
                <Text style={styles.emergencyBadgeText}>SOON</Text>
              </View>
              <Text style={styles.emergencyTitle}>Emergency Ambulance</Text>
              <Text style={styles.emergencySubtitle}>
                Coming soon — instant location-based dispatch when we launch
              </Text>
            </View>
            <View style={styles.emergencyPillSoon}>
              <Text style={styles.emergencyPillSoonText}>COMING SOON</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Services Grid */}
      <View style={styles.servicesSection}>
        <View style={styles.servicesHeader}>
          <Text style={styles.sectionTitle}>Quick Services</Text>
          <TouchableOpacity onPress={() => onNavigate('ServiceDiscovery')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.servicesGrid}>
          {quickServices.slice(0, 4).map((service, index) => (
            <TouchableOpacity
              key={index}
              style={styles.serviceCard}
              onPress={() => onNavigate(service.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.serviceIcon, { backgroundColor: `${service.color}20` }]}>
                <Icon name={service.icon} size={28} color={service.color} />
              </View>
              <Text style={styles.serviceLabel}>{service.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
    <View
      style={[
        styles.chatFab,
        {
          transform: [{ translateX: chatFabOffset.x }, { translateY: chatFabOffset.y }],
        },
      ]}
      {...panResponder.panHandlers}
      accessibilityLabel="Open messages"
      accessibilityRole="button"
    >
      <Icon name="message-text" size={26} color={colors.white} />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  homeRoot: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  chatFab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl + 8,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  header: {
    backgroundColor: colors.primary,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.white,
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  petsSection: {
    marginTop: spacing.md,
  },
  petsList: {
    marginTop: spacing.sm,
  },
  petCard: {
    width: 80,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  petCardSelected: {
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
  },
  addPetCard: {
    width: 80,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  addPetLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.xs / 2,
  },
  petImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
  },
  petPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petEmoji: {
    fontSize: 30,
  },
  petName: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  dashboardContainer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  dashboardCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dashboardTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  activeBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  activeBadgeText: {
    color: colors.white,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  dashboardSubtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  metricPurple: {
    backgroundColor: '#e9d5ff',
  },
  metricPink: {
    backgroundColor: '#fce7f3',
  },
  metricGreen: {
    backgroundColor: '#d1fae5',
  },
  metricLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs / 2,
  },
  metricValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  metricChange: {
    fontSize: typography.fontSizes.xs,
    color: colors.success,
    fontWeight: typography.fontWeights.semibold,
  },
  metricEmoji: {
    fontSize: 20,
    marginTop: spacing.xs / 2,
  },
  dealsContainer: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  dealsHeader: {
    marginBottom: spacing.md,
  },
  dealsTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  dealsList: {
    marginTop: spacing.sm,
  },
  dealCard: {
    width: width * 0.7,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginRight: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  dealBlue: {
    backgroundColor: '#3b82f6',
  },
  dealGreen: {
    backgroundColor: colors.success,
  },
  dealBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  dealBadgeText: {
    color: colors.text,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  dealTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  dealPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dealOriginalPrice: {
    fontSize: typography.fontSizes.sm,
    color: colors.white,
    textDecorationLine: 'line-through',
    opacity: 0.8,
  },
  dealDiscountPrice: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  dealIcon: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    opacity: 0.3,
  },
  dealButton: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  dealButtonText: {
    color: colors.text,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  servicesSection: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  serviceCard: {
    width: (width - spacing.lg * 3) / 4,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  serviceIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  serviceLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.text,
    textAlign: 'center',
  },
  emergencyContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emergencyCardComingSoon: {
    backgroundColor: '#fff7ed',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#fed7aa',
    opacity: 0.98,
  },
  emergencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyIconContainerMuted: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fb923c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  emergencyText: {
    flex: 1,
  },
  emergencyBadgeSoon: {
    alignSelf: 'flex-start',
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
  },
  emergencyBadgeText: {
    color: colors.white,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
  emergencyTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  emergencySubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  emergencyPillSoon: {
    backgroundColor: '#9ca3af',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  emergencyPillSoonText: {
    color: colors.white,
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
  },
});
