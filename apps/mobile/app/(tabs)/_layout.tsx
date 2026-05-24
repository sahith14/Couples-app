import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme/ThemeProvider';

const Icon = ({ glyph, focused, color }: { glyph: string; focused: boolean; color: string }) => (
  <Text style={{ fontSize: focused ? 26 : 22, color }}>{glyph}</Text>
);

export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          height: 78,
        },
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={70}
            style={{ flex: 1, borderTopWidth: 1, borderTopColor: palette.border }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused, color }) => <Icon glyph="✦" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused, color }) => <Icon glyph="✉" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="memories"
        options={{
          tabBarIcon: ({ focused, color }) => <Icon glyph="◇" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused, color }) => <Icon glyph="◎" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused, color }) => <Icon glyph="❤" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
