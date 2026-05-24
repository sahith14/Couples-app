import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { inviteCodeSchema, SOULSYNC } from '@soulsync/shared';
import { getMyPublicKeyB64 } from '@/services/secureKeys';

export default function Pair() {
  const { palette, typography, spacing } = useTheme();
  const { user, refreshCouple } = useAuthStore();
  const [mode, setMode] = useState<'pick' | 'host' | 'join'>('pick');
  const [code, setCode] = useState<string | null>(null);
  const [enter, setEnter] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function uploadPubKey() {
    const pub = await getMyPublicKeyB64();
    if (!user) return;
    // Optional: push public key into profile (add a column if you want; here we keep it client-side
    // until partner is paired, then exchange via a dedicated table you can add later).
    await supabase.from('profiles').update({ /* public_key: pub */ }).eq('id', user.id);
  }

  async function generate() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc('generate_invite_code');
    setLoading(false);
    if (error) return setErr(error.message);
    setCode(data as string);
    setMode('host');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void uploadPubKey();
  }

  async function redeem() {
    const parsed = inviteCodeSchema.safeParse(enter);
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Bad code');
      return;
    }
    setLoading(true);
    setErr(null);
    const { error } = await supabase.rpc('redeem_invite_code', { p_code: parsed.data });
    setLoading(false);
    if (error) return setErr(error.message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refreshCouple();
  }

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', `Share ${code} with your partner.`);
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={1.2} />
      <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
        <Text style={[typography.h1, { color: palette.text }]}>Find your other half</Text>
        <Text style={[typography.body, { color: palette.textMuted, marginBottom: spacing.xl }]}>
          {SOULSYNC.inviteHelp}
        </Text>

        {mode === 'pick' && (
          <GlassCard padding={24} glow>
            <View style={{ gap: spacing.md }}>
              <Button label="Generate my invite code" fullWidth loading={loading} onPress={generate} />
              <Button
                label="I have a code"
                variant="ghost"
                fullWidth
                onPress={() => setMode('join')}
              />
            </View>
          </GlassCard>
        )}

        {mode === 'host' && (
          <GlassCard padding={24} glow>
            <Text style={[typography.small, { color: palette.textMuted }]}>Your invite code</Text>
            <Text
              style={{
                fontSize: 48,
                fontWeight: '900',
                letterSpacing: 6,
                color: palette.text,
                marginVertical: spacing.md,
                textAlign: 'center',
              }}
            >
              {code ?? '······'}
            </Text>
            <View style={{ gap: spacing.sm }}>
              <Button label="Copy" onPress={copy} fullWidth />
              <Button label="Use a different method" variant="ghost" onPress={() => setMode('pick')} fullWidth />
            </View>
            <Text style={[typography.micro, { color: palette.textFaint, marginTop: spacing.md, textAlign: 'center' }]}>
              Expires in 7 days · We'll auto-redirect when your partner joins.
            </Text>
          </GlassCard>
        )}

        {mode === 'join' && (
          <GlassCard padding={24} glow>
            <View style={{ gap: spacing.md }}>
              <TextField
                label="Invite code"
                placeholder="ABC123"
                autoCapitalize="characters"
                maxLength={6}
                value={enter}
                onChangeText={(t) => setEnter(t.toUpperCase())}
                error={err}
              />
              <Button label="Pair us" fullWidth loading={loading} onPress={redeem} />
              <Button label="Back" variant="ghost" fullWidth onPress={() => setMode('pick')} />
            </View>
          </GlassCard>
        )}
      </SafeAreaView>
    </View>
  );
}
