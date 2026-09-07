import Foundation
import SwiftUI

final class CounterStore: ObservableObject {
    @Published var plan: TrainingPlan = .init() {
        didSet { savePlan() }
    }
    @Published var currentCount = 0
    @Published var currentSet = 1
    @Published var setCounts: [Int] = []
    @Published var completedSummary: WorkoutCompletionSummary?
    @Published private(set) var sessions: [WorkoutSession] = []

    let quickPlans: [QuickPlan] = [
        QuickPlan(
            title: "50 x 3",
            mode: .target,
            targetPerSet: 50,
            totalSets: 3
        ),
        QuickPlan(
            title: "100 x 3",
            mode: .target,
            targetPerSet: 100,
            totalSets: 3
        ),
        QuickPlan(
            title: "自由",
            mode: .free,
            targetPerSet: nil,
            totalSets: 1
        )
    ]

    private let planKey = "student_counter.training_plan"
    private let sessionsKey = "student_counter.workout_sessions"

    init(
        plan: TrainingPlan? = nil,
        sessions: [WorkoutSession]? = nil
    ) {
        if let plan {
            self.plan = plan
        } else {
            loadPlan()
        }

        if let sessions {
            self.sessions = sessions.sorted { $0.date > $1.date }
        } else {
            loadSessions()
        }
    }

    var sessionTotal: Int {
        setCounts.reduce(0, +) + currentCount
    }

    var remainingInSet: Int {
        guard plan.mode == .target else { return 0 }
        return max(plan.targetPerSet - currentCount, 0)
    }

    var currentProgress: Double {
        guard plan.mode == .target, plan.targetPerSet > 0 else { return 0 }
        return min(Double(currentCount) / Double(plan.targetPerSet), 1.0)
    }

    var overallProgress: Double {
        guard plan.mode == .target, plan.targetPerSet > 0, plan.totalSets > 0 else {
            return 0
        }

        let completed = setCounts.reduce(0, +) + min(currentCount, plan.targetPerSet)
        let totalTarget = plan.targetPerSet * plan.totalSets
        return min(Double(completed) / Double(totalTarget), 1.0)
    }

    var statusText: String {
        if plan.mode == .free {
            return "自由计数中，第 \(currentSet) 组"
        }

        if currentCount >= plan.targetPerSet {
            return "本组目标已完成"
        }

        return "还差 \(remainingInSet) 次完成本组"
    }

    var nextButtonTitle: String {
        currentSet >= plan.totalSets ? "完成训练" : "下一组"
    }

    var todayTotal: Int {
        sessionsForDay(Date()).reduce(0) { $0 + $1.totalCount }
    }

    var totalWorkoutCount: Int {
        sessions.count
    }

    var totalCountAllTime: Int {
        sessions.reduce(0) { $0 + $1.totalCount }
    }

    var bestSessionCount: Int {
        sessions.map(\.totalCount).max() ?? 0
    }

    var streakDays: Int {
        calculateStreakDays(for: sessions)
    }

    var last7Days: [DailyTotal] {
        let calendar = Calendar.current

        return (0..<7).reversed().compactMap { index in
            guard let date = calendar.date(byAdding: .day, value: -index, to: Date()) else {
                return nil
            }

            let startOfDay = calendar.startOfDay(for: date)
            let total = sessionsForDay(startOfDay).reduce(0) { $0 + $1.totalCount }
            return DailyTotal(date: startOfDay, total: total)
        }
    }

    var totalsBySport: [SportSummary] {
        SportType.allCases
            .map { sport in
                SportSummary(
                    sport: sport,
                    total: sessions
                        .filter { $0.sport == sport }
                        .reduce(0) { $0 + $1.totalCount }
                )
            }
            .filter { $0.total > 0 }
            .sorted { $0.total > $1.total }
    }

    var unlockedBadges: [AchievementBadge] {
        unlockedBadges(for: sessions)
    }

    func increment() {
        currentCount += 1
        Haptics.tap()
    }

    func decrement() {
        guard currentCount > 0 else { return }
        currentCount -= 1
    }

    func resetCurrentSet() {
        currentCount = 0
    }

    func applyQuickPlan(_ quickPlan: QuickPlan) {
        plan.mode = quickPlan.mode
        plan.totalSets = quickPlan.totalSets

        if let target = quickPlan.targetPerSet {
            plan.targetPerSet = target
        }

        restartWorkout()
    }

