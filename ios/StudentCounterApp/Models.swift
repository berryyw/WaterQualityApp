import Foundation

enum SportType: String, CaseIterable, Codable, Identifiable {
    case jumpRope
    case jumpingJack
    case sitUp

    var id: String { rawValue }

    var title: String {
        switch self {
        case .jumpRope:
            return "跳绳"
        case .jumpingJack:
            return "开合跳"
        case .sitUp:
            return "仰卧起坐"
        }
    }

    var symbolName: String {
        switch self {
        case .jumpRope:
            return "figure.run"
        case .jumpingJack:
            return "figure.mixed.cardio"
        case .sitUp:
            return "figure.strengthtraining.traditional"
        }
    }
}

enum TrainingMode: String, CaseIterable, Codable, Identifiable {
    case target
    case free

    var id: String { rawValue }

    var title: String {
        switch self {
        case .target:
            return "目标训练"
        case .free:
            return "自由计数"
        }
    }
}

struct TrainingPlan: Codable {
    var sport: SportType = .jumpRope
    var mode: TrainingMode = .target
    var targetPerSet: Int = 50
    var totalSets: Int = 3
}

struct WorkoutSession: Identifiable, Codable {
    var id = UUID()
    var date: Date
    var sport: SportType
    var mode: TrainingMode
    var totalCount: Int
    var completedSets: Int
    var targetPerSet: Int?
    var setCounts: [Int]
}

struct QuickPlan: Identifiable {
    let id = UUID()
    let title: String
    let mode: TrainingMode
    let targetPerSet: Int?
    let totalSets: Int
}

struct DailyTotal: Identifiable {
    let id = UUID()
    let date: Date
    let total: Int
}

struct SportSummary: Identifiable {
    let id = UUID()
    let sport: SportType
    let total: Int
}

struct AchievementBadge: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String
    let symbolName: String
    let tintHex: String

    static let all: [AchievementBadge] = [
        AchievementBadge(
            id: "first_workout",
            title: "第一步",
            subtitle: "完成第一次训练",
            symbolName: "star.circle.fill",
            tintHex: "#0A84FF"
        ),
        AchievementBadge(
            id: "streak_3",
            title: "三日坚持",
            subtitle: "连续训练 3 天",
            symbolName: "flame.fill",
            tintHex: "#FF9F0A"
        ),
        AchievementBadge(
            id: "streak_7",
            title: "一周打卡",
            subtitle: "连续训练 7 天",
            symbolName: "flame.circle.fill",
            tintHex: "#FF6B00"
        ),
        AchievementBadge(
            id: "total_workouts_10",
            title: "训练新星",
            subtitle: "累计完成 10 次训练",
            symbolName: "sparkles",
            tintHex: "#30B0C7"
        ),
        AchievementBadge(
            id: "best_session_200",
            title: "单次突破",
            subtitle: "单次训练达到 200 次",
            symbolName: "bolt.circle.fill",
            tintHex: "#34C759"
        ),
        AchievementBadge(
            id: "total_count_500",
            title: "500 次积累",
            subtitle: "累计完成 500 次训练动作",
            symbolName: "target",
            tintHex: "#5856D6"
        ),
        AchievementBadge(
            id: "jump_rope_1000",
            title: "跳绳达人",
            subtitle: "跳绳累计 1000 次",
            symbolName: "figure.run.circle.fill",
            tintHex: "#007AFF"
        )
    ]
}

struct WorkoutCompletionSummary: Identifiable {
    let id = UUID()
    let sport: SportType
    let totalCount: Int
    let completedSets: Int
    let mode: TrainingMode
    let date: Date
    let streakDays: Int
    let unlockedBadges: [AchievementBadge]
}
