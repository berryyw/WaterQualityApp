import SwiftUI

struct WaterQualityBadgeView: View {
    let grade: PoolQualityGrade
    var detail: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Image(systemName: grade.symbolName)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background(
                        LinearGradient(
                            colors: [grade.tintColor, grade.tintColor.opacity(0.75)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(Circle())

                Spacer()

                Text("实时")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(grade.tintColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(grade.tintColor.opacity(0.12))
                    .clipShape(Capsule())
            }

            Text("水质 \(grade.title)")
                .font(.headline.weight(.semibold))
                .lineLimit(1)

            Text(detail ?? grade.detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .fill(grade.tintColor.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .stroke(grade.tintColor.opacity(0.15), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
    }
}
