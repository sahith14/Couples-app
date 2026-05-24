/// <reference types="expo/types" />

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_REVENUECAT_IOS?: string;
    EXPO_PUBLIC_REVENUECAT_ANDROID?: string;
    EXPO_PUBLIC_GOOGLE_MAPS_KEY?: string;
    [key: string]: string | undefined;
  };
};
