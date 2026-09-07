import SwiftUI

struct CompletionSheet: View {
    let summary: WorkoutCompletionSummary
    let onRestart: () -> Void
    let onShowStats: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: AppSpacing.lg) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(AppTint.success)
                    .padding(.top, AppSpacing.xl)

                VStack(spacing: AppSpacing.sm) {
                    Text("训练完成")
                        .font(.largeTitle.bold())

                    Text("今天又完成了一次练习")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: AppSpacing.md) {
                    summaryRow(title: "项目", value: summary.sport.title)
                    summaryRow(title: "总次数", value: "\(summary.totalCount)")
                    summaryRow(title: "完成组数", value: "\(summary.completedSets)")
                    summaryRow(title: "模式", value: summary.mode.title)
                    summaryRow(title: "连续训练", value: "\(summary.streakDays) 天")
                }
                .appCardStyle()

                if !summary.unlockedBadges.isEmpty {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text("新解锁徽章")
                            .font(.headline)

                        ForEach(summary.unlockedBadges) { badge in
                            HStack(spacing: AppSpacing.md) {
                                Image(systemName: badge.symbolName)
                                    .font(.title3)
                                    .foregroundStyle(Color(hex: badge.tintHex))
                                    .frame(width: 40, height: 40)
                                    .background(Color(hex: badge.tintHex).opacity(0.12))
                                    .clipShape(Circle())

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(badge.title)
                                        .font(.headline)
                                    Text(badge.subtitle)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .appCardStyle()
                }

                Spacer()

                Button("再来一组") {
                    dismiss()
                    onRestart()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button("查看统计") {
                    dismiss()
                    onShowStats()
                }
                .buttonStyle(.bordered)
                .controlSize(.large)

                Button("收起") {
                    dismiss()
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .padding(.bottom, AppSpacing.lg)
            }
            .padding(.horizontal, AppSpacing.lg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") {
                        dismiss()
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
        }
        .presentationDetents([.medium])
    }

    private func summaryRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
                .monospacedDigit()
        }
    }
}
