//
// SoulSyncWidget.swift
// SoulSync · Lockscreen + Home-screen widget
//
// Reads the auth bundle from the App Group `group.app.soulsync.widget`
// (written by the JS side after sign-in), calls the `widget-payload`
// Edge Function, and renders the partner's status, mood, and latest Instant.
//
// Build: add this Swift file to a new Widget Extension target in Xcode.
// Add the App Group capability to BOTH the main app target and the widget
// target. The group ID is `group.app.soulsync.widget`.
//

import WidgetKit
import SwiftUI

// MARK: - Models (mirror packages/shared types.ts WidgetPayload)

struct WidgetPayload: Codable {
    let coupleId: String
    let userA: String
    let userB: String
    let anniversary: String?
    let streakCount: Int
    let level: Int
    let xp: Int
    let partnerStatus: PhoneStatus?
    let partnerMood: MoodLog?
    let latestInstant: Instant?

    enum CodingKeys: String, CodingKey {
        case coupleId = "couple_id"
        case userA = "user_a"
        case userB = "user_b"
        case anniversary
        case streakCount = "streak_count"
        case level, xp
        case partnerStatus = "partner_status"
        case partnerMood   = "partner_mood"
        case latestInstant = "latest_instant"
    }
}

struct PhoneStatus: Codable {
    let userId: String
    let batteryPct: Int?
    let isCharging: Bool?
    let dnd: Bool?
    let active: Bool
    let currentScreen: String?
    let onlineAt: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case batteryPct = "battery_pct"
        case isCharging = "is_charging"
        case dnd, active
        case currentScreen = "current_screen"
        case onlineAt = "online_at"
    }
}

struct MoodLog: Codable {
    let mood: String
    let intensity: Int
    let forDate: String
    enum CodingKeys: String, CodingKey {
        case mood, intensity
        case forDate = "for_date"
    }
}

struct Instant: Codable {
    let id: String
    let kind: String
    let body: String?
    let mood: String?
    let createdAt: String
    enum CodingKeys: String, CodingKey {
        case id, kind, body, mood
        case createdAt = "created_at"
    }
}

// MARK: - Auth bundle (written by the JS side)

struct WidgetAuth: Codable {
    let supabaseUrl: String
    let accessToken: String
    let refreshToken: String?

    static func load() -> WidgetAuth? {
        let defaults = UserDefaults(suiteName: "group.app.soulsync.widget")
        guard let raw = defaults?.string(forKey: "widget-auth"),
              let data = raw.data(using: .utf8),
              let bundle = try? JSONDecoder().decode(WidgetAuth.self, from: data)
        else { return nil }
        return bundle
    }
}

// MARK: - Network

enum WidgetAPI {
    static func fetch() async -> WidgetPayload? {
        guard let auth = WidgetAuth.load() else { return nil }
        let endpoint = "\(auth.supabaseUrl)/functions/v1/widget-payload"
        guard let url = URL(string: endpoint) else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 10
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            return try JSONDecoder().decode(WidgetPayload.self, from: data)
        } catch {
            return nil
        }
    }
}

// MARK: - Timeline provider

struct PartnerEntry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PartnerEntry {
        PartnerEntry(date: Date(), payload: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (PartnerEntry) -> Void) {
        Task {
            let payload = await WidgetAPI.fetch()
            completion(PartnerEntry(date: Date(), payload: payload))
        }
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PartnerEntry>) -> Void) {
        Task {
            let payload = await WidgetAPI.fetch()
            let entry = PartnerEntry(date: Date(), payload: payload)
            // Refresh every 15 minutes; iOS may stretch this further.
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }
}

// MARK: - Helpers

func friendlyAgo(_ iso: String?) -> String {
    guard let iso = iso else { return "—" }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    guard let d = d else { return "—" }
    let mins = Int(-d.timeIntervalSinceNow / 60)
    if mins < 2 { return "active now" }
    if mins < 60 { return "\(mins)m ago" }
    let hrs = mins / 60
    if hrs < 24 { return "\(hrs)h ago" }
    return "\(hrs / 24)d ago"
}

