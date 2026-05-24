import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { GlassCard } from '@/ui/GlassCard';
import { supabase } from '@/services/supabase';

export default function SignUp() {
  const { palette, typography, spacing } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signUp() {
    if (password.length < 8) return setErr('Use at least 8 characters');
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() || null } },
    });
    setLoading(false);
    if (error) return setErr(error.message);
    Alert.alert('Almost there', 'Confirm your email to finish creating your account.');
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}
        >
          <Text style={[typography.h1, { color: palette.text, marginBottom: spacing.xs }]}>
            Start your forever
          </Text>
          <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.xl }]}>
            One account per person. You'll pair up next.
          </Text>

          <GlassCard padding={20} glow>
            <View style={{ gap: spacing.md }}>
              <TextField label="Your name" value={name} onChangeText={setName} placeholder="Riley" />
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@love.app"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 8 characters"
                error={err}
              />
              <Button label="Create account" loading={loading} onPress={signUp} fullWidth />
            </View>
          </GlassCard>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
