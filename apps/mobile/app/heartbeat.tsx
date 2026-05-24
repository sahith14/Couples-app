import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';

/**
 * Heartbeat Mode.
 *
 * Both partners join a Supabase Realtime presence channel. Each partner has
 * a tap-able heart that pulses on touch and broadcasts a `pulse` event. The
 * other side feels the pulse with a haptic and an outward ring animation.
 *
 * Synchronised heartbeat = the visual when both are pulsing in the last 2s.
 */

export default function Heartbeat() {
  const router = useRouter();
  const { palette, typography, spacing } = useTheme();
  const { profile, couple } = useAuthStore();
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [synced, setSynced] = useState(false);
  const lastMineRef = useRef<number>(0);
  const lastTheirsRef = useRef<number>(0);

  const myScale = useSharedValue(1);
  const theirScale = useSharedValue(1);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Slow ambient breath when idle.
  useEffect(() => {
    myScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
    theirScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(myScale);
      cancelAnimation(theirScale);
    };
  }, []);

  // Presence channel for partner.
  useEffect(() => {
    if (!couple || !profile) return;
    const ch = supabase.channel(`heartbeat:${couple.id}`, {
      config: { presence: { key: profile.id } },
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const others = Object.keys(state).filter((k) => k !== profile.id);
      setPartnerOnline(others.length > 0);
    });
    ch.on('broadcast', { event: 'pulse' }, ({ payload }) => {
      if ((payload as any)?.from === profile.id) return;
      lastTheirsRef.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      theirScale.value = withSequence(
        withSpring(1.35, { damping: 6, stiffness: 220 }),
        withSpring(1.0, { damping: 12 }),
      );
      ringScale.value = 0;
      ringOpacity.value = 0.6;
      ringScale.value = withTiming(1.6, { duration: 700 });
      ringOpacity.value = withTiming(0, { duration: 700 });
      checkSync();
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ user_id: profile.id, online_at: Date.now() });
    });
    channelRef.current = ch;
    return () => {
      channelRef.current = null;
      void ch.unsubscribe();
      void supabase.removeChannel(ch);
    };
  }, [couple?.id, profile?.id]);

  function checkSync() {
    const now = Date.now();
    if (now - lastMineRef.current < 2000 && now - lastTheirsRef.current < 2000) {
      setSynced(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSynced(false), 1800);
    }
  }

  async function pulse() {
    if (!couple || !profile) return;
    lastMineRef.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    myScale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 220 }),
      withSpring(1.0, { damping: 12 }),
    );

    const ch = channelRef.current;
    if (ch) {
      void ch.send({ type: 'broadcast', event: 'pulse', payload: { from: profile.id } });
    }
    checkSync();
  }

  const myStyle = useAnimatedStyle(() => ({ transform: [{ scale: myScale.value }] }));
  const theirStyle = useAnimatedStyle(() => ({ transform: [{ scale: theirScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={1.4} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: palette.text, fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={[typography.h2, { color: palette.text }]}>Heartbeat</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Text
            style={[
              typography.body,
              { color: synced ? palette.primary : palette.textMuted, textAlign: 'center', marginBottom: spacing.xl },
            ]}
          >
            {synced
              ? '💗 in sync'
              : partnerOnline
                ? "they're here. tap together."
                : 'waiting for them to open this screen…'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 64 }}>
            {/* Their pulse */}
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.textMuted, fontSize: 11, letterSpacing: 1 }}>THEM</Text>
              <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      width: 120, height: 120, borderRadius: 60,
                      borderWidth: 3, borderColor: palette.accent,
                    },
                    ringStyle,
                  ]}
                />
                <Animated.View style={[theirStyle]}>
                  <LinearGradient
                    colors={[palette.accent, palette.primary]}
                    style={{ width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontSize: 48 }}>💗</Text>
                  </LinearGradient>
                </Animated.View>
              </View>
            </View>

            {/* My pulse */}
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text style={{ color: palette.textMuted, fontSize: 11, letterSpacing: 1 }}>YOU</Text>
              <Pressable
                onPressIn={pulse}
                style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}
              >
                <Animated.View style={[myStyle]}>
                  <LinearGradient
                    colors={palette.gradient as [string, string, ...string[]]}
                    style={{
                      width: 100, height: 100, borderRadius: 50,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: palette.primary,
                      shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
                    }}
                  >
                    <Text style={{ fontSize: 48 }}>❤️</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            </View>
          </View>

          <Text
            style={[
              typography.micro,
              { color: palette.textFaint, textAlign: 'center', marginTop: spacing.huge },
            ]}
          >
            tap your heart. they'll feel it on the other side.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
