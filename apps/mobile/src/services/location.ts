/**
 * Location service: foreground watcher, background task, and SOS dispatch.
 *
 * Background task: registered with TaskManager + startLocationUpdatesAsync.
 * The OS wakes us roughly every `distanceInterval` meters when the user is
 * moving, batches the points, and we flush them into `location_pings`.
 * The DB trigger keeps `location_latest` fresh for the partner.
 *
 * SOS: writes a row to `sos_events` and (via the partner's push token) the
 * Edge Function `sos-fanout` (TODO) sends a high-priority push.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { LOCATION_PING_BG_DISTANCE_M } from '@soulsync/shared';

// expo-battery is optional — if the module isn't linked yet (older dev clients)
// we degrade gracefully and just send pings without battery data.
type BatteryModule = {
  getBatteryLevelAsync(): Promise<number>;
  getBatteryStateAsync(): Promise<number>;
  BatteryState: { CHARGING: number; FULL: number };
};
let Battery: BatteryModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Battery = require('expo-battery') as BatteryModule;
} catch {
  Battery = null;
}

export const BG_LOCATION_TASK = 'soulsync-bg-location';

interface LocationPayload {
  locations: Location.LocationObject[];
}

// Module-level cache of context. Not perfect (cold-start can lose it), but
// for SoulSync's MVP we re-hydrate via supabase.auth.getSession() inside the
// task runner.
let cachedCoupleId: string | null = null;
let cachedUserId: string | null = null;

export function setLocationContext(userId: string, coupleId: string) {
  cachedUserId = userId;
  cachedCoupleId = coupleId;
}

TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationPayload>) => {
  if (error) return;
  const locs = data?.locations ?? [];
  if (locs.length === 0) return;

  // Fall back to session if the cache was lost.
  let userId = cachedUserId;
  let coupleId = cachedCoupleId;
  if (!userId || !coupleId) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    userId = s.session.user.id;
    const { data: c } = await supabase
      .from('couples')
      .select('id')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .limit(1)
      .maybeSingle();
    if (!c) return;
    coupleId = c.id;
    setLocationContext(userId, coupleId!);
  }

  let battery: number | null = null;
  let charging: boolean | null = null;
  if (Battery) {
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      battery = Math.round(lvl * 100);
      const state = await Battery.getBatteryStateAsync();
      charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
    } catch {}
  }

  const rows = locs.map((l) => ({
    user_id: userId!,
    couple_id: coupleId!,
    point: `SRID=4326;POINT(${l.coords.longitude} ${l.coords.latitude})`,
    accuracy_m: l.coords.accuracy,
    speed_mps: l.coords.speed,
    heading_deg: l.coords.heading,
    altitude_m: l.coords.altitude,
    battery_pct: battery,
    is_charging: charging,
    is_moving: (l.coords.speed ?? 0) > 0.5,
  }));

  await supabase.from('location_pings').insert(rows);
});

export async function startBackgroundLocation(userId: string, coupleId: string): Promise<boolean> {
  setLocationContext(userId, coupleId);

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;

  if (Platform.OS !== 'web') {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      // Foreground-only fallback is still useful — we just won't auto-update
      // when the app is backgrounded. Caller decides what to do.
      return false;
    }
  }

  const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (already) return true;

  await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: LOCATION_PING_BG_DISTANCE_M,
    deferredUpdatesInterval: 30_000,
    foregroundService: {
      notificationTitle: 'SoulSync · location shared',
      notificationBody: 'Your partner can see where you are.',
      notificationColor: '#FF5C8A',
    },
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.OtherNavigation,
  });
  return true;
}

export async function stopBackgroundLocation(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
}

export async function fireSOS(opts: {
  userId: string;
  coupleId: string;
  message?: string;
}): Promise<void> {
  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch {}

  await supabase.from('sos_events').insert({
    user_id: opts.userId,
    couple_id: opts.coupleId,
    point: lat != null && lng != null ? `SRID=4326;POINT(${lng} ${lat})` : null,
    message: opts.message ?? null,
  });
}

/** Convenience: open the dialer to emergency services. */
export function callEmergencyServices(numbers: string[] = ['911']): void {
  const num = numbers[0]!;
  void Linking.openURL(`tel:${num}`);
}
