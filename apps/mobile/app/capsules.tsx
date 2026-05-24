import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { capsuleSchema, type TimeCapsule } from '@soulsync/shared';
import { scheduleLocal } from '@/services/pushNotifications';

const PRESETS: { label: string; ms: number }[] = [
  { label: '1 month',  ms: 30 * 24 * 60 * 60 * 1000 },
  { label: '3 months', ms: 90 * 24 * 60 * 60 * 1000 },
  { label: '6 months', ms: 180 * 24 * 60 * 60 * 1000 },
  { label: '1 year',   ms: 365 * 24 * 60 * 60 * 1000 },
  { label: '5 years',  ms: 5 * 365 * 24 * 60 * 60 * 1000 },
];

function describeRemaining(unlockAt: string): string {
  const ms = new Date(unlockAt).getTime() - Date.now();
  if (ms <= 0) return 'unlocked';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 365) return `${Math.floor(days / 365)}y ${days % 365}d`;
  if (days >= 30) return `${Math.floor(days / 30)}mo ${days % 30}d`;
  if (days >= 1) return `${days}d`;
  return `${Math.ceil(ms / (60 * 60 * 1000))}h`;
}

export default function Capsules() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { couple, profile } = useAuthStore();
  const [items, setItems] = useState<TimeCapsule[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!couple) return;
    const { data } = await supabase
      .from('time_capsules')
      .select('*')
      .eq('couple_id', couple.id)
      .order('unlock_at', { ascending: true });
    setItems((data ?? []) as TimeCapsule[]);
  }

  useEffect(() => { void load(); }, [couple?.id]);

  const locked = items.filter((c) => c.is_locked && new Date(c.unlock_at) > new Date());
  const ready = items.filter((c) => c.is_locked && new Date(c.unlock_at) <= new Date());
  const opened = items.filter((c) => !c.is_locked);

  async function unlock(c: TimeCapsule) {
    if (new Date(c.unlock_at) > new Date()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return Alert.alert('Still sealed', `Unlocks in ${describeRemaining(c.unlock_at)}`);
    }
    await supabase
      .from('time_capsules')
      .update({ unlocked_at: new Date().toISOString() })
      .eq('id', c.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await load();
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.6} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: palette.text, fontSize: 22 }}>←</Text>
            </Pressable>
            <Text style={[typography.h2, { color: palette.text }]}>Time capsules</Text>
          </View>
          <Button label="+ Bury" onPress={() => setShowCreate(true)} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          {ready.length > 0 && (
            <GlassCard glow>
              <Text style={[typography.h3, { color: palette.text }]}>Ready to open ✨</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {ready.map((c) => (
                  <Pressable key={c.id} onPress={() => unlock(c)}>
                    <View style={{ padding: 14, borderRadius: radii.md, backgroundColor: palette.primary }}>
                      <Text style={{ color: palette.primaryOn, fontWeight: '800', fontSize: 16 }}>{c.title}</Text>
                      <Text style={{ color: palette.primaryOn, opacity: 0.85, marginTop: 4 }}>
                        Tap to open
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          )}

          {locked.length > 0 && (
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>Sealed</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {locked.map((c) => (
                  <View
                    key={c.id}
                    style={{
                      padding: 14,
                      borderRadius: radii.md,
                      backgroundColor: palette.surface,
                      borderWidth: 1,
                      borderColor: palette.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: palette.text, fontWeight: '600', flex: 1 }}>🔒 {c.title}</Text>
                      <Text style={{ color: palette.accent, fontSize: 12 }}>
                        {describeRemaining(c.unlock_at)}
                      </Text>
                    </View>
                    <Text style={{ color: palette.textFaint, fontSize: 11, marginTop: 4 }}>
                      Opens {new Date(c.unlock_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {opened.length > 0 && (
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>Opened</Text>
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {opened.map((c) => (
                  <View
                    key={c.id}
                    style={{
                      padding: 14, borderRadius: radii.md, backgroundColor: palette.surface,
                      borderWidth: 1, borderColor: palette.border,
                    }}
                  >
                    <Text style={{ color: palette.text, fontWeight: '600' }}>{c.title}</Text>
                    {c.body && (
                      <Text style={{ color: palette.textMuted, marginTop: 6, fontSize: 14, lineHeight: 20 }}>
                        {c.body}
                      </Text>
                    )}
                    <Text style={{ color: palette.textFaint, fontSize: 11, marginTop: 6 }}>
                      Opened {c.unlocked_at ? new Date(c.unlocked_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {items.length === 0 && (
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>Send love forward</Text>
              <Text style={{ color: palette.textMuted, marginTop: 4 }}>
                Bury a message for the future. Sealed until the date you set.
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <Button label="Bury your first capsule" onPress={() => setShowCreate(true)} />
              </View>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>

      <CreateCapsuleModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async () => {
          setShowCreate(false);
          await load();
        }}
      />
    </View>
  );
}

function CreateCapsuleModal({
  visible, onClose, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { palette, typography, spacing } = useTheme();
  const { couple, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [presetMs, setPresetMs] = useState(PRESETS[2]!.ms);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setTitle(''); setBody(''); setPresetMs(PRESETS[2]!.ms); }
  }, [visible]);

  async function save() {
    if (!couple || !profile) return;
    const unlockAt = new Date(Date.now() + presetMs).toISOString();
    const parsed = capsuleSchema.safeParse({ title, body, unlock_at: unlockAt });
    if (!parsed.success) {
      return Alert.alert('Hmm', parsed.error.errors[0]?.message ?? 'Check fields');
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('time_capsules').insert({
        couple_id: couple.id,
        author_id: profile.id,
        title: parsed.data.title,
        body: parsed.data.body,
        unlock_at: parsed.data.unlock_at,
      });
      if (error) throw error;
      void scheduleLocal(
        '✨ A capsule unlocked',
        `"${parsed.data.title}" is ready to open`,
        new Date(unlockAt),
        'capsules',
      );
      void supabase.rpc('complete_quest', { p_couple: couple.id, p_code: 'first_capsule' });
      await onCreated();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <View style={{ backgroundColor: palette.surfaceStrong, padding: spacing.xl, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>Bury a capsule</Text>
        <View style={{ gap: spacing.md }}>
          <TextField label="Title" placeholder="A letter to future us" value={title} onChangeText={setTitle} />
          <TextField
            label="Message"
            placeholder="Tell the future you what you're feeling…"
            multiline
            numberOfLines={6}
            value={body}
            onChangeText={setBody}
          />
          <View>
            <Text style={{ color: palette.textMuted, fontSize: 12, marginBottom: 6 }}>Open in</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => setPresetMs(p.ms)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                    backgroundColor: presetMs === p.ms ? palette.primary : palette.surface,
                    borderWidth: 1, borderColor: palette.border,
                  }}
                >
                  <Text style={{ color: presetMs === p.ms ? palette.primaryOn : palette.text, fontWeight: '600' }}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Button label="Seal it" onPress={save} loading={saving} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
        </View>
      </View>
    </Modal>
  );
}
