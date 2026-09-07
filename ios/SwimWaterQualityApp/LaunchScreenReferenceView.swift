import SwiftUI

struct LaunchScreenReferenceView: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.white,
                    Color(red: 0.96, green: 0.99, blue: 1.0),
                    Color(red: 0.92, green: 0.98, blue: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color.cyan.opacity(0.10))
                        .frame(width: 160, height: 160)
                        .blur(radius: 18)

                    Circle()
                        .fill(Color.blue.opacity(0.06))
                        .frame(width: 112, height: 112)
                        .offset(x: 34, y: 28)

                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white,
                                    Color(red: 0.96, green: 0.99, blue: 1.0),
                                    Color(red: 0.93, green: 0.98, blue: 1.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 108, height: 108)
                        .overlay(iconArtwork)
                        .overlay(
                            RoundedRectangle(cornerRadius: 30, style: .continuous)
                                .stroke(Color(red: 0.33, green: 0.77, blue: 0.97).opacity(0.22), lineWidth: 1)
                        )
                        .shadow(color: Color.cyan.opacity(0.18), radius: 18, x: 0, y: 10)
                }

                Text("泳池水质通")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.primary)

                Text("附近泳馆 · 水质一眼可见")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text("默认北京，支持全国城市扩展")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
            }
        }
    }

    private var iconArtwork: some View {
        ZStack {
            Image(systemName: "drop.fill")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color(red: 0.23, green: 0.74, blue: 0.96))
                .offset(y: -25)

            Circle()
                .fill(Color.cyan.opacity(0.10))
                .frame(width: 34, height: 34)
                .offset(y: -23)

            Capsule()
                .fill(Color(red: 0.38, green: 0.82, blue: 0.98).opacity(0.95))
                .frame(width: 64, height: 18)
                .offset(y: 17)

            WaveShape()
                .stroke(Color(red: 0.16, green: 0.66, blue: 0.90), style: StrokeStyle(lineWidth: 4.5, lineCap: .round, lineJoin: .round))
                .frame(width: 68, height: 13)
                .offset(y: 9)

            WaveShape()
                .stroke(Color(red: 0.72, green: 0.92, blue: 1.0), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                .frame(width: 54, height: 10)
                .offset(y: 18)

            Circle()
                .fill(Color(red: 1.0, green: 0.90, blue: 0.80))
                .frame(width: 12, height: 12)
                .offset(x: -12, y: -1)

            SwimCapShape()
                .fill(Color(red: 0.48, green: 0.84, blue: 0.99))
                .frame(width: 16, height: 10)
                .offset(x: -11, y: -4)

            SwimmerStrokeShape()
                .stroke(Color(red: 0.19, green: 0.69, blue: 0.91), style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                .frame(width: 44, height: 22)
                .offset(x: 7, y: 2)

            SwimmerArmShape()
                .stroke(Color(red: 0.41, green: 0.81, blue: 0.98), style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                .frame(width: 40, height: 22)
                .offset(x: 17, y: -1)

            Circle()
                .fill(Color(red: 0.30, green: 0.76, blue: 0.96))
                .frame(width: 5, height: 5)
                .offset(x: 22, y: -10)

            Circle()
                .fill(Color(red: 0.55, green: 0.86, blue: 0.98))
                .frame(width: 3, height: 3)
                .offset(x: 27, y: -14)
        }
    }
}

private struct WaveShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addCurve(
            to: CGPoint(x: rect.midX, y: rect.midY),
            control1: CGPoint(x: rect.minX + rect.width * 0.18, y: rect.maxY),
            control2: CGPoint(x: rect.minX + rect.width * 0.32, y: rect.minY)
        )
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.midY),
            control1: CGPoint(x: rect.midX + rect.width * 0.18, y: rect.maxY),
            control2: CGPoint(x: rect.maxX - rect.width * 0.18, y: rect.minY)
        )
        return path
    }
}

private struct SwimCapShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.72))
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.maxY * 0.50),
            control1: CGPoint(x: rect.minX + rect.width * 0.12, y: rect.minY),
            control2: CGPoint(x: rect.maxX - rect.width * 0.16, y: rect.minY)
        )
        path.addLine(to: CGPoint(x: rect.maxX * 0.88, y: rect.maxY))
        path.addCurve(
            to: CGPoint(x: rect.minX + rect.width * 0.12, y: rect.maxY),
            control1: CGPoint(x: rect.maxX * 0.70, y: rect.maxY * 0.92),
            control2: CGPoint(x: rect.minX + rect.width * 0.28, y: rect.maxY * 0.92)
        )
        path.closeSubpath()
        return path
    }
}

private struct SwimmerStrokeShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.08, y: rect.minY + rect.height * 0.44))
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.maxY * 0.78),
            control1: CGPoint(x: rect.minX + rect.width * 0.34, y: rect.minY + rect.height * 0.42),
            control2: CGPoint(x: rect.minX + rect.width * 0.70, y: rect.minY + rect.height * 0.58)
        )
        return path
    }
}

private struct SwimmerArmShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.82))
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.40),
            control1: CGPoint(x: rect.minX + rect.width * 0.30, y: rect.minY + rect.height * 0.16),
            control2: CGPoint(x: rect.minX + rect.width * 0.70, y: rect.minY + rect.height * 0.22)
        )
        return path
    }
}
