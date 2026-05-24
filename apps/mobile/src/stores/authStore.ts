import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Couple, Profile } from '@soulsync/shared';
import { supabase } from '@/services/supabase';
import { bootstrapKeys, syncPartnerPublicKey } from '@/services/keys';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  couple: Couple | null;
  loading: boolean;
  hydrated: boolean;
  setSession: (session: Session | null) => void;
  refreshProfile: () => Promise<void>;
  refreshCouple: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  couple: null,
  loading: true,
  hydrated: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
    if (session) {
      // E2E key sync runs alongside profile/couple — fire-and-forget so we
      // don't block the UI, but errors are non-fatal and surface in dev console.
      void bootstrapKeys(session.user.id).catch((e) =>
        // eslint-disable-next-line no-console
        console.warn('[auth] key bootstrap failed', e),
      );
      void get().refreshProfile();
      void get().refreshCouple();
    } else {
      set({ profile: null, couple: null });
    }
  },

  refreshProfile: async () => {
    const userId = get().user?.id;
    if (!userId) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!error && data) set({ profile: data as Profile });
  },

  refreshCouple: async () => {
    const userId = get().user?.id;
    if (!userId) return set({ couple: null });
    const { data, error } = await supabase
      .from('couples')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) {
      const couple = (data as Couple) ?? null;
      set({ couple });
      // Now that we know the partner, refresh their public key for E2E.
      if (couple) void syncPartnerPublicKey();
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, couple: null });
  },
}));

// Wire to Supabase events at module-load time.
supabase.auth.getSession().then(({ data }) => {
  useAuthStore.setState({
    session: data.session,
    user: data.session?.user ?? null,
    loading: false,
    hydrated: true,
  });
  if (data.session) {
    void bootstrapKeys(data.session.user.id).catch(() => {});
    void useAuthStore.getState().refreshProfile();
    void useAuthStore.getState().refreshCouple();
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session);
});
