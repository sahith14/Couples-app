import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import {
  fromB64,
  type DecryptedMessage,
  type Message,
  openText,
  sealText,
  toB64,
} from '@soulsync/shared';
import { loadOrCreateKeyPair, getPartnerPublicKey } from '@/services/secureKeys';

interface UIMessage extends DecryptedMessage {
  pending?: boolean;
}

export default function Chat() {
  const { palette, typography, spacing, radii } = useTheme();
  const { profile, couple } = useAuthStore();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<UIMessage>>(null);
  const partnerPubKeyRef = useRef<Uint8Array | null>(null);
  const myKpRef = useRef<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>(null);

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
      const ppk = await getPartnerPublicKey();
      partnerPubKeyRef.current = ppk ? fromB64(ppk) : null;
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
    })();

    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = decryptOne(payload.new as Message);
          setMessages((prev) => [...prev, m]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(ch);
    };
  }, [conversationId]);

  function decryptOne(m: Message): UIMessage {
    const base: UIMessage = { ...(m as any), text: undefined };
    if (m.kind === 'text' && m.ciphertext && m.nonce && partnerPubKeyRef.current && myKpRef.current) {
      // Try partner pub key (incoming) first
      const isMine = m.sender_id === profile?.id;
      const otherKey = partnerPubKeyRef.current;
      const text = openText(
        { ciphertext: m.ciphertext as unknown as string, nonce: m.nonce as unknown as string },
        otherKey,
        myKpRef.current.secretKey,
      );
      base.text = text ?? '🔒 (unable to decrypt)';
      return base;
    }
    if (m.kind === 'text') base.text = '🔒';
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
      }

      // Optimistic
      const optimistic: UIMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: profile.id,
        kind: 'text',
        media_path: null,
        media_mime: null,
        media_bytes: null,
        duration_ms: null,
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
        text,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        kind: 'text',
        ciphertext,
        nonce,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.7} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Text style={[typography.h2, { color: palette.text }]}>Chat</Text>
          <Text style={[typography.micro, { color: palette.textFaint }]}>
            Messages are end-to-end encrypted on this device.
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
            return (
              <View
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '78%',
                  backgroundColor: mine ? palette.primary : palette.surface,
                  borderRadius: radii.lg,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderWidth: mine ? 0 : 1,
                  borderColor: palette.border,
                  opacity: item.pending ? 0.6 : 1,
                }}
              >
                <Text style={{ color: mine ? palette.primaryOn : palette.text, fontSize: 16 }}>
                  {item.text ?? '·'}
                </Text>
              </View>
            );
          }}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <GlassCard padding={spacing.sm} radius={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
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
          </GlassCard>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
