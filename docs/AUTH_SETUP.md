# Auth setup

SoulSync ships with email/password + magic-link working out of the box, and stub buttons for Google/Apple. Here's how to wire the rest.

## Email + magic link (already working)

No setup needed beyond a Supabase project. Magic links go to `soulsync://auth/callback` — make sure that scheme is registered in `apps/mobile/app.json`.

## Google sign-in

1. In the Supabase dashboard: **Auth → Providers → Google → enable**.
2. Set up an OAuth client in [Google Cloud Console](https://console.cloud.google.com):
   - Application type: **Web application**
   - Authorized redirect URIs: `https://<your-project>.supabase.co/auth/v1/callback`
3. Copy the client ID + secret into Supabase.
4. In the mobile app, replace the `continueWithGoogle` stub in `app/(auth)/sign-in.tsx`:

```ts
import * as AuthSession from 'expo-auth-session';

async function continueWithGoogle() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'soulsync' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUri, skipBrowserRedirect: true },
  });
  if (data?.url) await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
}
```

## Apple sign-in (iOS only)

1. In Apple Developer: enable **Sign in with Apple** for your bundle ID.
2. In Supabase: **Auth → Providers → Apple → enable**, paste your Apple service ID, team ID, key ID, and private key.
3. Mobile usage:

```ts
import * as AppleAuthentication from 'expo-apple-authentication';

async function continueWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) return;
  await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
}
```

You'll need to add `expo-apple-authentication` (`pnpm --filter @soulsync/mobile add expo-apple-authentication`) and `expo-web-browser` for the Google flow.

## Profile + key bootstrap

Once a user signs in:

1. The `on_auth_user_created` trigger creates a row in `public.profiles` (default display name = email prefix).
2. `authStore` calls `bootstrapKeys(userId)` — generates a Curve25519 keypair if one doesn't exist, uploads the public half to `profiles.public_key`, and (if paired) caches the partner's public key.
3. `registerForPushAsync(userId)` from `_layout.tsx` requests push permission and saves the Expo token to `device_sessions`.

You don't need to wire any of this — it's automatic.
