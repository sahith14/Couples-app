import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, TextInput, Alert, FlatList,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fromB64, moodColors, type Instant, type InstantKind } from '@soulsync/shared';
import { loadOrCreateKeyPair, getPartnerPublicKey } from '@/services/secureKeys';
import { syncPartnerPublicKey } from '@/services/keys';
import { sealMedia, openMedia } from '@/services/chatCrypto';
import { sealText, openText } from '@soulsync/shared';
import { setCurrentScreen } from '@/services/phoneStatus';

const { width: W } = Dimensions.get('window');
const CARD_W = Math.min(W - 64, 360);

type UIInstant = Instant & {
  decryptedText?: string;
  mediaLocalUri?: string;
  loading?: boolean;
};

const MOODS = ['happy','loved','excited','calm','sad','anxious','tired','angry','longing'] as const;

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'gone';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function Instants() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { profile, couple } = useAuthStore();
  const [items, setItems] = useState<UIInstant[]>([]);
  const [creating, setCreating] = useState<InstantKind | null>(null);
  const partnerPubKey = useRef<Uint8Array | null>(null);
  const myKp = useRef<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>(null);

  useFocusEffect(useCallback(() => {
    setCurrentScreen('instants');
    return () => setCurrentScreen(null);
  }, []));

  useEffect(() => {
    (async () => {
      myKp.current = await loadOrCreateKeyPair();
      const fresh = await syncPartnerPublicKey();
      const pk = fresh ?? (await getPartnerPublicKey());
      partnerPubKey.current = pk ? fromB64(pk) : null;
    })();
  }, [couple?.id]);

  const load = useCallback(async () => {
    if (!couple) return;
    const { data } = await supabase
      .from('instants')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false });
    const list = (data ?? []) as Instant[];
    // Decrypt text on the fly
    const ui: UIInstant[] = list.map((i) => {
      let decryptedText: string | undefined;
      if (i.kind === 'text' && i.body == null && i.ciphertext && i.nonce && partnerPubKey.current && myKp.current) {
        const opened = openText(
          { ciphertext: i.ciphertext as unknown as string, nonce: i.nonce as unknown as string },
          partnerPubKey.current,
          myKp.current.secretKey,
        );
        if (opened) decryptedText = opened;
      }
      return { ...i, decryptedText };
    });
    setItems(ui);
  }, [couple?.id]);

  useEffect(() => { void load(); }, [load]);

  // Realtime so partner instants pop in.
  useEffect(() => {
    if (!couple) return;
    const ch = supabase
      .channel(`instants:${couple.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'instants', filter: `couple_id=eq.${couple.id}` }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [couple?.id, load]);

  async function markSeen(i: UIInstant) {
    if (i.author_id === profile?.id) return; // mine
    if (i.views[profile?.id ?? '']) return;  // already seen
    await supabase.rpc('mark_instant_seen', { p_instant: i.id });
  }

  async function ensureMedia(i: UIInstant) {
    if (i.kind !== 'photo' || i.mediaLocalUri || i.loading) return;
    if (!i.media_path || !partnerPubKey.current || !myKp.current) return;
    setItems((prev) => prev.map((x) => x.id === i.id ? { ...x, loading: true } : x));
    try {
      const { data: signed } = await supabase.storage.from('chat').createSignedUrl(i.media_path, 600);
      if (!signed?.signedUrl) throw new Error('no-url');
      const buf = new Uint8Array(await (await fetch(signed.signedUrl)).arrayBuffer());
      const opened = openMedia(
        buf,
        { ciphertext: i.ciphertext as unknown as string, nonce: i.nonce as unknown as string },
        i.media_nonce as unknown as string,
        partnerPubKey.current,
        myKp.current.secretKey,
      );
      if (!opened) throw new Error('decrypt-failed');
      const localPath = `${FileSystem.cacheDirectory}instant-${i.id}.jpg`;
      await FileSystem.writeAsStringAsync(localPath, bytesToB64(opened), { encoding: FileSystem.EncodingType.Base64 });
      setItems((prev) => prev.map((x) => x.id === i.id ? { ...x, mediaLocalUri: localPath, loading: false } : x));
    } catch {
      setItems((prev) => prev.map((x) => x.id === i.id ? { ...x, loading: false } : x));
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.7} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: palette.text, fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={[typography.h2, { color: palette.text, flex: 1 }]}>Instants</Text>
          <Text style={{ color: palette.textFaint, fontSize: 11 }}>24h · ephemeral</Text>
        </View>

        {/* Create row */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
          <CreateChip emoji="📸" label="Photo" onPress={() => setCreating('photo')} palette={palette} />
          <CreateChip emoji="✨" label="Text"  onPress={() => setCreating('text')}  palette={palette} />
          <CreateChip emoji="💗" label="Mood"  onPress={() => setCreating('mood')}  palette={palette} />
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          ListEmptyComponent={() => (
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>Quiet so far</Text>
              <Text style={{ color: palette.textMuted, marginTop: 4 }}>
                Drop a photo, a thought, or a mood. They auto-vanish in 24 hours.
              </Text>
            </GlassCard>
          )}
          renderItem={({ item }) => {
            const mine = item.author_id === profile?.id;
            const seen = !!item.views[profile?.id ?? ''];
            return (
              <Pressable
                onPress={() => { void markSeen(item); void ensureMedia(item); }}
                style={{ alignSelf: 'center', width: CARD_W }}
              >
                <View
                  style={{
                    borderRadius: 22,
                    padding: 2,
                    backgroundColor: !mine && !seen ? palette.primary : palette.border,
                  }}
                >
                  <View
                    style={{
                      borderRadius: 20,
                      overflow: 'hidden',
                      backgroundColor: palette.surface,
                      borderWidth: 1,
                      borderColor: palette.border,
                    }}
                  >
                    {item.kind === 'photo' && (
                      <View style={{ aspectRatio: 4/5, backgroundColor: palette.surfaceStrong }}>
                        {item.mediaLocalUri ? (
                          <Image source={{ uri: item.mediaLocalUri }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            {item.loading ? <ActivityIndicator color={palette.primary} /> : <Text style={{ color: palette.textFaint }}>tap to load</Text>}
                          </View>
                        )}
                      </View>
                    )}
                    {item.kind === 'text' && (
                      <View style={{ padding: 24, minHeight: 180, justifyContent: 'center' }}>
                        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700', lineHeight: 30 }}>
                          {item.decryptedText ?? item.body ?? '🔒'}
                        </Text>
                      </View>
                    )}
                    {item.kind === 'mood' && (
                      <LinearGradient
                        colors={[(item.mood && moodColors[item.mood]) || palette.primary, palette.bg]}
                        style={{ padding: 24, minHeight: 180, justifyContent: 'center', alignItems: 'center' }}
                      >
                        <Text style={{ fontSize: 56 }}>
                          {item.mood ? moodEmoji(item.mood) : '💗'}
                        </Text>
                        <Text style={{ color: '#0B0710', fontSize: 18, fontWeight: '900', marginTop: 8, textTransform: 'uppercase', letterSpacing: 2 }}>
                          {item.mood ?? 'mood'}
                        </Text>
                        {item.body && (
                          <Text style={{ color: 'rgba(11,7,16,0.7)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                            {item.body}
                          </Text>
                        )}
                      </LinearGradient>
                    )}

                    <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.border }}>
                      <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '600' }}>
                        {mine ? 'you' : 'partner'} · {timeAgo(item.created_at)}
                      </Text>
                      <Text style={{ color: palette.textFaint, fontSize: 11 }}>
                        {timeRemaining(item.expires_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>

      {creating && (
        <CreateModal
          kind={creating}
          onClose={() => setCreating(null)}
          onCreated={async () => { setCreating(null); await load(); }}
          partnerPubKey={partnerPubKey.current}
          myKpRef={myKp}
        />
      )}
    </View>
  );
}

function CreateChip({
  emoji, label, onPress, palette,
}: {
  emoji: string; label: string; onPress: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={{
        flex: 1, paddingVertical: 14, borderRadius: 16,
        backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
        alignItems: 'center', gap: 4,
      }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ color: palette.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function CreateModal({
  kind, onClose, onCreated, partnerPubKey, myKpRef,
}: {
  kind: InstantKind;
  onClose: () => void;
  onCreated: () => Promise<void>;
  partnerPubKey: Uint8Array | null;
  myKpRef: React.MutableRefObject<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>;
}) {
  const { palette, typography, spacing } = useTheme();
  const { profile, couple } = useAuthStore();
  const [text, setText] = useState('');
  const [mood, setMood] = useState<string>('loved');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedDims, setPickedDims] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (r.canceled) return;
    setPickedUri(r.assets[0]!.uri);
    setPickedDims({ w: r.assets[0]!.width ?? 1080, h: r.assets[0]!.height ?? 1350 });
  }

  async function save() {
    if (!couple || !profile) return;
    setSaving(true);
    try {
      if (kind === 'photo') {
        if (!pickedUri || !partnerPubKey || !myKpRef.current) {
          Alert.alert('Need a photo + partner key');
          return;
        }
        const compressed = await ImageManipulator.manipulateAsync(
          pickedUri,
          [{ resize: { width: 1280 } }],
          { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
        );
        const b64 = await FileSystem.readAsStringAsync(compressed.uri, { encoding: FileSystem.EncodingType.Base64 });
        const bytes = b64ToBytes(b64);
        const sealed = sealMedia(bytes, partnerPubKey, myKpRef.current.secretKey);
        const path = `${couple.id}/instants/${Date.now()}-${Math.random().toString(36).slice(2,8)}.bin`;
        const { error: upErr } = await supabase.storage.from('chat').upload(path, sealed.ciphertext, { contentType: 'application/octet-stream' });
        if (upErr) throw upErr;
        await supabase.from('instants').insert({
          couple_id: couple.id,
          author_id: profile.id,
          kind: 'photo',
          ciphertext: sealed.wrappedKey.ciphertext,
          nonce: sealed.wrappedKey.nonce,
          media_nonce: sealed.fileNonce,
          media_path: path,
          body: text.trim() || null,
        });
      } else if (kind === 'text') {
        if (!text.trim()) { Alert.alert('Type something first'); return; }
        let ciphertext: string | null = null;
        let nonce: string | null = null;
        if (partnerPubKey && myKpRef.current) {
          const sealed = sealText(text.trim(), partnerPubKey, myKpRef.current.secretKey);
          ciphertext = sealed.ciphertext;
          nonce = sealed.nonce;
        }
        await supabase.from('instants').insert({
          couple_id: couple.id,
          author_id: profile.id,
          kind: 'text',
          body: ciphertext ? null : text.trim(),
          ciphertext,
          nonce,
        });
      } else {
        // mood
        await supabase.from('instants').insert({
          couple_id: couple.id,
          author_id: profile.id,
          kind: 'mood',
          mood,
          body: text.trim() || null,
        });
      }
      void supabase.rpc('complete_quest', { p_couple: couple.id, p_code: 'first_instant' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onCreated();
    } catch (e: any) {
      Alert.alert('Could not post', e?.message ?? 'Try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <View style={{ backgroundColor: palette.surfaceStrong, padding: spacing.xl, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
          {kind === 'photo' ? 'New photo instant' : kind === 'text' ? 'Quick thought' : 'How you feel'}
        </Text>

        {kind === 'photo' && (
          <View style={{ gap: spacing.md }}>
            {pickedUri ? (
              <Image source={{ uri: pickedUri }} contentFit="cover" style={{ width: '100%', aspectRatio: 4/5, borderRadius: 16, backgroundColor: palette.surface }} />
            ) : (
              <Pressable onPress={pick} style={{ width: '100%', aspectRatio: 4/5, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 36 }}>📸</Text>
                <Text style={{ color: palette.textMuted, marginTop: 6, fontWeight: '600' }}>Pick a photo</Text>
              </Pressable>
            )}
            {pickedUri && <Button label="Change" variant="ghost" onPress={pick} />}
            <TextField
              label="Caption (optional)"
              placeholder="say something…"
              value={text}
              onChangeText={setText}
              maxLength={120}
            />
          </View>
        )}

        {kind === 'text' && (
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="thinking of you because…"
            placeholderTextColor={palette.textFaint}
            multiline
            style={{
              color: palette.text, fontSize: 22, fontWeight: '700', lineHeight: 30,
              padding: 16, borderRadius: 16, minHeight: 180,
              backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
            }}
            maxLength={280}
          />
        )}

        {kind === 'mood' && (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MOODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => { setMood(m); Haptics.selectionAsync(); }}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
                    backgroundColor: mood === m ? (moodColors[m] ?? palette.primary) : palette.surface,
                    borderWidth: 1, borderColor: palette.border,
                  }}
                >
                  <Text style={{ color: mood === m ? '#0B0710' : palette.text, fontWeight: '700' }}>
                    {moodEmoji(m)} {m}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextField
              label="Note (optional)"
              placeholder="why?"
              value={text}
              onChangeText={setText}
              maxLength={120}
            />
          </View>
        )}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button label={saving ? 'Posting…' : 'Post (vanishes in 24h)'} onPress={save} loading={saving} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

function moodEmoji(m: string): string {
  switch (m) {
    case 'happy': return '😊';
    case 'loved': return '🥰';
    case 'excited': return '✨';
    case 'calm': return '😌';
    case 'sad': return '😢';
    case 'anxious': return '😬';
    case 'tired': return '😴';
    case 'angry': return '😤';
    case 'longing': return '🥺';
    default: return '💗';
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return globalThis.btoa(s);
}
