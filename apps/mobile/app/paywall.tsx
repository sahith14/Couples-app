import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { PREMIUM_GATES, type PremiumTier } from '@soulsync/shared';

interface Plan {
  tier: PremiumTier;
  name: string;
  pitch: string;
  monthly: string;
  yearly: string;
  bullets: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    tier: 'free',
    name: 'Free',
    pitch: 'The whole couple core, on us.',
    monthly: '$0',
    yearly: '$0',
    bullets: [
      'Realtime chat + E2E encryption',
      `${PREMIUM_GATES.free.storageGB} GB memory vault`,
      'Live location + ghost mode',
      `${PREMIUM_GATES.free.aiCallsPerWeek} AI compliments / week`,
      `${PREMIUM_GATES.free.capsulesActive} active time capsules`,
      `${PREMIUM_GATES.free.secretAlbums} secret album`,
    ],
  },
  {
    tier: 'plus',
    name: 'Plus',
    pitch: 'Unlock the cinematic stuff.',
    monthly: '$6.99',
    yearly: '$49.99',
    bullets: [
      `${PREMIUM_GATES.plus.storageGB} GB vault — keep every photo forever`,
      `${PREMIUM_GATES.plus.aiCallsPerWeek} AI calls — letters, captions, recaps`,
      `${PREMIUM_GATES.plus.secretAlbums} secret PIN-locked albums`,
      `${PREMIUM_GATES.plus.capsulesActive} time capsules`,
      'Memory Galaxy 3D viewer',
      'Heartbeat Mode + Aura Mode',
      'All cinematic themes (5+)',
      'Anniversary recap video',
    ],
    highlight: true,
  },
  {
    tier: 'infinite',
    name: 'Infinite',
    pitch: 'For the long-haul, all-in couple.',
    monthly: '$14.99',
    yearly: '$99.99',
    bullets: [
      `${PREMIUM_GATES.infinite.storageGB} GB vault`,
      `${PREMIUM_GATES.infinite.aiCallsPerWeek} AI calls / week`,
      'Highest-quality memory recap (4K)',
      'Priority support',
      'Lock-screen + home-screen widgets (early access)',
      'Cloud-sync across all devices',
    ],
  },
];

export default function Paywall() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { profile } = useAuthStore();
  const [selected, setSelected] = useState<PremiumTier>('plus');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');

  async function purchase() {
    // Real wiring: RevenueCat / StoreKit / Play Billing.
    // For now we route to a configurable URL or just toast.
    Alert.alert(
      'Almost there',
      'Hook up RevenueCat (RECOMMENDED) or your IAP provider in apps/mobile/src/services/billing.ts. The plan + tier are already plumbed end-to-end.',
      [
        { text: 'OK' },
        {
          text: 'See setup guide',
          onPress: () => Linking.openURL('https://www.revenuecat.com/docs/getting-started'),
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={1.0} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: palette.text, fontSize: 22 }}>✕</Text>
          </Pressable>
          <Text style={[typography.h2, { color: palette.text }]}>Go Plus</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          <GlassCard padding={0}>
            <LinearGradient
              colors={palette.gradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: spacing.xl, borderRadius: 20 }}
            >
              <Text style={[typography.display, { color: palette.primaryOn }]}>
                Two of you{'\n'}endless storage
              </Text>
              <Text style={{ color: palette.primaryOn, opacity: 0.85, marginTop: 8, fontSize: 15 }}>
                You're on <Text style={{ fontWeight: '700' }}>{profile?.premium_tier ?? 'free'}</Text> right now.
                Upgrade to keep every memory, unlock cinematic features, and let the AI write things you'll actually send.
              </Text>
            </LinearGradient>
          </GlassCard>

          {/* Period toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: palette.surface, borderRadius: 999, padding: 4, alignSelf: 'center' }}>
            {(['monthly', 'yearly'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: period === p ? palette.primary : 'transparent',
                }}
              >
                <Text style={{ color: period === p ? palette.primaryOn : palette.textMuted, fontWeight: '700' }}>
                  {p === 'yearly' ? 'Yearly · save 40%' : 'Monthly'}
                </Text>
              </Pressable>
            ))}
          </View>

          {PLANS.map((plan) => {
            const isCurrent = profile?.premium_tier === plan.tier;
            const isSelected = selected === plan.tier;
            return (
              <Pressable key={plan.tier} onPress={() => setSelected(plan.tier)}>
                <View
                  style={{
                    borderRadius: 20,
                    padding: 18,
                    backgroundColor: plan.highlight ? palette.primary : palette.surface,
                    borderWidth: 2,
                    borderColor: isSelected
                      ? plan.highlight ? palette.primaryOn : palette.primary
                      : palette.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: plan.highlight ? palette.primaryOn : palette.text,
                        fontSize: 22, fontWeight: '800',
                      }}>
                        {plan.name}
                        {isCurrent ? '  · current' : ''}
                      </Text>
                      <Text style={{
                        color: plan.highlight ? palette.primaryOn : palette.textMuted,
                        opacity: plan.highlight ? 0.85 : 1, marginTop: 2, fontSize: 13,
                      }}>
                        {plan.pitch}
                      </Text>
                    </View>
                    <Text style={{
                      color: plan.highlight ? palette.primaryOn : palette.text,
                      fontSize: 20, fontWeight: '800',
                    }}>
                      {period === 'yearly' ? plan.yearly : plan.monthly}
                      <Text style={{ fontSize: 12, fontWeight: '500' }}>{plan.tier === 'free' ? '' : period === 'yearly' ? '/yr' : '/mo'}</Text>
                    </Text>
                  </View>
                  <View style={{ marginTop: 12, gap: 6 }}>
                    {plan.bullets.map((b) => (
                      <Text
                        key={b}
                        style={{
                          color: plan.highlight ? palette.primaryOn : palette.textMuted,
                          fontSize: 13,
                          opacity: plan.highlight ? 0.95 : 1,
                        }}
                      >
                        ✓  {b}
                      </Text>
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}

          {selected !== 'free' && profile?.premium_tier !== selected && (
            <Button label={`Continue with ${selected}`} onPress={purchase} fullWidth />
          )}

          <Text style={[typography.micro, { color: palette.textFaint, textAlign: 'center' }]}>
            Cancel anytime in Settings · Family share supported · Apple/Google handle billing
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
