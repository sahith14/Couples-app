/**
 * Phone status sharing.
 *
 * Each device upserts its own row in `phone_status` so the partner sees:
 *   - battery % + charging state
 *   - DND / silent
 *   - which screen of the app they're on (or "in another app")
 *   - online_at timestamp (so we can show "active 2m ago")
 *
 * Triggered:
 *   - Every PHONE_STATUS_INTERVAL_MS while the app is foregrounded
 *   - On AppState transitions (active → background / background → active)
 *   - On every screen focus (current_screen)
 *
 * Same RLS rule that gates location respects ghost mode — flipping ghost on
 * makes phone_status invisible to the partner without needing extra logic.
 */
import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { PHONE_STATUS_INTERVAL_MS } from '@soulsync/shared';

// expo-battery is optional — we degrade if not linked.
type BatteryModule = {
  getBatteryLevelAsync(): Promise<number>;
  getBatteryStateAsync(): Promise<number>;
  BatteryState: { CHARGING: number; FULL: number; UNPLUGGED: number };
};
let Battery: BatteryModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Battery = require('expo-battery') as BatteryModule;
} catch { Battery = null; }

let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let currentScreen: string | null = null;
let started = false;

async function pushStatus(active: boolean): Promise<void> {
  let battery: number | null = null;
  let charging: boolean | null = null;
  if (Battery) {
    try {
      const lvl = await Battery.getBatteryLevelAsync();
      battery = Math.round(lvl * 100);
      const s = await Battery.getBatteryStateAsync();
      charging = s === Battery.BatteryState.CHARGING || s === Battery.BatteryState.FULL;
    } catch {}
  }
  // DND detection: the cross-platform answer is "you can't read system DND
  // without elevated permissions". On iOS the focus-mode is private; on
  // Android it requires NotificationListenerService. We expose the field on
  // the table so users can flip it manually from the Profile screen later.
  const dnd: boolean | null = null;
  const focus: string | null = null;

  await supabase.rpc('touch_phone_status', {
    p_battery: battery,
    p_charging: charging,
    p_dnd: dnd,
    p_focus: focus,
    p_screen: currentScreen,
    p_active: active,
  });
}

function onAppStateChange(s: AppStateStatus) {
  void pushStatus(s === 'active');
  if (s === 'active' && !timer) {
    timer = setInterval(() => void pushStatus(true), PHONE_STATUS_INTERVAL_MS);
  } else if (s !== 'active' && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function startPhoneStatus(): void {
  if (started) return;
  started = true;
  void pushStatus(AppState.currentState === 'active');
  if (AppState.currentState === 'active') {
    timer = setInterval(() => void pushStatus(true), PHONE_STATUS_INTERVAL_MS);
  }
  appStateSub = AppState.addEventListener('change', onAppStateChange);
}

export function stopPhoneStatus(): void {
  if (timer) clearInterval(timer);
  timer = null;
  appStateSub?.remove();
  appStateSub = null;
  started = false;
}

/** Hook this from useFocusEffect in any tab/screen so partner sees where you are. */
export function setCurrentScreen(name: string | null): void {
  currentScreen = name;
  if (started) void pushStatus(AppState.currentState === 'active');
}

/** User-toggled DND override (manual). Independent of system DND. */
export async function setManualDnd(dnd: boolean): Promise<void> {
  await supabase.rpc('touch_phone_status', {
    p_battery: null,
    p_charging: null,
    p_dnd: dnd,
    p_focus: null,
    p_screen: currentScreen,
    p_active: AppState.currentState === 'active',
  });
}
