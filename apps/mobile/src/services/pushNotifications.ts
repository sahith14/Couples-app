/**
 * Push notifications.
 *
 * On native: registers an Expo Push token, persists it in `device_sessions`,
 * and configures the foreground handler so messages and SOS pings show
 * banners + play a soft chime.
 *
 * Web: silently no-ops (Expo push needs a service worker + VAPID keys; we
 * fall back to in-app realtime only).
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';

let registered = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushChannel = 'messages' | 'sos' | 'memories' | 'capsules' | 'planner';

const CHANNELS: { id: PushChannel; name: string; importance: Notifications.AndroidImportance }[] = [
  { id: 'messages',  name: 'Messages',     importance: Notifications.AndroidImportance.HIGH },
  { id: 'sos',       name: 'Emergency',    importance: Notifications.AndroidImportance.MAX },
  { id: 'memories',  name: 'Memories',     importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'capsules',  name: 'Time capsules',importance: Notifications.AndroidImportance.HIGH },
  { id: 'planner',   name: 'Date planner', importance: Notifications.AndroidImportance.DEFAULT },
];

export async function registerForPushAsync(userId: string): Promise<string | null> {
  if (registered) return null;
  if (!Device.isDevice) return null;
  if (Platform.OS === 'web') return null;

  // Configure Android channels first — required before token request on Android 13+.
  if (Platform.OS === 'android') {
    for (const ch of CHANNELS) {
      await Notifications.setNotificationChannelAsync(ch.id, {
        name: ch.name,
        importance: ch.importance,
        sound: ch.id === 'sos' ? 'default' : undefined,
        vibrationPattern: ch.id === 'sos' ? [0, 200, 100, 200, 100, 200] : [0, 120, 60, 120],
        lightColor: '#FF5C8A',
      });
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  const tokenRes = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenRes.data;
  if (!token) return null;

  await supabase.from('device_sessions').upsert(
    {
      user_id: userId,
      expo_token: token,
      platform: Platform.OS as 'ios' | 'android' | 'web',
      device_name:
        (Device.deviceName ?? Device.modelName ?? `${Platform.OS} device`).slice(0, 80),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_token' },
  );

  // Mirror onto the profile so the (forthcoming) Edge Functions can fan out
  // pushes without needing to query device_sessions for the latest token.
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);

  registered = true;
  return token;
}

export function addReceivedListener(
  cb: (n: Notifications.Notification) => void,
): () => void {
  const sub = Notifications.addNotificationReceivedListener(cb);
  return () => sub.remove();
}

export function addResponseListener(
  cb: (r: Notifications.NotificationResponse) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(cb);
  return () => sub.remove();
}

/** Schedule a local-only reminder (planner / capsule unlock countdown / quest). */
export async function scheduleLocal(
  title: string,
  body: string,
  fireAt: Date,
  channelId: PushChannel = 'planner',
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (fireAt.getTime() <= Date.now() + 1000) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, categoryIdentifier: channelId },
    // expo-notifications 0.28 takes a Date directly; newer versions use a
    // tagged union via SchedulableTriggerInputTypes. Both accept this shape.
    trigger: fireAt as any,
  });
}
