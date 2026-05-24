/**
 * Video call signaling.
 *
 * SoulSync uses a tiny Supabase Realtime broadcast channel as the signaling
 * layer for 1:1 WebRTC. We don't run our own SFU — the connection is
 * peer-to-peer with a free Google STUN server. For most home Wi-Fi <-> mobile
 * data scenarios that's enough; for symmetric NAT we'd need TURN (paid).
 *
 * The peer connection itself uses `react-native-webrtc`. To avoid forcing a
 * native module install before this code can be type-checked, we lazy-require
 * it and gracefully degrade in Expo Go (no video, signaling still works so
 * you can tell when the partner is calling).
 *
 * Flow:
 *   caller    callee
 *     │ ring  │   type: 'ring'
 *     ├──────▶│
 *     │ accept│   type: 'accept'
 *     │◀──────┤
 *     │ offer │   type: 'sdp', sdp: {...}
 *     ├──────▶│
 *     │answer │   type: 'sdp', sdp: {...}
 *     │◀──────┤
 *     │  ice  │   type: 'ice', candidate: {...}
 *     │◀─────▶│
 *     │  bye  │   type: 'bye'
 */
import { supabase } from '@/services/supabase';

export type SignalEvent =
  | { type: 'ring';   from: string }
  | { type: 'accept'; from: string }
  | { type: 'reject'; from: string }
  | { type: 'sdp';    from: string; sdp: any }
  | { type: 'ice';    from: string; candidate: any }
  | { type: 'bye';    from: string };

export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface CallChannel {
  send: (e: SignalEvent) => void;
  close: () => void;
}

export function openCallChannel(
  coupleId: string,
  myUserId: string,
  onEvent: (e: SignalEvent) => void,
): CallChannel {
  const ch = supabase.channel(`call:${coupleId}`, {
    config: { broadcast: { self: false } },
  });
  ch.on('broadcast', { event: 'signal' }, ({ payload }) => {
    const ev = payload as SignalEvent;
    if (ev.from === myUserId) return;
    onEvent(ev);
  });
  ch.subscribe();
  return {
    send: (e) => void ch.send({ type: 'broadcast', event: 'signal', payload: e }),
    close: () => { void ch.unsubscribe(); void supabase.removeChannel(ch); },
  };
}

/**
 * Lazy-load react-native-webrtc. If the user is running in Expo Go or hasn't
 * installed the native module yet, we return null and the call screen shows
 * a "build needed" message instead of crashing.
 */
export interface WebRTCModule {
  RTCPeerConnection: any;
  RTCSessionDescription: any;
  RTCIceCandidate: any;
  mediaDevices: { getUserMedia: (c: any) => Promise<any> };
  RTCView: any;
}

export function loadWebRTC(): WebRTCModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-webrtc') as WebRTCModule;
  } catch {
    return null;
  }
}
