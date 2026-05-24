import React, { useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  trailing?: React.ReactNode;
}

export function TextField({ label, error, trailing, style, onFocus, onBlur, ...rest }: Props) {
  const { palette, radii, typography, spacing } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ alignSelf: 'stretch' }}>
      {label && (
        <Text style={[typography.small, { color: palette.textMuted, marginBottom: 6 }]}>{label}</Text>
      )}
      <View
        style={[
          styles.box,
          {
            borderRadius: radii.lg,
            borderColor: error ? palette.danger : focused ? palette.primary : palette.border,
            backgroundColor: palette.surface,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <TextInput
          {...rest}
          placeholderTextColor={palette.textFaint}
          selectionColor={palette.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            { flex: 1, color: palette.text, paddingVertical: 14, fontSize: 16 },
            style,
          ]}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={[typography.micro, { color: palette.danger, marginTop: 6 }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});
