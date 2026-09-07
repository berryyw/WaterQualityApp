import SwiftUI

struct LaunchScreenReferenceView: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(.systemBackground),
                    Color(red: 0.93, green: 0.97, blue: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.10))
                        .frame(width: 132, height: 132)
                        .blur(radius: 10)

                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.05, green: 0.52, blue: 1.0),
                                    Color(red: 0.34, green: 0.76, blue: 1.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 108, height: 108)
                        .overlay(iconArtwork)
                        .shadow(color: Color.blue.opacity(0.18), radius: 14, x: 0, y: 8)
                }

                Text("跳绳计数")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.primary)

                Text("专注记录每一次训练")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var iconArtwork: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.32), lineWidth: 12)
                .frame(width: 62, height: 62)

            Circle()
                .trim(from: 0.12, to: 0.84)
                .stroke(
                    Color.white.opacity(0.95),
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .frame(width: 62, height: 62)
                .rotationEffect(.degrees(-85))

            Path { path in
                path.move(to: CGPoint(x: 24, y: 64))
                path.addCurve(
                    to: CGPoint(x: 84, y: 42),
                    control1: CGPoint(x: 42, y: 24),
                    control2: CGPoint(x: 66, y: 82)
                )
            }
            .stroke(
                Color.white,
                style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round)
            )
        }
    }
}
