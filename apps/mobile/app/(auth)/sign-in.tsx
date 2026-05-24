import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { GlassCard } from '@/ui/GlassCard';
import { supabase } from '@/services/supabase';

export default function SignIn() {
  const { palette, typography, spacing } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signInWithPassword() {
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setErr(error.message);
  }

  async function sendMagicLink() {
    if (!email) return setErr('Enter your email first');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: 'soulsync://auth/callback' },
    });
    setLoading(false);
    if (error) return setErr(error.message);
    Alert.alert('Check your inbox', 'We sent you a magic link.');
  }

  async function continueWithGoogle() {
    // Real implementation uses expo-auth-session + Supabase OAuth.
    Alert.alert('Set up Google in Supabase', 'See docs/AUTH_SETUP.md to enable Google sign-in.');
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}
        >
          <Text style={[typography.display, { color: palette.text, marginBottom: 4 }]}>SoulSync</Text>
          <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.xl }]}>
            Two hearts. One private space.
          </Text>

          <GlassCard padding={20} glow>
            <View style={{ gap: spacing.md }}>
              <TextField
                label="Email"
                placeholder="you@love.app"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                label="Password"
                placeholder="••••••••"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                error={err}
              />
              <Button
                label="Sign in"
                fullWidth
                loading={loading}
                onPress={signInWithPassword}
              />
              <Button
                label="Email me a magic link"
                variant="ghost"
                fullWidth
                onPress={sendMagicLink}
              />
            </View>
          </GlassCard>

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Button label="Continue with Google" variant="ghost" onPress={continueWithGoogle} />
            <Button label="Continue with Apple" variant="ghost" onPress={() => Alert.alert('Configure Apple Sign In')} />
          </View>

          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Link href="/(auth)/sign-up" style={{ color: palette.primary, fontWeight: '600' }}>
              New here? Create your couple →
            </Link>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
