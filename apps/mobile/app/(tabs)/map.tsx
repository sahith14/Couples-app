import React, { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { LocationLatest } from '@soulsync/shared';

interface Coord { latitude: number; longitude: number }

export default function MapTab() {
  const { palette, typography, spacing } = useTheme();
  const { profile, couple, refreshProfile } = useAuthStore();
  const [me, setMe] = useState<Coord | null>(null);
  const [partner, setPartner] = useState<(LocationLatest & { coord: Coord }) | null>(null);
  const [sharing, setSharing] = useState(false);

  async function startSharing() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied');
    setSharing(true);
    const watcher = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 50 },
      async (pos) => {
        if (!couple || !profile) return;
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
      },
    );
    return () => watcher.remove();
  }

  async function loadPartner() {
    if (!couple || !profile) return;
    const partnerId = couple.user_a === profile.id ? couple.user_b : couple.user_a;
    const { data } = await supabase
      .from('location_latest')
      .select('*')
      .eq('user_id', partnerId)
      .maybeSingle();
    if (!data) return;
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
              {profile?.ghost_mode ? '👻 Ghost mode on — partner can\'t see you.' : 'Partner can see your latest position.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {!sharing && <Button label="Start sharing" onPress={startSharing} />}
              <Button label={profile?.ghost_mode ? 'Disable ghost' : 'Ghost mode'} variant="ghost" onPress={toggleGhost} />
            </View>
          </GlassCard>
        </View>
      </SafeAreaView>
    </View>
  );
}
