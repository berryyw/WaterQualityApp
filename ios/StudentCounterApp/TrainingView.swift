import SwiftUI

struct TrainingView: View {
    @Binding var selectedTab: AppTab
    @EnvironmentObject private var store: CounterStore
    @State private var showsSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: AppSpacing.lg) {
                    controlCard
                    progressCard
                    quickPlansCard
                    countCard
                }
                .padding(.horizontal, AppSpacing.lg)
                .padding(.top, AppSpacing.md)
                .padding(.bottom, 120)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("训练")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showsSettings = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                bottomActionBar
            }
        }
        .sheet(isPresented: $showsSettings) {
            SettingsView(
                defaultSport: sportBinding,
                defaultTargetPerSet: targetBinding,
                defaultTotalSets: totalSetsBinding
            )
        }
        .sheet(item: $store.completedSummary) { summary in
            CompletionSheet(summary: summary) {
                store.restartWorkout()
                store.dismissCompletionSummary()
            } onShowStats: {
                selectedTab = .stats
                store.dismissCompletionSummary()
            }
        }
    }

    private var controlCard: some View {
        VStack(spacing: AppSpacing.md) {
            HStack(spacing: AppSpacing.md) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("项目")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Picker("项目", selection: sportBinding) {
                        ForEach(SportType.allCases) { sport in
                            Text(sport.title).tag(sport)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("模式")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Picker("模式", selection: modeBinding) {
                        ForEach(TrainingMode.allCases) { mode in
                            Text(mode.title).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }

            VStack(spacing: AppSpacing.sm) {
                Stepper(
                    "每组目标 \(store.plan.targetPerSet)",
                    value: targetBinding,
                    in: 10...500,
                    step: 10
                )
                .disabled(store.plan.mode == .free)
                .opacity(store.plan.mode == .free ? 0.45 : 1)

                Stepper(
                    "总组数 \(store.plan.totalSets)",
                    value: totalSetsBinding,
                    in: 1...10
                )
            }
            .font(.subheadline)
        }
        .appCardStyle()
    }

    private var progressCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text("目标进度")
                        .font(.headline)

                    Text(progressLabel)
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .monospacedDigit()
                }

                Spacer()

                VStack(alignment: .trailing, spacing: AppSpacing.xs) {
                    Text("第 \(store.currentSet) 组 / 共 \(store.plan.totalSets) 组")
                        .font(.subheadline.weight(.semibold))

                    Text(store.statusText)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                }
            }

            ProgressView(value: store.plan.mode == .target ? store.overallProgress : 0)
                .tint(progressTint)

            HStack(spacing: AppSpacing.sm) {
                infoPill(title: "本组目标", value: store.plan.mode == .target ? "\(store.plan.targetPerSet)" : "自由")
                infoPill(title: "当前次数", value: "\(store.currentCount)")
                infoPill(title: "本次累计", value: "\(store.sessionTotal)")
            }
        }
        .appCardStyle()
    }

    private var quickPlansCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            Text("快速计划")
                .font(.headline)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: AppSpacing.sm) {
                    ForEach(store.quickPlans) { plan in
                        Button {
                            store.applyQuickPlan(plan)
                        } label: {
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text(plan.title)
                                    .font(.headline)
                                Text("保留当前项目")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(width: 112, alignment: .leading)
                            .padding(.vertical, AppSpacing.md)
                            .padding(.horizontal, AppSpacing.md)
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(
                                RoundedRectangle(
                                    cornerRadius: AppRadius.pill,
                                    style: .continuous
                                )
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .appCardStyle()
    }

    private var countCard: some View {
        VStack(spacing: AppSpacing.md) {
            Text("当前次数")
                .font(.headline)
                .foregroundStyle(.secondary)

            Text("\(store.currentCount)")
                .font(.system(size: 92, weight: .bold, design: .rounded))
                .monospacedDigit()
                .contentTransition(.numericText())

            Text("今天累计 \(store.todayTotal)")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button("重置本组") {
                store.resetCurrentSet()
            }
            .buttonStyle(.plain)
            .foregroundStyle(.red)
        }
        .frame(maxWidth: .infinity)
        .appCardStyle()
    }

    private var bottomActionBar: some View {
        HStack(spacing: AppSpacing.sm) {
            Button {
                store.decrement()
            } label: {
                Image(systemName: "minus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(SecondaryActionButtonStyle())

            Button {
                store.increment()
            } label: {
                Text("+1")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(PrimaryActionButtonStyle())

            Button {
                store.advanceWorkout()
            } label: {
                Text(store.nextButtonTitle)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(SecondaryActionButtonStyle())
        }
        .padding(.horizontal, AppSpacing.lg)
        .padding(.top, AppSpacing.sm)
        .padding(.bottom, AppSpacing.md)
        .background(.ultraThinMaterial)
    }

    private func infoPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .monospacedDigit()
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, AppSpacing.sm)
        .padding(.horizontal, AppSpacing.sm)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.pill, style: .continuous))
    }

    private var sportBinding: Binding<SportType> {
        Binding(
            get: { store.plan.sport },
            set: { store.plan.sport = $0 }
        )
    }

    private var modeBinding: Binding<TrainingMode> {
        Binding(
            get: { store.plan.mode },
            set: { store.plan.mode = $0 }
        )
    }

    private var targetBinding: Binding<Int> {
        Binding(
            get: { store.plan.targetPerSet },
            set: { store.plan.targetPerSet = $0 }
        )
    }

    private var totalSetsBinding: Binding<Int> {
        Binding(
            get: { store.plan.totalSets },
            set: { store.plan.totalSets = $0 }
        )
    }

    private var progressLabel: String {
        if store.plan.mode == .free {
            return "自由"
        }
        return "\(Int(store.overallProgress * 100))%"
    }

    private var progressTint: Color {
        store.statusText == "本组目标已完成" ? AppTint.success : AppTint.primary
    }
}

struct PrimaryActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3.bold())
            .foregroundStyle(.white)
            .padding(.vertical, 18)
            .background(AppTint.primary)
            .clipShape(
                RoundedRectangle(
                    cornerRadius: AppRadius.button,
                    style: .continuous
                )
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct SecondaryActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.primary)
            .padding(.vertical, 18)
            .background(Color(.secondarySystemBackground))
            .clipShape(
                RoundedRectangle(
                    cornerRadius: AppRadius.button,
                    style: .continuous
                )
            )
            .overlay(
                RoundedRectangle(
                    cornerRadius: AppRadius.button,
                    style: .continuous
                )
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
