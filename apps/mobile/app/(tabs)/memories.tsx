import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Dimensions, Pressable, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { Button } from '@/ui/Button';
import { GlassCard } from '@/ui/GlassCard';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { Memory } from '@soulsync/shared';

const NUM_COLS = 3;
const GAP = 4;
const SIZE = (Dimensions.get('window').width - 16 * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

export default function Memories() {
  const { palette, typography, spacing } = useTheme();
  const { couple, profile } = useAuthStore();
  const [items, setItems] = useState<(Memory & { signedUrl?: string })[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (!couple) return;
    const { data } = await supabase
      .from('memories')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
      .limit(120);
    const list = (data ?? []) as Memory[];
    // Sign URLs in batches
    const signed = await Promise.all(
      list.map(async (m) => {
        const { data: s } = await supabase.storage.from('memories').createSignedUrl(m.storage_path, 3600);
        return { ...m, signedUrl: s?.signedUrl };
      }),
    );
    setItems(signed);
  }

  useEffect(() => {
    void load();
  }, [couple?.id]);

  async function pickAndUpload() {
    if (!couple || !profile) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to upload memories.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        // Compress for low-bandwidth + storage savings
        const compressed = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1920 } }],
          { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
        );
        const bytes = await FileSystem.readAsStringAsync(compressed.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const buffer = decode(bytes);
        const path = `${couple.id}/${profile.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('memories')
          .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        await supabase.from('memories').insert({
          couple_id: couple.id,
          author_id: profile.id,
          kind: 'photo',
          storage_path: path,
          width: compressed.width,
          height: compressed.height,
          bytes: buffer.byteLength,
        });
      }
      await load();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.6} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={[typography.h2, { color: palette.text }]}>Memory vault</Text>
          <Text style={[typography.micro, { color: palette.textFaint }]}>
            Private to the two of you. Auto-compressed before upload.
          </Text>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <Button label={uploading ? 'Uploading…' : '＋ Add photos'} onPress={pickAndUpload} loading={uploading} />
        </View>

        {items.length === 0 ? (
          <View style={{ padding: spacing.lg }}>
            <GlassCard>
              <Text style={[typography.h3, { color: palette.text }]}>Your vault is empty</Text>
              <Text style={[typography.body, { color: palette.textMuted, marginTop: 4 }]}>
                Add the first photo to start your timeline together.
              </Text>
            </GlassCard>
          </View>
        ) : (
          <FlatList
            data={items}
            numColumns={NUM_COLS}
            keyExtractor={(m) => m.id}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={{ padding: spacing.lg, gap: GAP, paddingBottom: 120 }}
            renderItem={({ item }) => (
              <Pressable>
                <Image
                  source={{ uri: item.signedUrl }}
                  contentFit="cover"
                  transition={200}
                  style={{ width: SIZE, height: SIZE, borderRadius: 8, backgroundColor: palette.surface }}
                />
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// Tiny base64 -> Uint8Array. React Native ships atob in modern runtimes.
function decode(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
