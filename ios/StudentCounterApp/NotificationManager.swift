import Foundation
import UserNotifications

final class NotificationManager {
    static let shared = NotificationManager()

    private let center = UNUserNotificationCenter.current()
    private let reminderKey = "dailyReminderEnabled"
    private let reminderTimeKey = "dailyReminderTime"

    private init() {}

    func syncFromSettings() {
        let enabled = UserDefaults.standard.object(forKey: "dailyReminderEnabled") as? Bool ?? false
        let reminderTimestamp = UserDefaults.standard.object(forKey: reminderTimeKey) as? Double
            ?? defaultReminderDate.timeIntervalSinceReferenceDate
        let reminderDate = Date(timeIntervalSinceReferenceDate: reminderTimestamp)

        if enabled {
            scheduleDailyReminder(at: reminderDate) { granted in
                guard !granted else { return }
                self.removeDailyReminder()
                UserDefaults.standard.set(false, forKey: self.reminderKey)
            }
        } else {
            removeDailyReminder()
        }
    }

    func scheduleDailyReminder(at date: Date, completion: ((Bool) -> Void)? = nil) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, _ in
            guard granted else {
                self?.removeDailyReminder()
                DispatchQueue.main.async {
                    completion?(false)
                }
                return
            }
            self?.createDailyReminder(date: date)
            DispatchQueue.main.async {
                completion?(true)
            }
        }
    }

    func removeDailyReminder() {
        center.removePendingNotificationRequests(withIdentifiers: ["daily-training-reminder"])
    }

    private func createDailyReminder(date: Date) {
        removeDailyReminder()

        let content = UNMutableNotificationContent()
        content.title = "准备开始今天的训练"
        content.body = "打开跳绳计数，完成今天的练习。"
        content.sound = .default

        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(
            identifier: "daily-training-reminder",
            content: content,
            trigger: trigger
        )

        center.add(request)
    }

    private var defaultReminderDate: Date {
        Calendar.current.date(from: DateComponents(hour: 19, minute: 0)) ?? Date()
    }
}
