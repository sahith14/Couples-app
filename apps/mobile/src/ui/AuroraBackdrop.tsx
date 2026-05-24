import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

/** Full-screen romantic backdrop. Drop behind any screen content. */
export function AuroraBackdrop({ intensity = 1 }: { intensity?: number }) {
  const { palette } = useTheme();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 12_000 }), -1, true);
  }, [t]);

  const blobA = useAnimatedStyle(() => ({
    transform: [
      { translateX: -60 + t.value * 80 },
      { translateY: -40 + t.value * 60 },
      { scale: 1 + t.value * 0.15 },
    ],
    opacity: 0.55 * intensity,
  }));

  const blobB = useAnimatedStyle(() => ({
    transform: [
      { translateX: 80 - t.value * 60 },
      { translateY: 120 - t.value * 80 },
      { scale: 1.1 - t.value * 0.1 },
    ],
    opacity: 0.45 * intensity,
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]}>
      <Animated.View style={[styles.blob, { backgroundColor: palette.gradient[0] }, blobA]} />
      <Animated.View style={[styles.blob, { backgroundColor: palette.gradient[1], top: 220 }, blobB]} />
      <LinearGradient
        colors={[palette.bg + '00', palette.bg]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 360,
    opacity: 0.5,
    left: 40,
    top: 40,
  },
});
