import SwiftUI
import UIKit

enum AppSpacing {
    static let xs: CGFloat = 6
    static let sm: CGFloat = 10
    static let md: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 28
}

enum AppRadius {
    static let card: CGFloat = 28
    static let button: CGFloat = 20
    static let pill: CGFloat = 16
}

enum AppShadow {
    static let color = Color.black.opacity(0.08)
    static let radius: CGFloat = 20
    static let y: CGFloat = 12
}

enum AppTint {
    static let primary = Color(red: 0.04, green: 0.51, blue: 0.95)
    static let cyan = Color(red: 0.06, green: 0.72, blue: 0.91)
    static let indigo = Color(red: 0.28, green: 0.39, blue: 0.96)
    static let success = Color.green
    static let warning = Color.orange
    static let danger = Color.red
}

enum AppGradient {
    static let ocean = LinearGradient(
        colors: [AppTint.indigo, AppTint.primary, AppTint.cyan],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let surface = LinearGradient(
        colors: [
            Color(.secondarySystemBackground),
            Color(.secondarySystemBackground).opacity(0.94),
            Color.white.opacity(0.86)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let accentGlow = LinearGradient(
        colors: [
            AppTint.primary.opacity(0.22),
            AppTint.cyan.opacity(0.12),
            Color.clear
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum AppMotion {
    static let spring = Animation.spring(duration: 0.78, bounce: 0.18)
    static let emphasis = Animation.spring(duration: 0.56, bounce: 0.24)
    static let quick = Animation.easeInOut(duration: 0.22)
}

struct AppCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(AppSpacing.lg)
            .background(AppGradient.surface)
            .clipShape(
                RoundedRectangle(
                    cornerRadius: AppRadius.card,
                    style: .continuous
                )
            )
            .overlay(alignment: .topLeading) {
                RoundedRectangle(
                    cornerRadius: AppRadius.card,
                    style: .continuous
                )
                .fill(AppGradient.accentGlow)
                .blendMode(.plusLighter)
                .allowsHitTesting(false)
            }
            .overlay(
                RoundedRectangle(
                    cornerRadius: AppRadius.card,
                    style: .continuous
                )
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.85),
                            Color.primary.opacity(0.05)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
            )
            .shadow(
                color: AppShadow.color,
                radius: AppShadow.radius,
                x: 0,
                y: AppShadow.y
            )
    }
}

extension View {
    func appCardStyle() -> some View {
        modifier(AppCardModifier())
    }

    func appSectionBackground() -> some View {
        background(Color(.systemGroupedBackground))
    }

    func appEntrance(isVisible: Bool, delay: Double = 0) -> some View {
        modifier(AppEntranceModifier(isVisible: isVisible, delay: delay))
    }

    func appNavigationChrome() -> some View {
        modifier(AppNavigationChromeModifier())
    }

    func appDismissKeyboardOnTap() -> some View {
        simultaneousGesture(
            TapGesture().onEnded {
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil,
                    from: nil,
                    for: nil
                )
            }
        )
    }
}

struct AppEntranceModifier: ViewModifier {
    let isVisible: Bool
    let delay: Double

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 20)
            .scaleEffect(isVisible ? 1 : 0.985)
            .animation(AppMotion.spring.delay(delay), value: isVisible)
    }
}

struct AppPressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .opacity(configuration.isPressed ? 0.94 : 1)
            .animation(AppMotion.quick, value: configuration.isPressed)
    }
}

struct AppNavigationChromeModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(.regularMaterial, for: .navigationBar)
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let red = Double((value >> 16) & 0xFF) / 255.0
        let green = Double((value >> 8) & 0xFF) / 255.0
        let blue = Double(value & 0xFF) / 255.0

        self.init(red: red, green: green, blue: blue)
    }
}

extension PoolQualityGrade {
    var tintColor: Color {
        Color(hex: tintHex)
    }
}
