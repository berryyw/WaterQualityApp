import SwiftUI

struct RootView: View {
    @Binding var selectedTab: AppTab

    var body: some View {
        TabView(selection: $selectedTab) {
            TrainingView(selectedTab: $selectedTab)
                .appEntrance(isVisible: selectedTab == .map)
                .tabItem {
                    Label("地图", systemImage: "map.fill")
                }
                .tag(AppTab.map)

            TrendingView()
                .appEntrance(isVisible: selectedTab == .trending)
                .tabItem {
                    Label("热度", systemImage: "chart.line.uptrend.xyaxis")
                }
                .tag(AppTab.trending)

            ProfileView()
                .appEntrance(isVisible: selectedTab == .profile)
                .tabItem {
                    Label("我的", systemImage: "person.crop.circle.fill")
                }
                .tag(AppTab.profile)
        }
        .tint(AppTint.primary)
        .toolbarBackground(.visible, for: .tabBar)
        .toolbarBackground(.regularMaterial, for: .tabBar)
        .animation(AppMotion.quick, value: selectedTab)
    }
}