func screenLabel(_ s: String?) -> String {
    switch s {
    case "home":      return "home screen"
    case "chat":      return "in chat"
    case "memories":  return "browsing memories"
    case "map":       return "looking at the map"
    case "instants":  return "on Instants"
    case "heartbeat": return "💗 heartbeat mode"
    case "planner":   return "planning a date"
    case "capsules":  return "with capsules"
    case "notes":     return "editing notes"
    default:          return "in the app"
    }
}

func moodEmoji(_ m: String?) -> String {
    switch m {
    case "happy": return "😊"; case "loved": return "🥰"
    case "excited": return "✨"; case "calm": return "😌"
    case "sad": return "😢"; case "anxious": return "😬"
    case "tired": return "😴"; case "angry": return "😤"
    case "longing": return "🥺"
    default: return "💗"
    }
}

// MARK: - Views

struct PartnerLockscreenView: View {
    let entry: PartnerEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(moodEmoji(entry.payload?.partnerMood?.mood))
                    .font(.system(size: 18))
                Text(entry.payload?.partnerStatus?.batteryPct.map { "\($0)%" } ?? "—")
                    .font(.system(size: 12, weight: .bold))
            }
            Text(friendlyAgo(entry.payload?.partnerStatus?.onlineAt))
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
        }
        .containerBackground(for: .widget) { Color.clear }
    }
}

struct PartnerSmallView: View {
    let entry: PartnerEntry
    var body: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(
                colors: [Color(red: 1.0, green: 0.36, blue: 0.54),
                         Color(red: 0.62, green: 0.42, blue: 1.0)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("PARTNER")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1.5)
                        .foregroundStyle(.white.opacity(0.85))
                    Spacer()
                    if let pct = entry.payload?.partnerStatus?.batteryPct {
                        Text("\(entry.payload?.partnerStatus?.isCharging == true ? "⚡" : "🔋") \(pct)%")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                Spacer()
                Text(moodEmoji(entry.payload?.partnerMood?.mood))
                    .font(.system(size: 36))
                Text(screenLabel(entry.payload?.partnerStatus?.currentScreen))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                Text(friendlyAgo(entry.payload?.partnerStatus?.onlineAt))
                    .font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(12)
        }
        .containerBackground(for: .widget) { Color.clear }
    }
}

struct PartnerMediumView: View {
    let entry: PartnerEntry
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.04, green: 0.03, blue: 0.06),
                         Color(red: 0.07, green: 0.04, blue: 0.10)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("PARTNER")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1.5)
                        .foregroundStyle(.secondary)
                    Text(screenLabel(entry.payload?.partnerStatus?.currentScreen))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                    Text(friendlyAgo(entry.payload?.partnerStatus?.onlineAt))
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                    Spacer()
                    if let pct = entry.payload?.partnerStatus?.batteryPct {
                        Text("\(entry.payload?.partnerStatus?.isCharging == true ? "⚡" : "🔋") \(pct)%")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                Spacer()
                VStack(alignment: .center, spacing: 6) {
                    Text(moodEmoji(entry.payload?.partnerMood?.mood))
                        .font(.system(size: 48))
                    if let m = entry.payload?.partnerMood?.mood {
                        Text(m)
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(1)
                            .foregroundStyle(.white)
                    }
                    if let i = entry.payload?.latestInstant {
                        Text("✨ new instant")
                            .font(.system(size: 9, weight: .heavy))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(Color(red: 1.0, green: 0.36, blue: 0.54))
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                }
                .padding(.trailing, 4)
            }
            .padding(14)
        }
        .containerBackground(for: .widget) { Color.clear }
    }
}

// MARK: - Widget configuration

struct PartnerWidget: Widget {
    let kind: String = "PartnerWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            PartnerWidgetView(entry: entry)
        }
        .configurationDisplayName("SoulSync · Partner")
        .description("See your partner at a glance — mood, battery, what they're up to.")
        .supportedFamilies([
            .systemSmall, .systemMedium,
            .accessoryCircular, .accessoryRectangular, .accessoryInline
        ])
    }
}

struct PartnerWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PartnerEntry
    var body: some View {
        switch family {
        case .systemMedium:
            PartnerMediumView(entry: entry)
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            PartnerLockscreenView(entry: entry)
        default:
            PartnerSmallView(entry: entry)
        }
    }
}

// MARK: - Bundle

@main
struct SoulSyncWidgetBundle: WidgetBundle {
    var body: some Widget {
        PartnerWidget()
    }
}
