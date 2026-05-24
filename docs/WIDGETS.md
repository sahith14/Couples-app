# Native widgets — iOS WidgetKit + Android Glance

SoulSync's lockscreen / home-screen widgets show: partner's mood, online status, battery, the latest Instant, and the streak counter. They refresh every ~15 minutes (iOS) or on data change (Android).

## What's already done in this repo

- ✅ `widget_payload` Postgres view returning everything the widget needs in one query (per RLS-authenticated user)
- ✅ `supabase/functions/widget-payload` Edge Function — single GET endpoint the widget calls
- ✅ `SOULSYNC.widgetGroupId = 'group.app.soulsync.widget'` constant for the App Group / SharedPreferences shared between the app and the widget extension
- ✅ `PREMIUM_GATES.{tier}.widgets: boolean` for tier-gating

## What you need to do (one-time native setup)

This work is **not pure JS** — it needs Xcode (iOS) and Android Studio (Android). Once set up, it never has to change again.

### iOS (WidgetKit)

1. **Install the config plugin**
   ```sh
   pnpm --filter @soulsync/mobile add @bacons/apple-targets
   ```

2. **Add the widget target to `apps/mobile/app.json`**
   ```jsonc
   {
     "expo": {
       "plugins": [
         [
           "@bacons/apple-targets",
           {
             "appGroups": ["group.app.soulsync.widget"]
           }
         ]
       ],
       "ios": {
         "entitlements": {
           "com.apple.security.application-groups": ["group.app.soulsync.widget"]
         }
       }
     }
   }
   ```

3. **Create the Swift widget at `apps/mobile/targets/widget/`**
   - `widget.swift`: defines the `Provider`, `TimelineEntry`, and `View` for the widget. Reads the Bearer token + Supabase URL from the App Group `UserDefaults`, calls `widget-payload` Edge Function.
   - `widget.entitlements`: declares the App Group.
   - The `Provider.getTimeline(...)` should call the function with `URLSession`, decode JSON into a Codable matching `WidgetPayload`, and emit a single entry valid until the next refresh.

4. **From the JS side, write the auth bundle into the App Group on every sign-in**
   ```ts
   import * as SharedGroupPreferences from 'react-native-shared-group-preferences';
   await SharedGroupPreferences.setItem('widget-auth', {
     supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
     accessToken: session.access_token,
     refreshToken: session.refresh_token,
   }, 'group.app.soulsync.widget');
   ```

5. **Build a dev-client and test** — widgets do not work in Expo Go.
   ```sh
   pnpm --filter @soulsync/mobile exec eas build --profile development --platform ios
   ```

### Android (Glance / AppWidget)

1. **Install Expo's modules helpers**
   ```sh
   pnpm --filter @soulsync/mobile add expo-modules-core
   ```

2. **Add a Glance widget receiver under `apps/mobile/android/app/src/main/java/app/soulsync/widget/`**
   - `SoulSyncWidget.kt`: extends `GlanceAppWidget`. Reads token from `EncryptedSharedPreferences` (named after `SOULSYNC.widgetGroupId`), calls the Edge Function with `OkHttp`, renders mood / battery / latest Instant.
   - `WidgetReceiver.kt`: extends `GlanceAppWidgetReceiver`, references the `SoulSyncWidget`.
   - `AndroidManifest.xml` entry:
     ```xml
     <receiver android:name=".widget.WidgetReceiver"
               android:exported="false"
               android:label="SoulSync · partner status">
       <intent-filter>
         <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
       </intent-filter>
       <meta-data android:name="android.appwidget.provider"
                  android:resource="@xml/widget_info" />
     </receiver>
     ```
   - `res/xml/widget_info.xml`: target cell size, update interval, preview drawable.

3. **From the JS side, write the auth bundle into shared prefs**
   ```ts
   import { NativeModules } from 'react-native';
   NativeModules.WidgetAuth.setAuth({
     supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
     accessToken: session.access_token,
   });
   ```

4. **Force an update from the app** (when the user logs in or pulls-to-refresh):
   ```kotlin
   GlanceAppWidgetManager(context).getGlanceIds(SoulSyncWidget::class.java)
     .forEach { SoulSyncWidget().update(context, it) }
   ```

## Testing on a real device

1. Run the dev-client build
2. Sign in (writes the auth bundle to the App Group / SharedPrefs)
3. Long-press home screen → add the SoulSync widget
4. Mood / battery / status should render within ~15 seconds

## Why this isn't fully shippable from JS alone

iOS widgets must be a separate **process** with its own bundle ID, signed independently — that's a Swift target. Android Glance is Compose / Kotlin in a separate `Receiver`. Neither runs JS at all, by design — they need to be **fast** and **memory-cheap**, and the OS kills processes that take too long.

The work above is straightforward Swift + Kotlin (~300-500 lines per platform) and is typical for any production app that ships widgets.
