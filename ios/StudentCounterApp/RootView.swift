import SwiftUI

enum AppTab: Hashable {
    case training
    case stats
}

struct RootView: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        TabView(selection: $selectedTab) {
            TrainingView(selectedTab: $selectedTab)
                .tabItem {
                    Label("训练", systemImage: "figure.run")
                }
                .tag(AppTab.training)

            StatsView()
                .tabItem {
                    Label("统计", systemImage: "chart.bar.fill")
                }
                .tag(AppTab.stats)
        }
    }
}
