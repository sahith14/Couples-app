import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { AuroraBackdrop } from '@/ui/AuroraBackdrop';
import { GlassCard } from '@/ui/GlassCard';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { CalendarEvent } from '@soulsync/shared';
import { scheduleLocal } from '@/services/pushNotifications';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface DayCell { date: Date; in: boolean; events: CalendarEvent[] }

function buildMonthGrid(anchor: Date, events: CalendarEvent[]): DayCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startDay = first.getDay();
  const start = new Date(first); start.setDate(first.getDate() - startDay);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dayEvents = events.filter((e) => sameDay(new Date(e.starts_at), d));
    cells.push({ date: d, in: d.getMonth() === anchor.getMonth(), events: dayEvents });
  }
  return cells;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Planner() {
  const router = useRouter();
  const { palette, typography, spacing, radii } = useTheme();
  const { couple, profile } = useAuthStore();
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<Date | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const grid = useMemo(() => buildMonthGrid(anchor, events), [anchor, events]);

  async function load() {
    if (!couple) return;
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('couple_id', couple.id)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at');
    setEvents((data ?? []) as CalendarEvent[]);
  }

  useEffect(() => { void load(); }, [couple?.id, anchor.getMonth(), anchor.getFullYear()]);

  const monthName = anchor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const upcoming = events
    .filter((e) => new Date(e.starts_at) >= new Date())
    .slice(0, 5);

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackdrop intensity={0.5} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: palette.text, fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={[typography.h2, { color: palette.text }]}>Date planner</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
          {/* Month nav */}
          <GlassCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>
                <Text style={{ color: palette.text, fontSize: 24, paddingHorizontal: 8 }}>‹</Text>
              </Pressable>
              <Text style={[typography.h3, { color: palette.text }]}>{monthName}</Text>
              <Pressable onPress={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>
                <Text style={{ color: palette.text, fontSize: 24, paddingHorizontal: 8 }}>›</Text>
              </Pressable>
            </View>

            {/* Day labels */}
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              {DAYS.map((d, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', color: palette.textMuted, fontSize: 11 }}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
              {grid.map((cell, i) => {
                const isToday = sameDay(cell.date, new Date());
                const isSelected = selected && sameDay(cell.date, selected);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelected(cell.date)}
                    style={{
                      width: `${100 / 7}%`,
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 2,
                    }}
                  >
                    <View
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: radii.md,
                        backgroundColor: isSelected ? palette.primary : 'transparent',
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: palette.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected
                            ? palette.primaryOn
                            : cell.in
                              ? palette.text
                              : palette.textFaint,
                          fontWeight: isToday ? '700' : '500',
                        }}
                      >
                        {cell.date.getDate()}
                      </Text>
                      {cell.events.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                          {cell.events.slice(0, 3).map((_e, idx) => (
                            <View
                              key={idx}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: isSelected ? palette.primaryOn : palette.accent,
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          {/* Selected day events */}
          {selected && (
            <GlassCard>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.h3, { color: palette.text }]}>
                  {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </Text>
                <Button label="+ Plan" onPress={() => setShowCreate(true)} />
              </View>
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {events
                  .filter((e) => sameDay(new Date(e.starts_at), selected))
                  .map((e) => (
                    <EventRow key={e.id} event={e} palette={palette} mineId={profile?.id} />
                  ))}
                {events.filter((e) => sameDay(new Date(e.starts_at), selected)).length === 0 && (
                  <Text style={[typography.body, { color: palette.textMuted }]}>
                    Nothing planned. Plan something tiny — coffee, a walk, a phone call.
                  </Text>
                )}
              </View>
            </GlassCard>
          )}

          {/* Upcoming list */}
          <GlassCard>
            <Text style={[typography.h3, { color: palette.text }]}>Upcoming</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {upcoming.length === 0 && (
                <Text style={[typography.body, { color: palette.textMuted }]}>
                  No upcoming dates. Tap a day to plan one.
                </Text>
              )}
              {upcoming.map((e) => (
                <EventRow key={e.id} event={e} palette={palette} mineId={profile?.id} />
              ))}
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>

      <CreateEventModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async () => {
          setShowCreate(false);
          await load();
        }}
        defaultDate={selected ?? new Date()}
      />
    </View>
  );
}

function EventRow({
  event,
  palette,
  mineId,
}: {
  event: CalendarEvent;
  palette: ReturnType<typeof useTheme>['palette'];
  mineId?: string;
}) {
  const surprise = event.surprise_for && event.surprise_for !== mineId && event.created_by === mineId;
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ color: palette.text, fontWeight: '600' }}>
        {surprise ? '🎁 ' : ''}{event.title}
      </Text>
      <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
        {new Date(event.starts_at).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })}
        {event.location ? ` · ${event.location}` : ''}
      </Text>
      {event.description && (
        <Text style={{ color: palette.textMuted, fontSize: 13, marginTop: 4 }}>{event.description}</Text>
      )}
    </View>
  );
}

function CreateEventModal({
  visible,
  onClose,
  onCreated,
  defaultDate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  defaultDate: Date;
}) {
  const { palette, typography, spacing } = useTheme();
  const { couple, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [hour, setHour] = useState('19');
  const [minute, setMinute] = useState('00');
  const [surprise, setSurprise] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(''); setLocation(''); setHour('19'); setMinute('00'); setSurprise(false);
    }
  }, [visible]);

  async function save() {
    if (!couple || !profile) return;
    if (!title.trim()) return Alert.alert('Title required');
    setSaving(true);
    try {
      const starts = new Date(defaultDate);
      starts.setHours(parseInt(hour) || 19, parseInt(minute) || 0, 0, 0);
      const partnerId = couple.user_a === profile.id ? couple.user_b : couple.user_a;
      const { data, error } = await supabase
        .from('events')
        .insert({
          couple_id: couple.id,
          created_by: profile.id,
          title: title.trim(),
          location: location.trim() || null,
          starts_at: starts.toISOString(),
          surprise_for: surprise ? partnerId : null,
          reminder_at: new Date(starts.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      // Fire local reminder 2h before.
      void scheduleLocal(
        `Date soon: ${title.trim()}`,
        location ? `at ${location}` : 'see you there',
        new Date(starts.getTime() - 2 * 60 * 60 * 1000),
        'planner',
      );
      // Award plan-a-date quest XP.
      void supabase.rpc('complete_quest', { p_couple: couple.id, p_code: 'plan_a_date' });
      await onCreated();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <View style={{ backgroundColor: palette.surfaceStrong, padding: spacing.xl, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
          New plan · {defaultDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
        <View style={{ gap: spacing.md }}>
          <TextField label="Title" placeholder="Sushi date" value={title} onChangeText={setTitle} />
          <TextField label="Location (optional)" placeholder="Akiko's" value={location} onChangeText={setLocation} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Hour" keyboardType="number-pad" value={hour} onChangeText={setHour} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Minute" keyboardType="number-pad" value={minute} onChangeText={setMinute} />
            </View>
          </View>
          <Pressable
            onPress={() => setSurprise((v) => !v)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              padding: 12, borderRadius: 12,
              backgroundColor: surprise ? palette.primary : palette.surface,
              borderWidth: 1, borderColor: palette.border,
            }}
          >
            <Text style={{ fontSize: 18 }}>🎁</Text>
            <Text style={{ color: surprise ? palette.primaryOn : palette.text, fontWeight: '600' }}>
              Surprise — hide from partner until the date
            </Text>
          </Pressable>
          <Button label="Save plan" onPress={save} loading={saving} fullWidth />
          <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
        </View>
      </View>
    </Modal>
  );
}
