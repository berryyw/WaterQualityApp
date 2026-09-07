import SwiftUI

@main
struct StudentCounterApp: App {
    @StateObject private var store = CounterStore()

    var body: some Scene {
        WindowGroup {
            AppContainerView()
                .environmentObject(store)
        }
    }
}

struct AppContainerView: View {
    @AppStorage("hasSeenOnboarding") private var hasSeenOnboarding = false
    @State private var selectedTab: AppTab = .training

    var body: some View {
        RootView(selectedTab: $selectedTab)
            .fullScreenCover(isPresented: onboardingBinding) {
                OnboardingView(hasSeenOnboarding: $hasSeenOnboarding)
            }
            .onAppear {
                NotificationManager.shared.syncFromSettings()
            }
    }

    private var onboardingBinding: Binding<Bool> {
        Binding(
            get: { !hasSeenOnboarding },
            set: { hasSeenOnboarding = !$0 }
        )
    }
}
