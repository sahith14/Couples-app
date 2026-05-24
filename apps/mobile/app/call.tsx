import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import {
  openCallChannel, loadWebRTC, STUN_SERVERS,
  type CallChannel, type SignalEvent, type WebRTCModule,
} from '@/services/callSignaling';
import { setCurrentScreen } from '@/services/phoneStatus';

type CallState = 'idle' | 'ringing-out' | 'ringing-in' | 'connecting' | 'connected' | 'ended';

export default function Call() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { profile, couple } = useAuthStore();
  const params = useLocalSearchParams<{ as?: 'caller' | 'callee' }>();
  const initialMode = params.as ?? 'caller';

  const [state, setState] = useState<CallState>(initialMode === 'callee' ? 'ringing-in' : 'idle');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [webrtc] = useState<WebRTCModule | null>(() => loadWebRTC());
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const channelRef = useRef<CallChannel | null>(null);
  const pcRef = useRef<any>(null);
  const startedAtRef = useRef<number | null>(null);

  useFocusEffect(useCallback(() => {
    setCurrentScreen('call');
    return () => setCurrentScreen(null);
  }, []));

  // Open signaling channel
  useEffect(() => {
    if (!couple || !profile) return;
    channelRef.current = openCallChannel(couple.id, profile.id, handleSignal);
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [couple?.id, profile?.id]);

  // Duration counter
  useEffect(() => {
    if (state !== 'connected') return;
    startedAtRef.current = Date.now();
    const t = setInterval(() => {
      if (startedAtRef.current) setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  async function setupLocalMedia(): Promise<any | null> {
    if (!webrtc) return null;
    try {
      const stream = await webrtc.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
      setLocalStream(stream);
      return stream;
    } catch (e: any) {
      Alert.alert('Camera/mic error', e?.message ?? 'Permissions?');
      return null;
    }
  }

  async function createPeer(stream: any): Promise<any | null> {
    if (!webrtc) return null;
    const pc = new webrtc.RTCPeerConnection({ iceServers: STUN_SERVERS });
    stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
    pc.ontrack = (e: any) => {
      if (e.streams[0]) setRemoteStream(e.streams[0]);
    };
    pc.onicecandidate = (e: any) => {
      if (e.candidate && profile) {
        channelRef.current?.send({ type: 'ice', from: profile.id, candidate: e.candidate });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setState('connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') endCall();
    };
    pcRef.current = pc;
    return pc;
  }

  async function startCall() {
    if (!profile) return;
    if (!webrtc) {
      Alert.alert(
        'Native build needed',
        "Video calls need the `react-native-webrtc` native module. Run a dev-client build:\n\n" +
        "  pnpm --filter @soulsync/mobile add react-native-webrtc\n" +
        "  pnpm --filter @soulsync/mobile exec eas build --profile development --platform ios\n\n" +
        "Signaling still works — we'll send the ring to your partner.",
      );
      // Still send the ring so the partner sees the incoming call screen.
      channelRef.current?.send({ type: 'ring', from: profile.id });
      setState('ringing-out');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('ringing-out');
    channelRef.current?.send({ type: 'ring', from: profile.id });
  }

  async function acceptCall() {
    if (!profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    channelRef.current?.send({ type: 'accept', from: profile.id });
    setState('connecting');
    if (!webrtc) {
      Alert.alert('Audio-only fallback', 'Build the dev-client to get video. We\'ll keep the call alive over signaling.');
      return;
    }
    const stream = await setupLocalMedia();
    if (!stream) return;
    await createPeer(stream);
    // Wait for caller's offer; handleSignal will set remote desc and answer.
  }

  function rejectCall() {
    if (!profile) return;
    channelRef.current?.send({ type: 'reject', from: profile.id });
    endCall();
  }

  function endCall() {
    if (profile) channelRef.current?.send({ type: 'bye', from: profile.id });
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks?.().forEach((t: any) => t.stop?.());
    setLocalStream(null);
    setRemoteStream(null);
    setState('ended');
    setTimeout(() => router.back(), 600);
  }

  async function handleSignal(e: SignalEvent) {
    if (!profile) return;
    switch (e.type) {
      case 'ring':
        if (state === 'idle' || state === 'ended') setState('ringing-in');
        break;
      case 'accept':
        // We're the caller — partner accepted, send the offer.
        setState('connecting');
        if (!webrtc) return;
        {
          const stream = await setupLocalMedia();
          if (!stream) return;
          const pc = await createPeer(stream);
          if (!pc) return;
          const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          channelRef.current?.send({ type: 'sdp', from: profile.id, sdp: offer });
        }
        break;
      case 'reject':
        Alert.alert('Call rejected');
        endCall();
        break;
      case 'sdp':
        if (!webrtc || !pcRef.current) return;
        await pcRef.current.setRemoteDescription(new webrtc.RTCSessionDescription(e.sdp));
        if (e.sdp.type === 'offer') {
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          channelRef.current?.send({ type: 'sdp', from: profile.id, sdp: answer });
        }
        break;
      case 'ice':
        if (!webrtc || !pcRef.current) return;
        try { await pcRef.current.addIceCandidate(new webrtc.RTCIceCandidate(e.candidate)); } catch {}
        break;
      case 'bye':
        endCall();
        break;
    }
  }

  // ---------- render ----------
  const RTCView = webrtc?.RTCView;

  if (state === 'idle') {
    return (
      <View style={{ flex: 1 }}>
        <AuroraBackdrop intensity={0.9} />
        <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: spacing.lg }}>
            <LinearGradient
              colors={[palette.primary, palette.accent]}
              style={{ width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 64 }}>📞</Text>
            </LinearGradient>
            <Text style={[typography.h1, { color: palette.text, textAlign: 'center' }]}>
              Call your partner
            </Text>
            <Text style={[typography.body, { color: palette.textMuted, textAlign: 'center', maxWidth: 320 }]}>
              1:1 video over WebRTC. End-to-end peer-to-peer.
              {!webrtc && '\n\n⚠ Build a dev-client for full video.'}
            </Text>
            <Button label="Ring them" onPress={startCall} fullWidth />
            <Pressable onPress={() => router.back()}><Text style={{ color: palette.textFaint }}>cancel</Text></Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (state === 'ringing-in') {
    return (
      <View style={{ flex: 1 }}>
        <AuroraBackdrop intensity={1.4} />
        <SafeAreaView style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: spacing.xl }}>
            <Text style={[typography.micro, { color: palette.textMuted, letterSpacing: 2 }]}>INCOMING</Text>
            <LinearGradient
              colors={[palette.primary, palette.accent]}
              style={{ width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 76 }}>💗</Text>
            </LinearGradient>
            <Text style={[typography.h1, { color: palette.text }]}>your partner</Text>
            <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl }}>
              <Pressable
                onPress={rejectCall}
                style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.danger, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 30 }}>✕</Text>
              </Pressable>
              <Pressable
                onPress={acceptCall}
                style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: palette.success, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 30 }}>📞</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Remote stream fills the screen */}
      {remoteStream && RTCView ? (
        <RTCView streamURL={remoteStream.toURL?.()} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.text, fontSize: 18 }}>
            {state === 'ringing-out' ? 'Ringing…' :
             state === 'connecting' ? 'Connecting…' :
             state === 'connected' ? '🟢 in call' : 'Ended'}
          </Text>
        </View>
      )}

      {/* Local PiP */}
      {localStream && RTCView && (
        <View style={{
          position: 'absolute', top: 60, right: 16,
          width: 120, height: 160, borderRadius: 16, overflow: 'hidden',
          borderWidth: 2, borderColor: palette.primary,
        }}>
          <RTCView streamURL={localStream.toURL?.()} style={{ flex: 1 }} mirror objectFit="cover" />
        </View>
      )}

      {/* Bottom controls */}
      <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          {state === 'connected' && (
            <Text style={{ color: 'white', fontWeight: '700' }}>
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <Pressable
              onPress={() => {
                setMuted((m) => {
                  const nv = !m;
                  localStream?.getAudioTracks?.().forEach((t: any) => (t.enabled = !nv));
                  return nv;
                });
              }}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: muted ? palette.danger : palette.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22 }}>{muted ? '🔇' : '🎤'}</Text>
            </Pressable>
            <Pressable
              onPress={endCall}
              style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: palette.danger, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 28 }}>✕</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCameraOn((c) => {
                  const nv = !c;
                  localStream?.getVideoTracks?.().forEach((t: any) => (t.enabled = nv));
                  return nv;
                });
              }}
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: !cameraOn ? palette.danger : palette.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 22 }}>{cameraOn ? '📹' : '📷'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
