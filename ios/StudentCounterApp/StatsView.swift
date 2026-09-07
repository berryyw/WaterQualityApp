import Charts
import SwiftUI

struct StatsView: View {
    @EnvironmentObject private var store: CounterStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    summarySection
                    achievementsSection
                    trendSection
                    sportSection
                    historySection
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, AppSpacing.md)
                .padding(.bottom, AppSpacing.xl)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("统计")
        }
    }

    private var achievementsSection: some View {
        Group {
            if store.unlockedBadges.isEmpty {
                EmptyStateCard(
                    symbol: "rosette",
                    title: "还没有解锁徽章",
                    message: "继续训练并保持连续打卡，就会逐步解锁新的成就。"
                )
            } else {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    HStack {
                        Text("成就徽章")
                            .font(.headline)
                        Spacer()
                        Text("已解锁 \(store.unlockedBadges.count)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    LazyVGrid(
                        columns: [
                            GridItem(.flexible(), spacing: AppSpacing.sm),
                            GridItem(.flexible(), spacing: AppSpacing.sm)
                        ],
                        spacing: AppSpacing.sm
                    ) {
                        ForEach(store.unlockedBadges) { badge in
                            AchievementBadgeView(badge: badge)
                        }
                    }
                }
                .appCardStyle()
            }
        }
    }

    private var summarySection: some View {
        VStack(spacing: AppSpacing.sm) {
            HStack(spacing: AppSpacing.sm) {
                summaryCard(title: "今日总次数", value: "\(store.todayTotal)")
                summaryCard(title: "训练记录", value: "\(store.totalWorkoutCount)")
            }

            HStack(spacing: AppSpacing.sm) {
                summaryCard(title: "连续训练", value: "\(store.streakDays) 天")
                summaryCard(title: "累计总数", value: "\(store.totalCountAllTime)")
            }
        }
    }

    private var trendSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("最近 7 天")
                .font(.headline)

            Chart(store.last7Days) { item in
                BarMark(
                    x: .value("日期", item.date, unit: .day),
                    y: .value("次数", item.total)
                )
                .foregroundStyle(AppTint.primary.gradient)
                .cornerRadius(6)
            }
            .frame(height: 220)
        }
        .appCardStyle()
    }

    private var sportSection: some View {
        Group {
            if store.totalsBySport.isEmpty {
                EmptyStateCard(
                    symbol: "figure.run.circle",
                    title: "还没有项目统计",
                    message: "完成一次训练后，这里会显示跳绳等项目的累计数据。"
                )
            } else {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("按项目统计")
                        .font(.headline)

                    ForEach(store.totalsBySport) { item in
                        HStack {
                            Label(item.sport.title, systemImage: item.sport.symbolName)
                            Spacer()
                            Text("\(item.total)")
                                .fontWeight(.semibold)
                                .monospacedDigit()
                        }
                        .padding(.vertical, 4)
                    }
                }
                .appCardStyle()
            }
        }
    }

    private var historySection: some View {
        Group {
            if store.sessions.isEmpty {
                EmptyStateCard(
                    symbol: "chart.bar.xaxis",
                    title: "还没有训练记录",
                    message: "完成第一次训练后，这里会显示最近训练、趋势图和每日累计。"
                )
            } else {
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text("最近记录")
                        .font(.headline)

                    ForEach(store.sessions.prefix(8)) { session in
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(session.sport.title)
                                    .font(.subheadline.weight(.semibold))
                                Text(session.date.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            VStack(alignment: .trailing, spacing: 4) {
                                Text("\(session.totalCount) 次")
                                    .font(.headline)
                                    .monospacedDigit()
                                Text("\(session.completedSets) 组")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .appCardStyle()
            }
        }
    }

    private func summaryCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .appCardStyle()
    }
}
