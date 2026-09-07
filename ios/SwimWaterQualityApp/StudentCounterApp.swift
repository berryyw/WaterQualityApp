import SwiftUI

private enum AppSecrets {
    static var swimmableAPIKey: String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SWIMMABLE_API_KEY") as? String else {
            return nil
        }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "$(SWIMMABLE_API_KEY)" {
            return nil
        }
        return trimmed
    }
}

@main
struct SwimWaterQualityApp: App {
    @StateObject private var store: SwimAppStore = {
        SwimAppStore()
    }()

    var body: some Scene {
        WindowGroup {
            AppContainerView()
                .environmentObject(store)
        }
    }
}

struct AppContainerView: View {
    @EnvironmentObject private var store: SwimAppStore
    @State private var selectedTab: AppTab = .map

    var body: some View {
        Group {
            if store.isRestoringSession {
                AppLaunchTransitionView()
            } else if store.isAuthenticated {
                RootView(selectedTab: $selectedTab)
            } else {
                AuthFlowView()
            }
        }
    }
}

private struct AppLaunchTransitionView: View {
    var body: some View {
        ZStack {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()

            Circle()
                .fill(AppTint.primary.opacity(0.14))
                .frame(width: 320, height: 320)
                .blur(radius: 54)
                .offset(x: -120, y: -220)

            Circle()
                .fill(AppTint.cyan.opacity(0.12))
                .frame(width: 240, height: 240)
                .blur(radius: 42)
                .offset(x: 130, y: -80)

            VStack(spacing: AppSpacing.xl) {
                Spacer()

                VStack(spacing: AppSpacing.md) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 32, style: .continuous)
                            .fill(AppGradient.ocean)
                            .frame(width: 96, height: 96)

                        Circle()
                            .fill(Color.white.opacity(0.14))
                            .frame(width: 64, height: 64)
                            .offset(x: 20, y: -20)

                        Image(systemName: "drop.fill")
                            .font(.system(size: 32, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .shadow(color: AppTint.primary.opacity(0.20), radius: 22, x: 0, y: 14)

                    Text("泳池水质通")
                        .font(.system(size: 30, weight: .bold, design: .rounded))

                    Text("正在为你准备地图、水质与热度数据")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: AppSpacing.sm) {
                    ProgressView()
                        .tint(AppTint.primary)

                    Text("马上进入")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, AppSpacing.xl)
                .padding(.vertical, AppSpacing.lg)
                .background(Color(.secondarySystemBackground).opacity(0.9))
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                        .stroke(Color.white.opacity(0.72), lineWidth: 1)
                )

                Spacer()
            }
            .padding(.horizontal, AppSpacing.lg)
            .padding(.vertical, AppSpacing.xl)
        }
    }
}
