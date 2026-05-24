import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { session, couple, hydrated } = useAuthStore();
  if (!hydrated) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!couple) return <Redirect href="/(onboarding)/pair" />;
  return <Redirect href="/(tabs)/home" />;
}
