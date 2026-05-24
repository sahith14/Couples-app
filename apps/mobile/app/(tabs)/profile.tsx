import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import type { ThemeName } from '@soulsync/shared';
import { clearAllSecrets } from '@/services/secureKeys';

const THEMES: ThemeName[] = ['romantic-dark', 'aurora', 'noir', 'sunset', 'mint'];

export default function Profile() {
  const { palette, typography, spacing, name, setTheme } = useTheme();
  const { profile, couple, signOut } = useAuthStore();

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.5} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 }}>
          <Text style={[typography.h1, { color: palette.text }]}>{profile?.display_name}</Text>
          <Text style={[typography.body, { color: palette.textMuted }]}>
            Tier · {profile?.premium_tier ?? 'free'}
          </Text>

          <GlassCard>
            <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>Theme</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {THEMES.map((t) => (
                <Button
                  key={t}
                  label={t}
                  variant={t === name ? 'primary' : 'ghost'}
                  onPress={() => setTheme(t)}
                />
              ))}
            </View>
          </GlassCard>

          <GlassCard>
            <Text style={[typography.h3, { color: palette.text }]}>Couple</Text>
            <Text style={[typography.body, { color: palette.textMuted, marginTop: 4 }]}>
              {couple?.id ? `Paired since ${new Date(couple.created_at).toDateString()}` : 'Not paired'}
            </Text>
            <Text style={[typography.micro, { color: palette.textFaint, marginTop: 6 }]}>
              Streak {couple?.streak_count ?? 0} · Level {couple?.level ?? 1} · {couple?.xp ?? 0} XP
            </Text>
          </GlassCard>

          <GlassCard>
            <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>Premium</Text>
            <Text style={[typography.body, { color: palette.textMuted }]}>
              Unlock Memory Galaxy, AI replays, unlimited storage, advanced themes.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button label="Upgrade to Plus" onPress={() => {}} />
            </View>
          </GlassCard>

          <Button
            label="Sign out"
            variant="danger"
            onPress={async () => {
              await clearAllSecrets();
              await signOut();
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
