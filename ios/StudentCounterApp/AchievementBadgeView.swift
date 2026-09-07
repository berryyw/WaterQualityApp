import SwiftUI

struct AchievementBadgeView: View {
    let badge: AchievementBadge

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Image(systemName: badge.symbolName)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color(hex: badge.tintHex))
                .frame(width: 44, height: 44)
                .background(Color(hex: badge.tintHex).opacity(0.12))
                .clipShape(Circle())

            Text(badge.title)
                .font(.headline)
                .lineLimit(1)

            Text(badge.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.md)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
    }
}
