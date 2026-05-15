/**
 * Customer Authentication Screen
 * Premium orange / card layout — same OTP flow, APIs, and storage as before.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
  LayoutAnimation,
  UIManager,
  Pressable,
  StatusBar,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { useScreenTopInset } from '../../components/layout/ScreenShell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomerApi, ApiService } from '../../services/api';
import { saveCustomerLoginResponse } from '../../services/auth-session';

interface CustomerAuthScreenProps {
  onAuthSuccess: (session: any) => void;
}

function formatIndianMobileDisplay(digits: string): string {
  if (!digits) return '';
  const a = digits.slice(0, 5);
  const b = digits.slice(5);
  return b ? `${a} ${b}` : a;
}

type CtaButtonProps = {
  label: string;
  onPress: () => void;
  /** True when interaction should be blocked (loading or invalid form). */
  disabled: boolean;
  loading: boolean;
  /** When true, use strong CTA colors (loading or form valid). */
  activeVisual: boolean;
};

function CtaButton({ label, onPress, disabled, loading, activeVisual }: CtaButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withTiming(0.98, { duration: 90, easing: Easing.out(Easing.quad) });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  };

  const useStrongFill = loading || activeVisual;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.ctaShell,
            useStrongFill ? styles.ctaStrong : styles.ctaMuted,
            pressed && !disabled && useStrongFill ? styles.ctaStrongPressed : null,
            animatedStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.ctaLabel, useStrongFill ? styles.ctaLabelOnDark : styles.ctaLabelMuted]}>{label}</Text>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

type AuthHeroProps = {
  topInset: number;
  mode: 'welcome' | 'verify';
};

function AuthHero({ topInset, mode }: AuthHeroProps) {
  const logoFloat = useSharedValue(0);

  useEffect(() => {
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [logoFloat]);

  const logoMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: logoFloat.value }],
  }));

  return (
    <View style={[styles.hero, { paddingTop: topInset + spacing.md }]}>
      <View style={styles.heroGradientWash} pointerEvents="none" />
      <View style={[styles.heroBlob, styles.heroBlobA]} pointerEvents="none" />
      <View style={[styles.heroBlob, styles.heroBlobB]} pointerEvents="none" />
      <View style={styles.heroVignetteTop} pointerEvents="none" />
      <View style={styles.heroVignetteBottom} pointerEvents="none" />

      <Animated.View entering={FadeInDown.duration(520)}>
        <Animated.View style={[styles.logoWrap, logoMotion]}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      {mode === 'welcome' ? (
        <>
          <Text style={styles.heroEyebrow}>Welcome</Text>
          <Text style={styles.heroBrand}>Warmpawz</Text>
          <Text style={styles.heroTagline}>Care that feels like family</Text>
        </>
      ) : (
        <Text style={styles.heroVerifyTitle}>Verify your number</Text>
      )}
    </View>
  );
}

