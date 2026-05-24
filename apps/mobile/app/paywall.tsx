import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { PLANS, type Plan, type PlanId, PREMIUM_GATES } from '@soulsync/shared';
import { setCurrentScreen } from '@/services/phoneStatus';

const FEATURE_BULLETS: { icon: string; text: string }[] = [
  { icon: '⚡', text: 'Unlimited Instants — 24h disappearing posts' },
  { icon: '⏰', text: 'Schedule messages for the perfect moment' },
  { icon: '📲', text: 'Live partner status — battery, screen, online' },
  { icon: '💗', text: 'Heartbeat sync · realtime presence' },
  { icon: '📞', text: 'HD video calls with picture-in-picture' },
  { icon: '🪟', text: 'Lockscreen + home-screen widgets' },
  { icon: '🤖', text: '200 AI compliments & love letters / week' },
  { icon: '📸', text: '25 GB E2E memory vault' },
  { icon: '⏳', text: 'Unlimited time capsules (5+ years)' },
  { icon: '🎨', text: 'All cinematic themes' },
];

export default function Paywall() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { profile } = useAuthStore();
  const [selected, setSelected] = useState<PlanId>('plus_monthly');

  useFocusEffect(React.useCallback(() => {
    setCurrentScreen('paywall');
    return () => setCurrentScreen(null);
  }, []));

  const selectedPlan = PLANS.find((p) => p.id === selected) ?? PLANS[1]!;

  async function purchase() {
    Alert.alert(
      'Connect billing',
      `Plan ID: ${selectedPlan.productId}\n\nWire RevenueCat (recommended) or native StoreKit/PlayBilling in apps/mobile/src/services/billing.ts. The RC product IDs above match your store dashboard.`,
      [
        { text: 'OK' },
        { text: 'RevenueCat docs', onPress: () => Linking.openURL('https://www.revenuecat.com/docs/getting-started') },
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
          <Text style={[typography.h2, { color: palette.text, flex: 1 }]}>Go Plus</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 160 }}>
          <GlassCard padding={0}>
            <LinearGradient
              colors={palette.gradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ padding: spacing.xl, borderRadius: 20 }}
            >
              <Text style={[typography.display, { color: palette.primaryOn, fontSize: 38, lineHeight: 42 }]}>
                Two of you{'\n'}endless love
              </Text>
              <Text style={{ color: palette.primaryOn, opacity: 0.9, marginTop: 10, fontSize: 15 }}>
                You're on <Text style={{ fontWeight: '800' }}>{profile?.premium_tier ?? 'free'}</Text>.
                Unlock everything for <Text style={{ fontWeight: '800' }}>₹149/mo</Text>.
              </Text>
            </LinearGradient>
          </GlassCard>

          {/* Plan cards */}
          <View style={{ gap: spacing.sm }}>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={plan.id === selected}
                isCurrent={profile?.premium_tier !== 'free' && plan.tier === profile?.premium_tier}
                onSelect={() => setSelected(plan.id)}
                palette={palette}
                radii={radii}
              />
            ))}
          </View>

          {/* Feature bullets */}
          <GlassCard>
            <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
              What you unlock
            </Text>
            <View style={{ gap: 10 }}>
              {FEATURE_BULLETS.map((b) => (
                <View key={b.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>{b.icon}</Text>
                  <Text style={{ color: palette.text, fontSize: 14, flex: 1 }}>{b.text}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <Text style={[typography.micro, { color: palette.textFaint, textAlign: 'center', marginTop: spacing.md }]}>
            Cancel anytime · Apple/Google handle billing securely · GST included
          </Text>
        </ScrollView>

        {/* Sticky CTA */}
        {profile?.premium_tier !== selectedPlan.tier && (
          <View
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: spacing.lg,
              backgroundColor: palette.surfaceStrong,
              borderTopWidth: 1, borderTopColor: palette.border,
            }}
          >
            <Button
              label={`Continue · ${selectedPlan.price}${selectedPlan.period}`}
              onPress={purchase}
              fullWidth
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function PlanCard({
  plan, isSelected, isCurrent, onSelect, palette, radii,
}: {
  plan: Plan;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
  radii: ReturnType<typeof useTheme>['radii'];
}) {
  const highlight = plan.highlight;
  return (
    <Pressable onPress={onSelect}>
      <View
        style={{
          borderRadius: radii.lg,
          padding: 18,
          backgroundColor: highlight ? palette.primary : palette.surface,
          borderWidth: 2,
          borderColor: isSelected
            ? (highlight ? palette.primaryOn : palette.primary)
            : palette.border,
          position: 'relative',
        }}
      >
        {plan.savingsLabel && (
          <View
            style={{
              position: 'absolute', top: -10, right: 14,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: palette.accent,
            }}
          >
            <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
              {plan.savingsLabel.toUpperCase()}
            </Text>
          </View>
        )}
        {highlight && (
          <View
            style={{
              position: 'absolute', top: -10, left: 14,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
              backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.primary,
            }}
          >
            <Text style={{ color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
              MOST POPULAR
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: highlight ? palette.primaryOn : palette.text,
                fontSize: 18, fontWeight: '800',
              }}
            >
              {plan.label}{isCurrent ? ' · current' : ''}
            </Text>
            <Text
              style={{
                color: highlight ? palette.primaryOn : palette.textMuted,
                opacity: highlight ? 0.9 : 1,
                marginTop: 2, fontSize: 12,
              }}
            >
              {plan.pitch}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: highlight ? palette.primaryOn : palette.text, fontSize: 24, fontWeight: '900' }}>
              {plan.price}
            </Text>
            <Text style={{ color: highlight ? palette.primaryOn : palette.textMuted, opacity: 0.85, fontSize: 11 }}>
              {plan.period}
            </Text>
          </View>
        </View>

        {plan.monthlyEquivalentInr > 0 && plan.id !== 'plus_monthly' && (
          <Text
            style={{
              marginTop: 8, fontSize: 11, fontWeight: '600',
              color: highlight ? palette.primaryOn : palette.textFaint,
              opacity: 0.85,
            }}
          >
            ≈ ₹{plan.monthlyEquivalentInr}/month
          </Text>
        )}
      </View>
    </Pressable>
  );
}
