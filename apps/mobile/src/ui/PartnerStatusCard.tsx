import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassCard } from '@/ui/GlassCard';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { WidgetPayload, PhoneStatus, MoodLog, Instant } from '@soulsync/shared';

/**
 * PartnerStatusCard
 *
 * One subscription to the `widget_payload` view + realtime tail on `phone_status`
 * for instant updates. Shows partner's:
 *   - online dot (green if active in last 90s)
 *   - which screen they're on (or "in another app")
 *   - battery + charging state
 *   - today's mood
 *   - latest unseen Instant teaser (with tap-to-open)
 */
export function PartnerStatusCard() {
  const { palette, typography, spacing, radii } = useTheme();
  const { profile, couple } = useAuthStore();
  const router = useRouter();
  const [data, setData] = useState<WidgetPayload | null>(null);

  async function load() {
    if (!couple) return;
    const { data: row } = await supabase
      .from('widget_payload')
      .select('*')
      .eq('couple_id', couple.id)
      .maybeSingle();
    if (row) setData(row as unknown as WidgetPayload);
  }

  useEffect(() => { void load(); }, [couple?.id]);

  // Live updates whenever the partner pushes status / instant / mood.
  useEffect(() => {
    if (!couple) return;
    const ch = supabase
      .channel(`partner-status:${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phone_status', filter: `couple_id=eq.${couple.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instants', filter: `couple_id=eq.${couple.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mood_logs', filter: `couple_id=eq.${couple.id}` }, load)
      .subscribe();
    const t = setInterval(load, 30_000);
    return () => { void supabase.removeChannel(ch); clearInterval(t); };
  }, [couple?.id]);

  const partner = data?.partner_status as PhoneStatus | null | undefined;
  const partnerMood = data?.partner_mood as MoodLog | null | undefined;
  const latest = data?.latest_instant as Instant | null | undefined;

  const online = useMemo(() => {
    if (!partner) return false;
    const ms = Date.now() - new Date(partner.online_at).getTime();
    return partner.active && ms < 120_000;
  }, [partner]);

  const onlineLabel = useMemo(() => {
    if (!partner) return 'partner not connected yet';
    if (online) {
      const screen = partner.current_screen ?? 'app';
      const friendly = (() => {
        switch (screen) {
          case 'home':      return 'home screen';
          case 'chat':      return 'in chat';
          case 'memories':  return 'browsing memories';
          case 'map':       return 'looking at the map';
          case 'instants':  return 'on Instants';
          case 'heartbeat': return '💗 heartbeat mode';
          case 'planner':   return 'planning a date';
          case 'capsules':  return 'with capsules';
          case 'notes':     return 'editing notes';
          case 'paywall':   return 'on the paywall';
          default:          return 'in the app';
        }
      })();
      if (partner.dnd) return `${friendly} · 🌙 dnd`;
      return friendly;
    }
    const ms = Date.now() - new Date(partner.online_at).getTime();
    return `last seen ${friendlyAgo(ms)}`;
  }, [partner, online]);

  if (!couple) return null;

  return (
    <Pressable onPress={() => latest && router.push('/instants')}>
      <GlassCard glow={!!latest && latest.author_id !== profile?.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Avatar with live dot */}
          <View style={{ width: 48, height: 48 }}>
            <LinearGradient
              colors={[palette.primary, palette.accent]}
              style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22 }}>💗</Text>
            </LinearGradient>
            <View
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: online ? palette.success : palette.textFaint,
                borderWidth: 2, borderColor: palette.bg,
              }}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}>
              partner
            </Text>
            <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
              {onlineLabel}
            </Text>
          </View>

          {/* Battery */}
          {partner?.battery_pct != null && (
            <View
              style={{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                backgroundColor: partner.battery_low
                  ? 'rgba(255,107,107,0.15)'
                  : 'rgba(91,227,166,0.15)',
                borderWidth: 1,
                borderColor: partner.battery_low
                  ? 'rgba(255,107,107,0.3)'
                  : 'rgba(91,227,166,0.3)',
              }}
            >
              <Text
                style={{
                  color: partner.battery_low ? palette.danger : palette.success,
                  fontSize: 11, fontWeight: '700',
                }}
              >
                {partner.is_charging ? '⚡' : '🔋'} {partner.battery_pct}%
              </Text>
            </View>
          )}
        </View>

        {/* Mood + Instant teaser */}
        {(partnerMood || latest) && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
            {partnerMood && (
              <View
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                  backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
                }}
              >
                <Text style={{ color: palette.text, fontSize: 11, fontWeight: '700' }}>
                  feels · {partnerMood.mood}
                </Text>
              </View>
            )}
            {latest && latest.author_id !== profile?.id && (
              <View
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                  backgroundColor: palette.primary,
                }}
              >
                <Text style={{ color: palette.primaryOn, fontSize: 11, fontWeight: '800' }}>
                  ✨ new instant
                </Text>
              </View>
            )}
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}

function friendlyAgo(ms: number): string {
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