    func advanceWorkout() {
        guard currentCount > 0 || !setCounts.isEmpty else { return }

        if currentSet >= plan.totalSets {
            finishWorkout()
        } else {
            if currentCount > 0 {
                setCounts.append(currentCount)
            }
            currentSet += 1
            currentCount = 0
            Haptics.tap()
        }
    }

    func finishWorkout() {
        let finalCounts = currentCount > 0 ? setCounts + [currentCount] : setCounts
        guard !finalCounts.isEmpty else {
            restartWorkout()
            return
        }

        let unlockedBefore = Set(unlockedBadges(for: sessions).map(\.id))

        let session = WorkoutSession(
            date: Date(),
            sport: plan.sport,
            mode: plan.mode,
            totalCount: finalCounts.reduce(0, +),
            completedSets: finalCounts.count,
            targetPerSet: plan.mode == .target ? plan.targetPerSet : nil,
            setCounts: finalCounts
        )

        sessions.insert(session, at: 0)
        saveSessions()

        let allUnlocked = unlockedBadges(for: sessions)
        let newlyUnlocked = allUnlocked.filter { !unlockedBefore.contains($0.id) }

        completedSummary = WorkoutCompletionSummary(
            sport: session.sport,
            totalCount: session.totalCount,
            completedSets: session.completedSets,
            mode: session.mode,
            date: session.date,
            streakDays: streakDays,
            unlockedBadges: newlyUnlocked
        )

        restartWorkout()
        Haptics.success()
    }

    func dismissCompletionSummary() {
        completedSummary = nil
    }

    func restartWorkout() {
        currentCount = 0
        currentSet = 1
        setCounts = []
    }

    private func sessionsForDay(_ date: Date) -> [WorkoutSession] {
        let calendar = Calendar.current
        return sessions.filter { calendar.isDate($0.date, inSameDayAs: date) }
    }

    private func unlockedBadges(for sessions: [WorkoutSession]) -> [AchievementBadge] {
        let totalWorkouts = sessions.count
        let totalCount = sessions.reduce(0) { $0 + $1.totalCount }
        let bestSession = sessions.map(\.totalCount).max() ?? 0
        let streak = calculateStreakDays(for: sessions)
        let jumpRopeTotal = sessions
            .filter { $0.sport == .jumpRope }
            .reduce(0) { $0 + $1.totalCount }

        return AchievementBadge.all.filter { badge in
            switch badge.id {
            case "first_workout":
                return totalWorkouts >= 1
            case "streak_3":
                return streak >= 3
            case "streak_7":
                return streak >= 7
            case "total_workouts_10":
                return totalWorkouts >= 10
            case "best_session_200":
                return bestSession >= 200
            case "total_count_500":
                return totalCount >= 500
            case "jump_rope_1000":
                return jumpRopeTotal >= 1000
            default:
                return false
            }
        }
    }

    private func calculateStreakDays(for sessions: [WorkoutSession]) -> Int {
        let calendar = Calendar.current
        let days = Set(sessions.map { calendar.startOfDay(for: $0.date) })

        guard !days.isEmpty else { return 0 }

        var streak = 0
        var currentDate = calendar.startOfDay(for: Date())

        while days.contains(currentDate) {
            streak += 1
            guard let previousDate = calendar.date(byAdding: .day, value: -1, to: currentDate) else {
                break
            }
            currentDate = previousDate
        }

        return streak
    }

    private func savePlan() {
        do {
            let data = try JSONEncoder().encode(plan)
            UserDefaults.standard.set(data, forKey: planKey)
        } catch {
            print("savePlan error: \(error)")
        }
    }

    private func loadPlan() {
        guard let data = UserDefaults.standard.data(forKey: planKey) else { return }

        do {
            plan = try JSONDecoder().decode(TrainingPlan.self, from: data)
        } catch {
            print("loadPlan error: \(error)")
        }
    }

    private func saveSessions() {
        do {
            let data = try JSONEncoder().encode(sessions)
            UserDefaults.standard.set(data, forKey: sessionsKey)
        } catch {
            print("saveSessions error: \(error)")
        }
    }

    private func loadSessions() {
        guard let data = UserDefaults.standard.data(forKey: sessionsKey) else { return }

        do {
            sessions = try JSONDecoder().decode([WorkoutSession].self, from: data)
            sessions.sort { $0.date > $1.date }
        } catch {
            print("loadSessions error: \(error)")
        }
    }
}
