import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { LocationLatest } from '@soulsync/shared';
import {
  startBackgroundLocation,
  stopBackgroundLocation,
  fireSOS,
  callEmergencyServices,
  BG_LOCATION_TASK,
} from '@/services/location';

interface Coord { latitude: number; longitude: number }

export default function MapTab() {
  const { palette, typography, spacing, radii } = useTheme();
  const { profile, couple, refreshProfile } = useAuthStore();
  const [me, setMe] = useState<Coord | null>(null);
  const [partner, setPartner] = useState<(LocationLatest & { coord: Coord }) | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    (async () => {
      const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
      setSharing(running);
    })();
  }, []);

  async function startSharing() {
    if (!couple || !profile) return;
    const ok = await startBackgroundLocation(profile.id, couple.id);
    if (!ok) {
      Alert.alert(
        'Permission denied',
        'Background location is needed for safe-arrival and ETA. You can still share in foreground.',
      );
    }
    setSharing(true);
    // Push my current position immediately so the partner sees something fast.
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMe(c);
      await supabase.from('location_pings').insert({
        user_id: profile.id,
        couple_id: couple.id,
        point: `SRID=4326;POINT(${c.longitude} ${c.latitude})`,
        accuracy_m: pos.coords.accuracy,
        speed_mps: pos.coords.speed,
        heading_deg: pos.coords.heading,
      });
    } catch {}
  }

  async function stopSharing() {
    await stopBackgroundLocation();
    setSharing(false);
  }

  async function loadPartner() {
    if (!couple || !profile) return;
    const partnerId = couple.user_a === profile.id ? couple.user_b : couple.user_a;
    const { data } = await supabase
      .from('location_latest')
      .select('*')
      .eq('user_id', partnerId)
      .maybeSingle();
    if (!data) return setPartner(null);
    const ll = data as LocationLatest;
    const [lng, lat] = ll.point.coordinates;
    setPartner({ ...ll, coord: { latitude: lat, longitude: lng } });
  }

  useEffect(() => {
    void loadPartner();
    const sub = supabase
      .channel('loc-latest')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_latest' }, () =>
        loadPartner(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(sub);
    };
  }, [couple?.id, profile?.id]);

  async function toggleGhost() {
    if (!profile) return;
    const next = !profile.ghost_mode;
    await supabase.from('profiles').update({ ghost_mode: next }).eq('id', profile.id);
    await refreshProfile();
  }

  async function handleSOS() {
    if (!profile || !couple) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      '🚨 Send SOS?',
      'Your partner will get a high-priority alert with your live location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 911',
          style: 'destructive',
          onPress: () => callEmergencyServices(),
        },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            await fireSOS({ userId: profile.id, coupleId: couple.id, message: 'Need you' });
            Alert.alert('Sent', 'Partner notified with your location.');
          },
        },
      ],
    );
  }

  const initial = me ?? partner?.coord ?? { latitude: 37.7749, longitude: -122.4194 };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation
        initialRegion={{ ...initial, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {partner && (
          <Marker coordinate={partner.coord} title="Partner" pinColor={palette.primary} />
        )}
        {me && <Marker coordinate={me} title="You" pinColor={palette.accent} />}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
        <View style={{ padding: spacing.lg }}>
          <GlassCard>
            <Text style={[typography.h3, { color: palette.text }]}>Live location</Text>
            <Text style={[typography.micro, { color: palette.textFaint, marginTop: 4 }]}>
              {profile?.ghost_mode
                ? "👻 Ghost mode on — partner can't see you."
                : sharing
                  ? '🟢 Sharing in background.'
                  : 'Tap below to share with your partner.'}
              {partner ? ` · 🔋 ${partner.battery_pct ?? '?'}%` : ''}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {!sharing ? (
                <Button label="Start sharing" onPress={startSharing} />
              ) : (
                <Button label="Stop sharing" variant="ghost" onPress={stopSharing} />
              )}
              <Button
                label={profile?.ghost_mode ? 'Disable ghost' : 'Ghost mode'}
                variant="ghost"
                onPress={toggleGhost}
              />
            </View>
          </GlassCard>
        </View>
      </SafeAreaView>

      {/* SOS */}
      <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', right: 0, bottom: 100 }}>
        <View style={{ padding: spacing.lg }}>
          <Pressable
            onPress={handleSOS}
            style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: palette.danger,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: palette.danger,
              shadowOpacity: 0.6,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
              elevation: 12,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>SOS</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
