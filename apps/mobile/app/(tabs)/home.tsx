import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';
import { moodColors, QUEST_CODES } from '@soulsync/shared';
import { LinearGradient } from 'expo-linear-gradient';

function daysBetween(a: Date, b: Date) {
  return Math.floor((+b - +a) / (1000 * 60 * 60 * 24));
}

export default function Home() {
  const { palette, typography, spacing } = useTheme();
  const { profile, couple, refreshCouple } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [partnerMood, setPartnerMood] = useState<string | null>(null);
  const [memoriesToday, setMemoriesToday] = useState<number>(0);

  const togetherDays = useMemo(() => {
    if (!couple?.anniversary) return null;
    return daysBetween(new Date(couple.anniversary), new Date());
  }, [couple?.anniversary]);

  async function loadHomeData() {
    if (!couple || !profile) return;
    const today = new Date().toISOString().slice(0, 10);
    const partnerId = couple.user_a === profile.id ? couple.user_b : couple.user_a;

    const [mineR, theirsR, otdR] = await Promise.all([
      supabase
        .from('mood_logs')
        .select('mood')
        .eq('user_id', profile.id)
        .eq('for_date', today)
        .maybeSingle(),
      supabase
        .from('mood_logs')
        .select('mood')
        .eq('user_id', partnerId)
        .eq('for_date', today)
        .maybeSingle(),
      supabase.from('on_this_day').select('id', { count: 'exact', head: true }),
    ]);
    setTodayMood((mineR.data as any)?.mood ?? null);
    setPartnerMood((theirsR.data as any)?.mood ?? null);
    setMemoriesToday(otdR.count ?? 0);
  }

  useEffect(() => {
    void loadHomeData();
  }, [couple?.id, profile?.id]);

  async function logMood(mood: string) {
    if (!couple || !profile) return;
    await supabase.from('mood_logs').upsert({
      couple_id: couple.id,
      user_id: profile.id,
      mood,
      intensity: 3,
      for_date: new Date().toISOString().slice(0, 10),
    });
    setTodayMood(mood);
    await supabase.rpc('add_xp', { p_couple: couple.id, p_xp: 10 });
    await supabase.rpc('bump_streak', { p_couple: couple.id });
    await refreshCouple();
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          refreshControl={
            <RefreshControl
              tintColor={palette.primary}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await Promise.all([refreshCouple(), loadHomeData()]);
                setRefreshing(false);
              }}
            />
          }
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 120, gap: spacing.lg }}
        >
          <View>
            <Text style={[typography.small, { color: palette.textMuted }]}>
              hi {profile?.display_name}
            </Text>
            <Text style={[typography.display, { color: palette.text }]}>
              {greeting()},{'\n'}
              <Text style={{ color: palette.primary }}>together {togetherDays ?? 0} days</Text>
            </Text>
          </View>

          {/* Streak + XP */}
          <GlassCard glow>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={[typography.micro, { color: palette.textMuted, letterSpacing: 1 }]}>STREAK</Text>
                <Text style={[typography.h1, { color: palette.text }]}>
                  {couple?.streak_count ?? 0}🔥
                </Text>
              </View>
              <View>
                <Text style={[typography.micro, { color: palette.textMuted, letterSpacing: 1 }]}>LEVEL</Text>
                <Text style={[typography.h1, { color: palette.text }]}>
                  {couple?.level ?? 1}
                </Text>
              </View>
              <View>
                <Text style={[typography.micro, { color: palette.textMuted, letterSpacing: 1 }]}>XP</Text>
                <Text style={[typography.h1, { color: palette.text }]}>{couple?.xp ?? 0}</Text>
              </View>
            </View>
          </GlassCard>

          {/* Mood sync */}
          <GlassCard>
            <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
              How are you feeling?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(moodColors).map(([m, c]) => (
                <Button
                  key={m}
                  label={m}
                  variant={todayMood === m ? 'primary' : 'ghost'}
                  onPress={() => logMood(m)}
                />
              ))}
            </View>
            <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
              {todayMood && (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: moodColors[todayMood] ?? palette.surface,
                  }}
                >
                  <Text style={{ color: '#0B0710', fontWeight: '700' }}>you · {todayMood}</Text>
                </View>
              )}
              {partnerMood && (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: moodColors[partnerMood] ?? palette.surface,
                  }}
                >
                  <Text style={{ color: '#0B0710', fontWeight: '700' }}>them · {partnerMood}</Text>
                </View>
              )}
            </View>
          </GlassCard>

          {/* On this day */}
          {memoriesToday > 0 && (
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>On this day</Text>
              <Text style={[typography.body, { color: palette.textMuted, marginTop: 4 }]}>
                {memoriesToday} memor{memoriesToday === 1 ? 'y' : 'ies'} from past years.
              </Text>
            </GlassCard>
          )}

          {/* Heartbeat ring */}
          <GlassCard padding={0}>
            <LinearGradient
              colors={palette.gradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: spacing.xl, borderRadius: 20 }}
            >
              <Text style={[typography.h2, { color: palette.primaryOn }]}>Heartbeat mode</Text>
              <Text style={{ color: palette.primaryOn, opacity: 0.85, marginTop: 4 }}>
                Tap to feel each other's pulse for 60 seconds.
              </Text>
            </LinearGradient>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'still up?';
  if (h < 12) return 'good morning';
  if (h < 18) return 'good afternoon';
  return 'good evening';
}
