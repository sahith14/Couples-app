import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Quest } from '@soulsync/shared';

interface Row {
  quest: Quest;
  done: boolean;
}

export default function Quests() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { couple, profile, refreshCouple } = useAuthStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!couple || !profile) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const [qR, pR] = await Promise.all([
      supabase.from('quests').select('*').eq('active', true).order('cadence'),
      supabase
        .from('quest_progress')
        .select('quest_id, completed_at')
        .eq('couple_id', couple.id)
        .eq('user_id', profile.id)
        .eq('for_date', today),
    ]);
    const doneSet = new Set(((pR.data ?? []) as { quest_id: string; completed_at: string | null }[]).filter((p) => p.completed_at).map((p) => p.quest_id));
    setRows(((qR.data ?? []) as Quest[]).map((q) => ({ quest: q, done: doneSet.has(q.id) })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [couple?.id, profile?.id]);

  async function complete(q: Quest) {
    if (!couple) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { data, error } = await supabase.rpc('complete_quest', {
      p_couple: couple.id,
      p_code: q.code,
    });
    if (error) return Alert.alert('Could not complete', error.message);
    const result = (data?.[0] ?? data) as { awarded_xp: number; already_done: boolean } | undefined;
    if (result?.already_done) Alert.alert('Already done today', 'Come back tomorrow.');
    await load();
    await refreshCouple();
  }

  const dailies = rows.filter((r) => r.quest.cadence === 'daily');
  const weeklies = rows.filter((r) => r.quest.cadence === 'weekly');
  const onces = rows.filter((r) => r.quest.cadence === 'once');

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.5} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: palette.text, fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={[typography.h2, { color: palette.text }]}>Quests</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          <GlassCard glow>
            <Text style={[typography.h3, { color: palette.text }]}>Today's energy</Text>
            <Text style={[typography.body, { color: palette.textMuted, marginTop: 4 }]}>
              Tiny actions stack up. {couple?.streak_count ?? 0}🔥 streak · Lvl {couple?.level ?? 1} · {couple?.xp ?? 0} XP
            </Text>
          </GlassCard>

          <Section title="Daily" rows={dailies} onTap={complete} palette={palette} radii={radii} />
          {weeklies.length > 0 && (
            <Section title="Weekly" rows={weeklies} onTap={complete} palette={palette} radii={radii} />
          )}
          {onces.length > 0 && (
            <Section title="One-time milestones" rows={onces} onTap={complete} palette={palette} radii={radii} />
          )}

          {!loading && rows.length === 0 && (
            <GlassCard>
              <Text style={[typography.body, { color: palette.textMuted }]}>
                No quests configured. Run migration 006 to seed the defaults.
              </Text>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Section({
  title, rows, onTap, palette, radii,
}: {
  title: string;
  rows: Row[];
  onTap: (q: Quest) => void;
  palette: ReturnType<typeof useTheme>['palette'];
  radii: ReturnType<typeof useTheme>['radii'];
}) {
  return (
    <GlassCard>
      <Text style={{ color: palette.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
        {title.toUpperCase()}
      </Text>
      <View style={{ gap: 8 }}>
        {rows.map(({ quest, done }) => (
          <Pressable
            key={quest.id}
            onPress={() => !done && onTap(quest)}
            style={{
              padding: 14,
              borderRadius: radii.md,
              backgroundColor: done ? palette.surfaceStrong : palette.surface,
              borderWidth: 1,
              borderColor: done ? palette.success : palette.border,
              opacity: done ? 0.7 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }}>
                  {done ? '✅ ' : ''}{quest.title}
                </Text>
                {quest.description && (
                  <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 2 }}>
                    {quest.description}
                  </Text>
                )}
              </View>
              <View
                style={{
                  paddingHorizontal: 8, paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: palette.primary,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ color: palette.primaryOn, fontWeight: '700', fontSize: 12 }}>
                  +{quest.xp_reward} XP
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );
}
