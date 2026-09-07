import SwiftUI

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
    static let color = Color.black.opacity(0.06)
    static let radius: CGFloat = 16
    static let y: CGFloat = 10
}

enum AppTint {
    static let primary = Color.blue
    static let success = Color.green
    static let warning = Color.orange
}

struct AppCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(AppSpacing.lg)
            .background(Color(.secondarySystemBackground))
            .clipShape(
                RoundedRectangle(
                    cornerRadius: AppRadius.card,
                    style: .continuous
                )
            )
            .overlay(
                RoundedRectangle(
                    cornerRadius: AppRadius.card,
                    style: .continuous
                )
                .stroke(Color.primary.opacity(0.05), lineWidth: 1)
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
