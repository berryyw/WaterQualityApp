import SwiftUI
import UIKit

struct SettingsView: View {
    @Binding var defaultSport: SportType
    @Binding var defaultTargetPerSet: Int
    @Binding var defaultTotalSets: Int

    @Environment(\.openURL) private var openURL
    @AppStorage("hapticsEnabled") private var hapticsEnabled = true
    @AppStorage("dailyReminderEnabled") private var dailyReminderEnabled = false
    @AppStorage("dailyReminderTime") private var dailyReminderTimestamp = Self.defaultReminderTimestamp
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = true
    @State private var showReminderPermissionAlert = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("当前项目", selection: $defaultSport) {
                        ForEach(SportType.allCases) { sport in
                            Text(sport.title).tag(sport)
                        }
                    }

                    Stepper("当前每组目标 \(defaultTargetPerSet)", value: $defaultTargetPerSet, in: 10...500, step: 10)
                    Stepper("当前组数 \(defaultTotalSets)", value: $defaultTotalSets, in: 1...10)
                } footer: {
                    Text("这里的修改会立即应用到当前训练，并作为下次打开 App 时的默认值。")
                }

                Section("交互") {
                    Toggle("触感反馈", isOn: $hapticsEnabled)
                }

                Section("提醒") {
                    Toggle("每日提醒", isOn: $dailyReminderEnabled)

                    if dailyReminderEnabled {
                        DatePicker(
                            "提醒时间",
                            selection: reminderTimeBinding,
                            displayedComponents: .hourAndMinute
                        )
                    }
                }

                Section("新手引导") {
                    Button("重新显示引导") {
                        hasSeenOnboarding = false
                    }
                }
            }
            .navigationTitle("设置")
            .onChange(of: dailyReminderEnabled) { _, enabled in
                if enabled {
                    NotificationManager.shared.scheduleDailyReminder(at: reminderTimeBinding.wrappedValue) { granted in
                        guard !granted else { return }
                        dailyReminderEnabled = false
                        showReminderPermissionAlert = true
                    }
                } else {
                    NotificationManager.shared.removeDailyReminder()
                }
            }
            .onChange(of: dailyReminderTimestamp) { _, newValue in
                guard dailyReminderEnabled else { return }
                NotificationManager.shared.scheduleDailyReminder(
                    at: Date(timeIntervalSinceReferenceDate: newValue)
                ) { granted in
                    guard !granted else { return }
                    dailyReminderEnabled = false
                    showReminderPermissionAlert = true
                }
            }
            .alert("无法开启每日提醒", isPresented: $showReminderPermissionAlert) {
                Button("取消", role: .cancel) {}
                Button("打开设置") {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    openURL(url)
                }
            } message: {
                Text("系统通知权限未开启，请前往“设置”允许通知后再试。")
            }
        }
    }

    private var reminderTimeBinding: Binding<Date> {
        Binding(
            get: { Date(timeIntervalSinceReferenceDate: dailyReminderTimestamp) },
            set: { dailyReminderTimestamp = $0.timeIntervalSinceReferenceDate }
        )
    }

    private static var defaultReminderTimestamp: Double {
        (Calendar.current.date(from: DateComponents(hour: 19, minute: 0)) ?? Date())
            .timeIntervalSinceReferenceDate
    }
}
