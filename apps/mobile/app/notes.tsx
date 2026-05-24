import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Note } from '@soulsync/shared';

const EMOJIS = ['📝', '💡', '❤️', '✈️', '🍣', '🎁', '🎵', '⭐'];

export default function Notes() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { couple, profile } = useAuthStore();
  const [items, setItems] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Note | null>(null);

  const load = useCallback(async () => {
    if (!couple) return;
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('couple_id', couple.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    setItems((data ?? []) as Note[]);
  }, [couple?.id]);

  useEffect(() => { void load(); }, [load]);

  // Realtime updates so partner edits show up live.
  useEffect(() => {
    if (!couple) return;
    const ch = supabase
      .channel(`notes:${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `couple_id=eq.${couple.id}` }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [couple?.id, load]);

  async function newNote() {
    if (!couple || !profile) return;
    const { data, error } = await supabase
      .from('notes')
      .insert({ couple_id: couple.id, author_id: profile.id, body: '', emoji: '📝' })
      .select()
      .single();
    if (error) return Alert.alert('Could not create', error.message);
    setEditing(data as Note);
  }

  async function togglePin(n: Note) {
    Haptics.selectionAsync();
    await supabase.from('notes').update({ pinned: !n.pinned }).eq('id', n.id);
  }

  async function remove(n: Note) {
    Alert.alert('Delete this note?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await supabase.from('notes').delete().eq('id', n.id); },
      },
    ]);
  }

  if (editing) {
    return <EditNote note={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.5} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ color: palette.text, fontSize: 22 }}>←</Text>
            </Pressable>
            <Text style={[typography.h2, { color: palette.text }]}>Shared notes</Text>
          </View>
          <Button label="+ New" onPress={newNote} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
          {items.length === 0 && (
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>Nothing here yet</Text>
              <Text style={{ color: palette.textMuted, marginTop: 4 }}>
                Trip itineraries, recipes, lists. You both can edit, in real time.
              </Text>
            </GlassCard>
          )}
          {items.map((n) => (
            <Pressable key={n.id} onPress={() => setEditing(n)} onLongPress={() => remove(n)}>
              <GlassCard>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>
                      {n.emoji ?? '📝'} {n.title || 'Untitled'}
                    </Text>
                    <Text
                      numberOfLines={3}
                      style={{ color: palette.textMuted, marginTop: 6, fontSize: 14, lineHeight: 20 }}
                    >
                      {n.body || 'Empty…'}
                    </Text>
                    <Text style={{ color: palette.textFaint, fontSize: 11, marginTop: 6 }}>
                      Updated {new Date(n.updated_at).toLocaleString()}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => togglePin(n)}
                    hitSlop={8}
                    style={{ paddingLeft: 8 }}
                  >
                    <Text style={{ fontSize: 20 }}>{n.pinned ? '📌' : '📍'}</Text>
                  </Pressable>
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function EditNote({ note, onClose }: { note: Note; onClose: () => void }) {
  const { palette, typography, spacing } = useTheme();
  const [title, setTitle] = useState(note.title ?? '');
  const [body, setBody] = useState(note.body ?? '');
  const [emoji, setEmoji] = useState(note.emoji ?? '📝');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Debounced autosave so the partner sees updates as we type, without writing on every keystroke.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(async () => {
      setSaving(true);
      await supabase
        .from('notes')
        .update({ title: title || null, body, emoji })
        .eq('id', note.id);
      setSaving(false);
      setDirty(false);
    }, 600);
    return () => clearTimeout(t);
  }, [title, body, emoji, dirty]);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.4} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={onClose}>
            <Text style={{ color: palette.text, fontSize: 22 }}>← Done</Text>
          </Pressable>
          <Text style={{ color: palette.textFaint, fontSize: 12 }}>
            {saving ? 'saving…' : dirty ? 'unsaved' : 'saved'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => { setEmoji(e); setDirty(true); }}
                style={{
                  width: 38, height: 38, borderRadius: 8,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: emoji === e ? palette.primary : palette.surface,
                  borderWidth: 1, borderColor: palette.border,
                }}
              >
                <Text style={{ fontSize: 18 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={title}
            onChangeText={(t) => { setTitle(t); setDirty(true); }}
            placeholder="Title"
            placeholderTextColor={palette.textFaint}
            style={[typography.h2, { color: palette.text, paddingVertical: 6 }]}
          />
          <TextInput
            value={body}
            onChangeText={(t) => { setBody(t); setDirty(true); }}
            placeholder="Write together…"
            placeholderTextColor={palette.textFaint}
            multiline
            style={{ color: palette.text, fontSize: 16, lineHeight: 24, minHeight: 300 }}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
