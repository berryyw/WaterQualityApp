import Foundation

enum MockData {
    static let samplePlan = TrainingPlan(
        sport: .jumpRope,
        mode: .target,
        targetPerSet: 80,
        totalSets: 3
    )

    static let sampleSessions: [WorkoutSession] = [
        WorkoutSession(
            date: Calendar.current.date(byAdding: .hour, value: -2, to: Date()) ?? Date(),
            sport: .jumpRope,
            mode: .target,
            totalCount: 240,
            completedSets: 3,
            targetPerSet: 80,
            setCounts: [80, 80, 80]
        ),
        WorkoutSession(
            date: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date(),
            sport: .jumpingJack,
            mode: .free,
            totalCount: 120,
            completedSets: 2,
            targetPerSet: nil,
            setCounts: [60, 60]
        ),
        WorkoutSession(
            date: Calendar.current.date(byAdding: .day, value: -2, to: Date()) ?? Date(),
            sport: .sitUp,
            mode: .target,
            totalCount: 90,
            completedSets: 3,
            targetPerSet: 30,
            setCounts: [30, 30, 30]
        ),
        WorkoutSession(
            date: Calendar.current.date(byAdding: .day, value: -3, to: Date()) ?? Date(),
            sport: .jumpRope,
            mode: .target,
            totalCount: 300,
            completedSets: 3,
            targetPerSet: 100,
            setCounts: [100, 100, 100]
        )
    ]

    static func makePreviewStore() -> CounterStore {
        let store = CounterStore(plan: samplePlan, sessions: sampleSessions)
        store.currentCount = 54
        store.currentSet = 2
        store.setCounts = [80]
        return store
    }
}
