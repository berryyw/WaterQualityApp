import SwiftUI

struct OnboardingView: View {
    @Binding var hasSeenOnboarding: Bool
    @State private var selection = 0

    private let pages: [(title: String, detail: String, symbol: String)] = [
        (
            title: "专注记录每一次训练",
            detail: "为学生设计的轻量训练计数器，打开就能开始，不需要复杂设置。",
            symbol: "figure.run"
        ),
        (
            title: "目标训练与自由计数",
            detail: "可以按计划完成每组目标，也可以自由记录次数，训练结果自动保存在本机。",
            symbol: "target"
        )
    ]

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                TabView(selection: $selection) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                        VStack(spacing: AppSpacing.xl) {
                            Spacer()

                            Image(systemName: page.symbol)
                                .font(.system(size: 60, weight: .semibold))
                                .foregroundStyle(AppTint.primary)
                                .frame(width: 104, height: 104)
                                .background(.thinMaterial)
                                .clipShape(Circle())

                            VStack(spacing: AppSpacing.md) {
                                Text(page.title)
                                    .font(.largeTitle.bold())
                                    .multilineTextAlignment(.center)

                                Text(page.detail)
                                    .font(.body)
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, AppSpacing.lg)
                            }

                            Spacer()
                        }
                        .padding(.horizontal, AppSpacing.lg)
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))

                Button(selection == pages.count - 1 ? "开始使用" : "继续") {
                    if selection == pages.count - 1 {
                        hasSeenOnboarding = true
                    } else {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selection += 1
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, AppSpacing.lg)
                .padding(.bottom, 28)
            }
        }
    }
}
