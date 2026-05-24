import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

interface Props extends ViewProps {
  intensity?: number;
  glow?: boolean;
  padding?: number;
  radius?: number;
}

export function GlassCard({
  intensity = 40,
  glow = false,
  padding = 16,
  radius,
  style,
  children,
  ...rest
}: Props) {
  const { palette, radii } = useTheme();
  const r = radius ?? radii.lg;

  return (
    <View
      {...rest}
      style={[
        styles.wrap,
        {
          borderRadius: r,
          shadowColor: glow ? palette.glow : '#000',
          shadowOpacity: glow ? 0.6 : 0.25,
          shadowRadius: glow ? 24 : 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}
    >
      <BlurView intensity={intensity} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}>
        <LinearGradient
          colors={[palette.surface, 'rgba(255,255,255,0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>
      <View
        style={{
          padding,
          borderRadius: r,
          borderWidth: 1,
          borderColor: palette.border,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
});
