/**
 * Branded Button Component
 * Matches web app button styles with gradients
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BrandColors, Typography, BorderRadius, Spacing, Gradients } from '../theme';

interface BrandedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  gradient?: boolean;
  size?: 'default' | 'small' | 'large';
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const BrandedButton: React.FC<BrandedButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  gradient = true,
  size = 'default',
  icon,
  fullWidth = false,
}) => {
  const isDisabled = disabled || loading;

  // Size configurations
  const sizeConfig = {
    small: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.base,
      fontSize: Typography.buttonSmall.fontSize,
    },
    default: {
      paddingVertical: Spacing.base,
      paddingHorizontal: Spacing.lg,
      fontSize: Typography.button.fontSize,
    },
    large: {
      paddingVertical: Spacing.base + 4,
      paddingHorizontal: Spacing.xl,
      fontSize: Typography.button.fontSize + 2,
    },
  };

  const config = sizeConfig[size];

  // Primary button with gradient
  if (variant === 'primary' && gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.button,
          fullWidth && styles.fullWidth,
          isDisabled && styles.buttonDisabled,
        ]}
      >
        <LinearGradient
          colors={Gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.gradientButton,
            {
              paddingVertical: config.paddingVertical,
              paddingHorizontal: config.paddingHorizontal,
              borderRadius: BorderRadius.sm,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.buttonContent}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text
                style={[
                  styles.buttonText,
                  { fontSize: config.fontSize },
                  Typography.button,
                ]}
              >
                {title}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Secondary button (outline)
  if (variant === 'secondary' || variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.outlineButton,
          {
            paddingVertical: config.paddingVertical,
            paddingHorizontal: config.paddingHorizontal,
            borderRadius: BorderRadius.sm,
            borderWidth: 2,
            borderColor: BrandColors.primary.orange,
          },
          isDisabled && styles.buttonDisabled,
          fullWidth && styles.fullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={BrandColors.primary.orange} />
        ) : (
          <View style={styles.buttonContent}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              style={[
                styles.outlineButtonText,
                { fontSize: config.fontSize },
                Typography.button,
                { color: BrandColors.primary.orange },
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Destructive button
  if (variant === 'destructive') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.destructiveButton,
          {
            paddingVertical: config.paddingVertical,
            paddingHorizontal: config.paddingHorizontal,
            borderRadius: BorderRadius.sm,
            backgroundColor: BrandColors.semantic.error,
          },
          isDisabled && styles.buttonDisabled,
          fullWidth && styles.fullWidth,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.buttonContent}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              style={[
                styles.buttonText,
                { fontSize: config.fontSize },
                Typography.button,
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Fallback to solid primary
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.solidButton,
        {
          paddingVertical: config.paddingVertical,
          paddingHorizontal: config.paddingHorizontal,
          borderRadius: BorderRadius.sm,
          backgroundColor: BrandColors.primary.orange,
        },
        isDisabled && styles.buttonDisabled,
        fullWidth && styles.fullWidth,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.buttonText,
              { fontSize: config.fontSize },
              Typography.button,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
  },
  gradientButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  destructiveButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  outlineButtonText: {
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  fullWidth: {
    width: '100%',
  },
});

