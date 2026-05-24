import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import {
  fromB64,
  type Message,
  openText,
  sealText,
  toB64,
} from '@soulsync/shared';
import { loadOrCreateKeyPair, getPartnerPublicKey } from '@/services/secureKeys';
import { syncPartnerPublicKey } from '@/services/keys';
import { sealMedia, openMedia } from '@/services/chatCrypto';

const REACTIONS = ['❤️', '😂', '🔥', '😢', '😍', '🥰', '👍', '🎉'];

interface UIMessage extends Message {
  /** Plaintext (text-kind only) decrypted on this device. */
  text?: string;
  pending?: boolean;
  /** Decrypted image (or audio) stashed as a local data URI for fast display. */
  localUri?: string;
  loadingMedia?: boolean;
}

export default function Chat() {
  const { palette, typography, spacing, radii } = useTheme();
  const { profile, couple } = useAuthStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [reactionTarget, setReactionTarget] = useState<UIMessage | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const listRef = useRef<FlatList<UIMessage>>(null);
  const partnerPubKeyRef = useRef<Uint8Array | null>(null);
  const myKpRef = useRef<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bootstrap conversation + keys
  useEffect(() => {
    if (!couple || !profile) return;
    (async () => {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('couple_id', couple.id)
        .maybeSingle();
      if (data) setConversationId(data.id);

      myKpRef.current = await loadOrCreateKeyPair();

      // Always re-fetch from server (in case partner just generated their key).
      const fresh = await syncPartnerPublicKey();
      const pk = fresh ?? (await getPartnerPublicKey());
      partnerPubKeyRef.current = pk ? fromB64(pk) : null;
    })();
  }, [couple?.id, profile?.id]);

  // Load + subscribe
  useEffect(() => {
    if (!conversationId) return;
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(80);
      if (!mounted) return;
      const decrypted = (data ?? []).map(decryptOne).reverse();
      setMessages(decrypted);
      // Mark read on enter.
      void supabase.rpc('mark_conversation_read', { p_conv: conversationId });
    })();

    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = decryptOne(payload.new as Message);
          setMessages((prev) => {
            // Reconcile optimistic placeholder by created_at + sender match.
            const idx = prev.findIndex(
              (x) => x.pending && x.sender_id === m.sender_id && x.text === m.text,
            );
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = m;
              return copy;
            }
            return [...prev, m];
          });
          if (m.sender_id !== profile?.id) {
            void supabase.rpc('mark_conversation_read', { p_conv: conversationId });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.map((x) =>
              x.id === m.id
                ? { ...x, reactions: m.reactions ?? {}, read_at: m.read_at, edited_at: m.edited_at }
                : x,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(ch);
    };
  }, [conversationId, profile?.id]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, []);

  function decryptOne(m: Message): UIMessage {
    const base: UIMessage = { ...(m as any), text: undefined };
    if (m.kind === 'text' && m.ciphertext && m.nonce && partnerPubKeyRef.current && myKpRef.current) {
      const text = openText(
        { ciphertext: m.ciphertext as unknown as string, nonce: m.nonce as unknown as string },
        partnerPubKeyRef.current,
        myKpRef.current.secretKey,
      );
      base.text = text ?? '🔒 (unable to decrypt)';
    } else if (m.kind === 'text') {
      base.text = '🔒';
    }
    return base;
  }

  async function send() {
    if (!input.trim() || !conversationId || !profile || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    try {
      let ciphertext: string | null = null;
      let nonce: string | null = null;
      if (partnerPubKeyRef.current && myKpRef.current) {
        const sealed = sealText(text, partnerPubKeyRef.current, myKpRef.current.secretKey);
        ciphertext = sealed.ciphertext;
        nonce = sealed.nonce;
      } else {
        Alert.alert('Partner key not found', 'Ask your partner to open the app once so we can exchange encryption keys.');
        return;
      }

      const optimistic: UIMessage = makeOptimistic(profile.id, conversationId, 'text', { text });
      setMessages((prev) => [...prev, optimistic]);

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        kind: 'text',
        ciphertext,
        nonce,
      });
      // Award daily-chat XP (idempotent server-side).
      void supabase.rpc('complete_quest', { p_couple: couple!.id, p_code: 'daily_chat' });
    } finally {
      setSending(false);
    }
  }

  async function pickAndSendImage() {
    if (!conversationId || !profile || !couple) return;
    if (!partnerPubKeyRef.current || !myKpRef.current) {
      return Alert.alert('Partner key missing', 'Need partner online once to exchange E2E keys.');
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (res.canceled) return;
    const asset = res.assets[0]!;

    const optimistic = makeOptimistic(profile.id, conversationId, 'image', { localUri: asset.uri });
    setMessages((prev) => [...prev, optimistic]);

    try {
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
      );
      const b64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToBytes(b64);
      const sealed = sealMedia(bytes, partnerPubKeyRef.current, myKpRef.current.secretKey);
      const path = `${couple.id}/chat/${Date.now()}-${randId()}.bin`;
      const { error: upErr } = await supabase.storage
        .from('chat')
        .upload(path, sealed.ciphertext, { contentType: 'application/octet-stream' });
      if (upErr) throw upErr;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        kind: 'image',
        ciphertext: sealed.wrappedKey.ciphertext,
        nonce: sealed.wrappedKey.nonce,
        media_nonce: sealed.fileNonce,
        media_path: path,
        media_mime: 'image/jpeg',
        media_bytes: bytes.byteLength,
        width: compressed.width,
        height: compressed.height,
      });
      void supabase.rpc('complete_quest', { p_couple: couple.id, p_code: 'share_photo' });
    } catch (e: any) {
      Alert.alert('Send failed', e?.message ?? 'Try again');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  }

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert('Mic permission needed');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setRecordingMs(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const t0 = Date.now();
      recTimerRef.current = setInterval(() => setRecordingMs(Date.now() - t0), 100);
    } catch (e: any) {
      Alert.alert('Recording error', e?.message ?? 'Try again');
    }
  }

  async function stopRecordingAndSend() {
    if (!recording || !conversationId || !profile || !couple) return;
    if (!partnerPubKeyRef.current || !myKpRef.current) return;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      const duration = recordingMs;
      setRecordingMs(0);
      if (!uri) return;
      const optimistic = makeOptimistic(profile.id, conversationId, 'voice', {
        localUri: uri,
        duration_ms: duration,
      });
      setMessages((prev) => [...prev, optimistic]);

      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = base64ToBytes(b64);
      const sealed = sealMedia(bytes, partnerPubKeyRef.current, myKpRef.current.secretKey);
      const path = `${couple.id}/voice/${Date.now()}-${randId()}.bin`;
      const { error: upErr } = await supabase.storage
        .from('voice')
        .upload(path, sealed.ciphertext, { contentType: 'application/octet-stream' });
      if (upErr) throw upErr;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        kind: 'voice',
        ciphertext: sealed.wrappedKey.ciphertext,
        nonce: sealed.wrappedKey.nonce,
        media_nonce: sealed.fileNonce,
        media_path: path,
        media_mime: 'audio/m4a',
        media_bytes: bytes.byteLength,
        duration_ms: duration,
      });
      void supabase.rpc('complete_quest', { p_couple: couple.id, p_code: 'voice_note' });
    } catch (e: any) {
      Alert.alert('Voice send failed', e?.message ?? 'Try again');
    }
  }

  async function cancelRecording() {
    if (!recording) return;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    try { await recording.stopAndUnloadAsync(); } catch {}
    setRecording(null);
    setRecordingMs(0);
  }

  /** Lazy decrypt + cache image/voice URIs as we render. */
  const ensureMedia = useCallback(
    async (m: UIMessage) => {
      if (!m.media_path || m.localUri || m.loadingMedia) return;
      if (!partnerPubKeyRef.current || !myKpRef.current) return;
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, loadingMedia: true } : x)));
      try {
        const bucket = m.kind === 'voice' ? 'voice' : 'chat';
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(m.media_path, 600);
        if (!signed?.signedUrl) throw new Error('no-url');
        const fetched = await fetch(signed.signedUrl);
        const ab = await fetched.arrayBuffer();
        const bytes = new Uint8Array(ab);
        const opened = openMedia(
          bytes,
          { ciphertext: m.ciphertext as unknown as string, nonce: m.nonce as unknown as string },
          (m as any).media_nonce,
          partnerPubKeyRef.current,
          myKpRef.current.secretKey,
        );
        if (!opened) throw new Error('decrypt-failed');
        const ext = m.kind === 'voice' ? 'm4a' : 'jpg';
        const localPath = `${FileSystem.cacheDirectory}msg-${m.id}.${ext}`;
        await FileSystem.writeAsStringAsync(localPath, bytesToBase64(opened), {
          encoding: FileSystem.EncodingType.Base64,
        });
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, localUri: localPath, loadingMedia: false } : x)),
        );
      } catch {
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, loadingMedia: false } : x)));
      }
    },
    [],
  );

  async function playVoice(m: UIMessage) {
    if (!m.localUri) {
      await ensureMedia(m);
      return;
    }
    try {
      await soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: m.localUri });
      soundRef.current = sound;
      setPlayingId(m.id);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) setPlayingId(null);
      });
      await sound.playAsync();
    } catch {
      setPlayingId(null);
    }
  }

  async function toggleReaction(msg: UIMessage, emoji: string) {
    Haptics.selectionAsync();
    setReactionTarget(null);
    await supabase.rpc('toggle_reaction', { p_msg: msg.id, p_emoji: emoji });
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.7} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Text style={[typography.h2, { color: palette.text }]}>Chat</Text>
          <Text style={[typography.micro, { color: palette.textFaint }]}>
            End-to-end encrypted · {partnerPubKeyRef.current ? '🔐 keys ok' : '⚠ partner key pending'}
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 90, gap: 6 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id;
            const reactionEntries = Object.entries(item.reactions ?? {}).filter(
              ([, users]) => Array.isArray(users) && users.length > 0,
            );
            return (
              <Pressable
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setReactionTarget(item);
                }}
              >
                <View
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '78%',
                    backgroundColor:
                      item.kind === 'text' ? (mine ? palette.primary : palette.surface) : 'transparent',
                    borderRadius: radii.lg,
                    paddingHorizontal: item.kind === 'text' ? 14 : 0,
                    paddingVertical: item.kind === 'text' ? 10 : 0,
                    borderWidth: item.kind === 'text' && !mine ? 1 : 0,
                    borderColor: palette.border,
                    opacity: item.pending ? 0.6 : 1,
                  }}
                >
                  {item.kind === 'text' && (
                    <Text style={{ color: mine ? palette.primaryOn : palette.text, fontSize: 16 }}>
                      {item.text ?? '·'}
                    </Text>
                  )}

                  {item.kind === 'image' && (
                    <ImageBubble
                      m={item}
                      onMount={() => ensureMedia(item)}
                      width={Math.min(240, item.width ?? 240)}
                      height={Math.min(320, ((item.height ?? 320) / (item.width ?? 240)) * 240)}
                      bg={palette.surface}
                    />
                  )}

                  {item.kind === 'voice' && (
                    <VoiceBubble
                      m={item}
                      mine={mine}
                      playing={playingId === item.id}
                      onPlay={() => playVoice(item)}
                      onMount={() => ensureMedia(item)}
                      palette={palette}
                    />
                  )}
                </View>

                {/* reactions row */}
                {reactionEntries.length > 0 && (
                  <View
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      flexDirection: 'row',
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    {reactionEntries.map(([emoji, users]) => (
                      <View
                        key={emoji}
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: palette.surfaceStrong,
                          borderWidth: 1,
                          borderColor: palette.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: palette.text }}>
                          {emoji} {users.length > 1 ? users.length : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* read receipt */}
                {mine && !item.pending && (
                  <Text
                    style={{
                      alignSelf: 'flex-end',
                      color: item.read_at ? palette.primary : palette.textFaint,
                      fontSize: 10,
                      marginTop: 2,
                    }}
                  >
                    {item.read_at ? '✓✓ seen' : '✓ sent'}
                  </Text>
                )}
              </Pressable>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <GlassCard padding={spacing.sm} radius={0}>
            {recording ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.danger, fontWeight: '700' }}>● Recording</Text>
                  <Text style={{ color: palette.textMuted, fontSize: 12 }}>
                    {(recordingMs / 1000).toFixed(1)}s
                  </Text>
                </View>
                <Button label="Cancel" variant="ghost" onPress={cancelRecording} />
                <Button label="Send" onPress={stopRecordingAndSend} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Pressable
                  onPress={pickAndSendImage}
                  style={{ paddingHorizontal: 6, paddingVertical: 6 }}
                >
                  <Text style={{ color: palette.text, fontSize: 22 }}>📷</Text>
                </Pressable>
                <Pressable
                  onPressIn={startRecording}
                  style={{ paddingHorizontal: 6, paddingVertical: 6 }}
                >
                  <Text style={{ color: palette.text, fontSize: 22 }}>🎙️</Text>
                </Pressable>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Say something sweet…"
                  placeholderTextColor={palette.textFaint}
                  style={{
                    flex: 1,
                    color: palette.text,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 10,
                    fontSize: 16,
                  }}
                  multiline
                />
                <Button label="Send" onPress={send} loading={sending} />
              </View>
            )}
          </GlassCard>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Reaction picker */}
      <Modal
        transparent
        visible={!!reactionTarget}
        animationType="fade"
        onRequestClose={() => setReactionTarget(null)}
      >
        <Pressable
          onPress={() => setReactionTarget(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
        >
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              padding: 16,
              borderRadius: 28,
              backgroundColor: palette.surfaceStrong,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            {REACTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={() => reactionTarget && toggleReaction(reactionTarget, e)}
                style={{ padding: 6 }}
              >
                <Text style={{ fontSize: 30 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------- helpers ---------------------------------------------------------

function makeOptimistic(
  senderId: string,
  conversationId: string,
  kind: 'text' | 'image' | 'voice',
  extras: { text?: string; localUri?: string; duration_ms?: number },
): UIMessage {
  return {
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversation_id: conversationId,
    sender_id: senderId,
    kind,
    media_path: null,
    media_mime: null,
    media_bytes: null,
    media_nonce: null,
    duration_ms: extras.duration_ms ?? null,
    width: null,
    height: null,
    reply_to: null,
    reactions: {},
    read_at: null,
    delivered_at: null,
    expires_at: null,
    edited_at: null,
    pinned: false,
    created_at: new Date().toISOString(),
    text: extras.text,
    localUri: extras.localUri,
    pending: true,
  } as UIMessage;
}

function ImageBubble({
  m, onMount, width, height, bg,
}: { m: UIMessage; onMount: () => void; width: number; height: number; bg: string }) {
  useEffect(() => { void onMount(); }, []);
  return (
    <View style={{ width, height, borderRadius: 16, overflow: 'hidden', backgroundColor: bg }}>
      {m.localUri ? (
        <Image source={{ uri: m.localUri }} contentFit="cover" style={{ width, height }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

function VoiceBubble({
  m, mine, playing, onPlay, onMount, palette,
}: {
  m: UIMessage; mine: boolean; playing: boolean; onPlay: () => void; onMount: () => void;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  useEffect(() => { void onMount(); }, []);
  const seconds = ((m.duration_ms ?? 0) / 1000).toFixed(1);
  return (
    <Pressable
      onPress={onPlay}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: mine ? palette.primary : palette.surface,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 8,
        minWidth: 140,
      }}
    >
      <Text style={{ fontSize: 18 }}>{playing ? '⏸' : '▶'}</Text>
      <Text style={{ color: mine ? palette.primaryOn : palette.text, fontWeight: '600' }}>
        {m.localUri ? `${seconds}s` : 'tap to load'}
      </Text>
    </Pressable>
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(bin);
}

function randId(): string {
  return Math.random().toString(36).slice(2, 10);
}
