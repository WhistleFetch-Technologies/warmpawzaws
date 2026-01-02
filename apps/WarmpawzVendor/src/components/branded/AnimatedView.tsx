/**
 * Animated View Component
 * Provides smooth animations for branded components
 */

import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

interface AnimatedViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  animation?: 'fade' | 'slideUp' | 'slideDown' | 'spring' | 'none';
  delay?: number;
  duration?: number;
}

export function AnimatedView({
  children,
  style,
  animation = 'fade',
  delay = 0,
  duration = 300,
}: AnimatedViewProps) {

  if (animation === 'none') {
    return <View style={style}>{children}</View>;
  }

  // Use entering animations for better performance
  const enteringAnimation = 
    animation === 'slideUp' ? FadeInUp.delay(delay).duration(duration) :
    animation === 'slideDown' ? FadeInDown.delay(delay).duration(duration) :
    FadeIn.delay(delay).duration(duration);

  return (
    <Animated.View style={style} entering={enteringAnimation}>
      {children}
    </Animated.View>
  );
}

