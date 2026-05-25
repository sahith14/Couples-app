package app.soulsync.widget

/**
 * SoulSync · Android Glance home-screen widget
 *
 * Reads the auth bundle from EncryptedSharedPreferences (written by the JS
 * side after sign-in via a small native module), calls the widget-payload
 * Edge Function, and renders the partner status / mood / latest Instant.
 *
 * Add to AndroidManifest.xml inside <application>:
 *   <receiver android:name="app.soulsync.widget.WidgetReceiver"
 *             android:exported="false"
 *             android:label="SoulSync · partner">
 *     <intent-filter>
 *       <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
 *     </intent-filter>
 *     <meta-data android:name="android.appwidget.provider"
 *                android:resource="@xml/widget_info" />
 *   </receiver>
 */

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider as ColProv
import androidx.compose.ui.graphics.Color
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.OffsetDateTime
import java.time.temporal.ChronoUnit

// =====================================================================
// Models
// =====================================================================

data class PartnerSnapshot(
    val battery: Int?,
    val isCharging: Boolean,
    val activeScreen: String?,
    val onlineAtIso: String?,
    val mood: String?,
    val hasInstant: Boolean,
)

// =====================================================================
// Auth + network
// =====================================================================

private object WidgetAuth {
    fun load(context: Context): Triple<String, String, String?>? {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                "soulsync_widget_auth",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            val url = prefs.getString("supabase_url", null) ?: return null
            val token = prefs.getString("access_token", null) ?: return null
            val refresh = prefs.getString("refresh_token", null)
            Triple(url, token, refresh)
        } catch (e: Exception) {
            null
        }
    }
}

private object WidgetAPI {
    suspend fun fetch(context: Context): PartnerSnapshot? = withContext(Dispatchers.IO) {
        val auth = WidgetAuth.load(context) ?: return@withContext null
        val (supabaseUrl, accessToken, _) = auth
        try {
            val conn = URL("$supabaseUrl/functions/v1/widget-payload").openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $accessToken")
            conn.setRequestProperty("Accept", "application/json")
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            if (conn.responseCode != 200) return@withContext null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val j = JSONObject(body)
            val partner = j.optJSONObject("partner_status")
            val mood = j.optJSONObject("partner_mood")
            val instant = j.optJSONObject("latest_instant")
            PartnerSnapshot(
                battery     = partner?.optInt("battery_pct", -1)?.takeIf { it >= 0 },
                isCharging  = partner?.optBoolean("is_charging", false) ?: false,
                activeScreen = partner?.optString("current_screen")?.takeIf { it.isNotEmpty() && it != "null" },
                onlineAtIso = partner?.optString("online_at"),
                mood        = mood?.optString("mood")?.takeIf { it.isNotEmpty() && it != "null" },
                hasInstant  = instant != null && !instant.isNull("id"),
            )
        } catch (e: Exception) {
            null
        }
    }
}

// =====================================================================
// Helpers
// =====================================================================

private fun moodEmoji(m: String?): String = when (m) {
    "happy" -> "😊"; "loved" -> "🥰"; "excited" -> "✨"; "calm" -> "😌"
    "sad" -> "😢"; "anxious" -> "😬"; "tired" -> "😴"; "angry" -> "😤"
    "longing" -> "🥺"; else -> "💗"
}

private fun screenLabel(s: String?): String = when (s) {
    "home"      -> "home screen"
    "chat"      -> "in chat"
    "memories"  -> "browsing memories"
    "map"       -> "looking at the map"
    "instants"  -> "on Instants"
    "heartbeat" -> "💗 heartbeat"
    "planner"   -> "planning a date"
    "capsules"  -> "with capsules"
    "notes"     -> "editing notes"
    null        -> "—"
    else        -> "in the app"
}

private fun friendlyAgo(iso: String?): String {
    if (iso == null) return "—"
    return try {
        val then = OffsetDateTime.parse(iso).toInstant()
        val mins = ChronoUnit.MINUTES.between(then, Instant.now())
        when {
            mins < 2 -> "active now"
            mins < 60 -> "${mins}m ago"
            mins < 1440 -> "${mins / 60}h ago"
            else -> "${mins / 1440}d ago"
        }
    } catch (_: Exception) { "—" }
}

// =====================================================================
// Widget
// =====================================================================

class SoulSyncWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = WidgetAPI.fetch(context)
        provideContent {
            GlanceTheme { Content(snapshot) }
        }
    }

    @Composable
    private fun Content(snap: PartnerSnapshot?) {
        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .cornerRadius(20.dp)
                .background(ColProv(Color(0xFF0B0710)))
                .padding(12.dp),
        ) {
            Column(modifier = GlanceModifier.fillMaxSize()) {
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "PARTNER",
                        style = TextStyle(
                            color = ColProv(Color(0xFF7C7090)),
                            fontSize = androidx.compose.ui.unit.TextUnit.Unspecified.let { 10.sp() },
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                    Spacer(modifier = GlanceModifier.size(8.dp))
                    val pct = snap?.battery
                    if (pct != null) {
                        Text(
                            "${if (snap.isCharging) "⚡" else "🔋"} $pct%",
                            style = TextStyle(
                                color = ColProv(if (pct <= 20) Color(0xFFFF6B6B) else Color(0xFF5BE3A6)),
                                fontSize = 11.sp(),
                                fontWeight = FontWeight.Bold,
                            ),
                        )
                    }
                }
                Spacer(modifier = GlanceModifier.height(8.dp))
                Text(
                    text = moodEmoji(snap?.mood),
                    style = TextStyle(fontSize = 36.sp(), color = ColProv(Color.White)),
                )
                Spacer(modifier = GlanceModifier.height(6.dp))
                Text(
                    screenLabel(snap?.activeScreen),
                    style = TextStyle(
                        color = ColProv(Color(0xFFF8F4FF)),
                        fontSize = 13.sp(),
                        fontWeight = FontWeight.Bold,
                    ),
                )
                Text(
                    friendlyAgo(snap?.onlineAtIso),
                    style = TextStyle(color = ColProv(Color(0xFFC9BEDC)), fontSize = 10.sp()),
                )
                if (snap?.hasInstant == true) {
                    Spacer(modifier = GlanceModifier.height(6.dp))
                    Text(
                        "✨ new instant",
                        style = TextStyle(
                            color = ColProv(Color.White),
                            fontSize = 10.sp(),
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                }
            }
        }
    }
}

class WidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = SoulSyncWidget()
}

// Tiny extension because Glance's TextUnit needs sp() — Compose has it
// natively, but Glance lives in a slightly older surface in some versions.
private fun Int.sp(): androidx.compose.ui.unit.TextUnit =
    androidx.compose.ui.unit.TextUnit(this.toFloat(), androidx.compose.ui.unit.TextUnitType.Sp)