export function CustomerAuthScreen({ onAuthSuccess }: CustomerAuthScreenProps) {
  const topInset = useScreenTopInset();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [phoneFocused, setPhoneFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [referralFocused, setReferralFocused] = useState(false);

  useEffect(() => {
    return () => {
      setError('');
      setLoading(false);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const openReferral = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowReferralInput(true);
  }, []);

  const handleSendCode = async () => {
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

      if (cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit phone number');
        setLoading(false);
        return;
      }

      const data = (await CustomerApi.generateOtp(cleanPhone)) as { uatMode?: boolean };

      if (data.uatMode) {
        Alert.alert('UAT Testing Mode', 'OTP: 123456');
      } else {
        Alert.alert('Success', 'OTP sent to your phone');
      }

      setShowOtpScreen(true);
      setResendTimer(60);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

      // The Lambda response shape (see VerifyOtpHandlerEnhanced) is the
      // canonical one: { success, data: { token: { access_token, id_token,
      // refresh_token, expires_in }, user, profile, state } }. We accept any
      // wrapping (response.data.data, response.data, or response) to stay
      // resilient to envelopes added by API Gateway/Hono.
      const apiResponse = (await CustomerApi.verifyOtp(
        cleanPhone,
        otpCode,
        referralCode || undefined
      )) as any;

      if (referralCode?.trim()) {
        await AsyncStorage.setItem('pendingReferralCode', referralCode.trim().toUpperCase());
      }

      const responseData = apiResponse?.data?.data || apiResponse?.data || apiResponse;
      const userBlock =
        responseData?.user ||
        responseData?.profile ||
        responseData?.customer ||
        apiResponse?.user ||
        apiResponse?.customer ||
        {};

      const customerId: string | undefined =
        userBlock?.id || userBlock?.customerId || userBlock?.customer_id;
      const onboardingComplete: boolean =
        userBlock?.onboardingComplete === true ||
        userBlock?.onboarding_complete === true ||
        userBlock?.profile_completed === true ||
        userBlock?.profile_complete === true ||
        userBlock?.onboarding_status === 'COMPLETED' ||
        userBlock?.onboardingStatus === 'COMPLETED';
      const petIds: string[] | undefined = userBlock?.petIds || userBlock?.pet_ids;
      const hasPets = Array.isArray(petIds) && petIds.length > 0;
      const isNewUser: boolean =
        apiResponse?.isNewUser === true ||
        responseData?.isNewUser === true ||
        responseData?.state === 'new';

      // Persist the *full* token bundle so the next cold start can restore
      // the session and so silent refresh stays usable for 90 days.
      const stored = await saveCustomerLoginResponse(apiResponse, {
        phone: cleanPhone,
        isNewLogin: true,
        isNewUser,
        hasCompletedOnboarding: onboardingComplete,
        hasPets,
      });

      const accessTokenForSession =
        stored?.accessToken ||
        responseData?.token?.access_token ||
        responseData?.sessionToken ||
        apiResponse?.sessionToken;

      // Keep the legacy single-key slot in sync as well (older code paths
      // such as background uploaders read it directly).
      if (accessTokenForSession) {
        await ApiService.saveSessionToken(accessTokenForSession);
      }

      onAuthSuccess({
        phone: cleanPhone,
        customerId: customerId || stored?.customerId,
        customer: userBlock,
        sessionToken: accessTokenForSession,
        verified: true,
        isNewUser,
        hasCompletedOnboarding: onboardingComplete,
        hasPets,
      });

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      await CustomerApi.generateOtp(cleanPhone);
      setResendTimer(60);
      Alert.alert('Success', 'OTP resent to your phone');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resend OTP');
    }
  };

  const phoneHasError = !!error && !showOtpScreen;
  const otpHasError = !!error && showOtpScreen;

  const cardContentStyle = [
    styles.cardContent,
    { paddingBottom: spacing.xl + spacing.sm },
  ];

  // OTP Verification Screen
  if (showOtpScreen) {
    const canVerify = otpCode.length === 6;
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <AuthHero topInset={topInset} mode="verify" />

        <View style={styles.card}>
          <ScrollView contentContainerStyle={cardContentStyle} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.cardLead}>
              Enter the code we sent to{' '}
              <Text style={styles.cardLeadEmphasis}>+91 {formatIndianMobileDisplay(phoneNumber)}</Text>
            </Text>

            <Text style={styles.fieldLabel}>Verification code</Text>
            <TextInput
              style={[
                styles.inputBase,
                styles.otpInput,
                otpFocused && styles.inputFocused,
                otpHasError && styles.inputError,
              ]}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              onFocus={() => setOtpFocused(true)}
              onBlur={() => setOtpFocused(false)}
              accessibilityLabel="Verification code"
            />

            {showReferralInput ? (
              <>
                <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Referral code (optional)</Text>
                <TextInput
                  style={[styles.inputBase, referralFocused && styles.inputFocused]}
                  placeholder="Enter referral code"
                  placeholderTextColor={colors.textMuted}
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                  onFocus={() => setReferralFocused(true)}
                  onBlur={() => setReferralFocused(false)}
                />
              </>
            ) : null}

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.ctaBlock}>
              <CtaButton
                label="Verify & Continue"
                onPress={handleVerifyOtp}
                disabled={loading || !canVerify}
                loading={loading}
                activeVisual={loading || canVerify}
              />
            </View>

            <View style={styles.linkRow}>
              <Pressable onPress={handleResendCode} disabled={resendTimer > 0} hitSlop={12}>
                <Text style={[styles.linkPrimary, resendTimer > 0 && styles.linkFaded]}>
                  {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend code'}
                </Text>
              </Pressable>
              <Text style={styles.linkDot}>·</Text>
              <Pressable onPress={() => Alert.alert('Help', 'Contact support for assistance')} hitSlop={12}>
                <Text style={styles.linkSecondary}>Get help</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setShowOtpScreen(false);
                setOtpCode('');
                setError('');
              }}
              style={styles.textLinkWrap}
              hitSlop={12}
            >
              <Text style={styles.linkPrimary}>← Change phone number</Text>
            </Pressable>

            {!showReferralInput ? (
              <Pressable
                onPress={openReferral}
                style={styles.referralRow}
                accessibilityRole="button"
                accessibilityLabel="Have a referral code? Expand referral field"
              >
                <Text style={styles.referralRowText}>Have a referral code?</Text>
                <Text style={styles.referralChevron}>▼</Text>
              </Pressable>
            ) : null}

            <View style={styles.footerMeta}>
              <Text style={styles.footerVersion}>WARMPAWS Provider v2.1.0</Text>
              <Text style={styles.footerCopy}>© 2026 WARMPAWS Inc. All rights reserved</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Phone Number Input Screen
  const canSend = phoneNumber.length === 10;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <AuthHero topInset={topInset} mode="welcome" />

      <View style={styles.card}>
        <ScrollView contentContainerStyle={cardContentStyle} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.cardIntro}>
            Join pet lovers who book trusted care in a few taps — simple, warm, and reliable.
          </Text>

          <Text style={styles.fieldLabel}>Mobile number</Text>
          <View
            style={[
              styles.phoneRow,
              phoneFocused && styles.phoneRowFocused,
              phoneHasError && styles.phoneRowError,
            ]}
          >
            <View style={styles.countryBadge}>
              <Text style={styles.countryBadgeText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInputField}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMuted}
              value={formatIndianMobileDisplay(phoneNumber)}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                if (cleaned.length <= 10) {
                  setPhoneNumber(cleaned);
                }
              }}
              keyboardType="number-pad"
              maxLength={12}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              accessibilityLabel="10-digit mobile number without country code"
            />
          </View>

          {showReferralInput ? (
            <>
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Referral code (optional)</Text>
              <TextInput
                style={[styles.inputBase, referralFocused && styles.inputFocused]}
                placeholder="Enter referral code"
                placeholderTextColor={colors.textMuted}
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
                onFocus={() => setReferralFocused(true)}
                onBlur={() => setReferralFocused(false)}
              />
            </>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.ctaBlock}>
            <CtaButton
              label="Send Verification Code"
              onPress={handleSendCode}
              disabled={loading || !canSend}
              loading={loading}
              activeVisual={loading || canSend}
            />
          </View>

          <View style={styles.legalBlock}>
            <Text style={styles.legalIntro}>By continuing you agree to our</Text>
            <View style={styles.legalLinksRow}>
              <Pressable onPress={() => Linking.openURL('https://warmpawz.com/terms')} style={styles.legalHit} hitSlop={8}>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </Pressable>
              <Text style={styles.legalAmp}> and </Text>
              <Pressable onPress={() => Linking.openURL('https://warmpawz.com/privacy')} style={styles.legalHit} hitSlop={8}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </Pressable>
            </View>
          </View>

          {!showReferralInput ? (
            <Pressable onPress={openReferral} style={styles.referralRow} accessibilityRole="button">
              <Text style={styles.referralRowText}>Have a referral code?</Text>
              <Text style={styles.referralChevron}>▼</Text>
            </Pressable>
          ) : null}

          <View style={styles.footerMeta}>
            <Pressable
              onPress={() => Linking.openURL('https://warmpawz.com/help')}
              accessibilityRole="link"
              accessibilityLabel="Need help? Open help center"
              style={styles.helpLinkWrap}
              hitSlop={10}
            >
              <Text style={styles.helpLink}>Need help?</Text>
            </Pressable>
            <Text style={styles.footerVersion}>WARMPAWS Provider v2.1.0</Text>
            <Text style={styles.footerCopy}>© 2026 WARMPAWS Inc. All rights reserved</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const HERO_ORANGE = colors.primary;
const CARD_RADIUS = 28;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HERO_ORANGE,
  },
  hero: {
    flex: 2,
    backgroundColor: HERO_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  heroGradientWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryDark,
    opacity: 0.22,
    top: '35%',
  },
  heroBlob: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroBlobA: {
    width: 220,
    height: 220,
    top: '8%',
    right: '-18%',
  },
  heroBlobB: {
    width: 160,
    height: 160,
    bottom: '12%',
    left: '-12%',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroVignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  heroVignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '32%',
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  logoWrap: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  logoImage: {
    width: 112,
    height: 112,
  },
  heroEyebrow: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heroBrand: {
    fontSize: typography.fontSizes['4xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  heroTagline: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  heroVerifyTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  card: {
    flex: 1.15,
    backgroundColor: colors.white,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.65)',
    paddingTop: spacing.lg,
    shadowColor: '#1a0a00',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 14,
  },
  cardContent: {
    paddingHorizontal: spacing.lg,
  },
  cardIntro: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
    fontWeight: typography.fontWeights.medium,
  },
  cardLead: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  cardLeadEmphasis: {
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fieldLabelSpaced: {
    marginTop: spacing.md,
  },
  inputBase: {
    minHeight: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.ctaBackground,
    backgroundColor: colors.white,
    shadowColor: colors.ctaBackground,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: '#fff5f7',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.semibold,
    letterSpacing: 10,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    paddingRight: spacing.sm,
    overflow: 'hidden',
  },
  phoneRowFocused: {
    borderColor: colors.ctaBackground,
    backgroundColor: colors.white,
    shadowColor: colors.ctaBackground,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  phoneRowError: {
    borderColor: colors.error,
    backgroundColor: '#fff5f7',
  },
  countryBadge: {
    minWidth: 52,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
    backgroundColor: 'rgba(255, 140, 66, 0.08)',
  },
  countryBadgeText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.ctaBackground,
  },
  phoneInputField: {
    flex: 1,
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  ctaBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  ctaShell: {
    borderRadius: borderRadius.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaStrong: {
    backgroundColor: colors.ctaBackground,
  },
  ctaStrongPressed: {
    backgroundColor: colors.ctaBackgroundPressed,
  },
  ctaMuted: {
    backgroundColor: colors.ctaDisabledBackground,
  },
  ctaLabel: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
  },
  ctaLabelOnDark: {
    color: colors.white,
  },
  ctaLabelMuted: {
    color: colors.ctaDisabledText,
  },
  errorBanner: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fff0f2',
    borderWidth: 1,
    borderColor: 'rgba(212, 24, 61, 0.2)',
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
    fontWeight: typography.fontWeights.medium,
  },
  legalBlock: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  legalIntro: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  legalLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalHit: {
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  legalLink: {
    fontSize: typography.fontSizes.sm,
    color: colors.ctaBackground,
    fontWeight: typography.fontWeights.bold,
    textDecorationLine: 'underline',
  },
  legalAmp: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  linkPrimary: {
    fontSize: typography.fontSizes.sm,
    color: colors.info,
    fontWeight: typography.fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  linkSecondary: {
    fontSize: typography.fontSizes.sm,
    color: colors.ctaBackground,
    fontWeight: typography.fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  linkDot: {
    fontSize: typography.fontSizes.md,
    color: colors.textMuted,
    marginHorizontal: spacing.xs,
  },
  linkFaded: {
    opacity: 0.45,
  },
  textLinkWrap: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(184, 68, 14, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(184, 68, 14, 0.12)',
  },
  referralRowText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.ctaBackground,
  },
  referralChevron: {
    fontSize: typography.fontSizes.xs,
    color: colors.ctaBackground,
    marginLeft: spacing.sm,
    marginTop: 2,
  },
  footerMeta: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  helpLinkWrap: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  helpLink: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.ctaBackground,
    textDecorationLine: 'underline',
  },
  footerVersion: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.xs / 2,
  },
  footerCopy: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
});
