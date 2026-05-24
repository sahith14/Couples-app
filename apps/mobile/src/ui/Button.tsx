import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const APressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  variant = 'primary',
  loading = false,
  icon,
  fullWidth,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: Props) {
  const { palette, radii, typography } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  const colors =
    isDanger
      ? [palette.danger, '#FF3D6E']
      : isPrimary
        ? palette.gradient
        : [palette.surface, palette.surface];

  return (
    <APressable
      {...rest}
      disabled={disabled || loading}
      onPress={(e) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
      onPressIn={(e) => {
        scale.value = withTiming(0.97, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 140 });
        onPressOut?.(e);
      }}
      style={[
        styles.base,
        fullWidth && { alignSelf: 'stretch' },
        { borderRadius: radii.pill, opacity: disabled ? 0.55 : 1 },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]}
      />
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.primaryOn} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                typography.bodyStrong,
                {
                  color: variant === 'ghost' ? palette.text : palette.primaryOn,
                  marginLeft: icon ? 8 : 0,
                },
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </APressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
});
