import SwiftUI

struct EmptyStateCard: View {
    let symbol: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            Image(systemName: symbol)
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(AppTint.primary)
                .frame(width: 64, height: 64)
                .background(Color(.tertiarySystemBackground))
                .clipShape(Circle())

            VStack(spacing: AppSpacing.xs) {
                Text(title)
                    .font(.headline)

                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppSpacing.xl)
        .padding(.horizontal, AppSpacing.md)
        .appCardStyle()
    }
}
