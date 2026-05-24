import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { registerForPushAsync, addResponseListener } from '@/services/pushNotifications';
import { startPhoneStatus, stopPhoneStatus } from '@/services/phoneStatus';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, couple, hydrated, user } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!session && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (session && !couple && !inOnboarding) {
      router.replace('/(onboarding)/pair');
    } else if (session && couple && (inAuth || inOnboarding)) {
      router.replace('/(tabs)/home');
    }
  }, [session, couple, segments, hydrated, router]);

  // Register push tokens once the user is authed.
  useEffect(() => {
    if (!user) return;
    void registerForPushAsync(user.id).catch(() => {});
  }, [user?.id]);

  // Start broadcasting phone status (battery, screen, online) to the partner.
  useEffect(() => {
    if (!session || !couple) return;
    startPhoneStatus();
    return () => stopPhoneStatus();
  }, [session?.user.id, couple?.id]);

  // Deep-link from notification taps. Messages → chat, SOS → map, capsule → capsules.
  useEffect(() => {
    const off = addResponseListener((r) => {
      const data = r.notification.request.content.data as { type?: string } | undefined;
      switch (data?.type) {
        case 'message':
          router.push('/(tabs)/chat');
          break;
        case 'sos':
          router.push('/(tabs)/map');
          break;
        case 'capsule':
          router.push('/capsules');
          break;
        case 'memory':
          router.push('/(tabs)/memories');
          break;
        case 'event':
          router.push('/planner');
          break;
        case 'instant':
          router.push('/instants');
          break;
        case 'call':
          router.push('/call');
          break;
        default:
          break;
      }
    });
    return off;
  }, [router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                  animation: 'fade',
                }}
              />
            </AuthGate>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
