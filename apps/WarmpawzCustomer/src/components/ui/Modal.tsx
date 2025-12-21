/**
 * Reusable Modal Component
 * Enterprise-grade modal with backdrop
 */

import React from 'react';
import {
  Modal as RNModal,
  View,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ViewStyle,
} from 'react-native';
import { colors, borderRadius } from '../../theme/colors';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'none' | 'slide' | 'fade';
  transparent?: boolean;
  contentStyle?: ViewStyle;
}

export function Modal({
  visible,
  onClose,
  children,
  animationType = 'slide',
  transparent = true,
  contentStyle,
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      animationType={animationType}
      transparent={transparent}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {transparent && (
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          />
        )}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: 20,
  },
});

