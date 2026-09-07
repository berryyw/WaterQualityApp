import AppKit
import Foundation
import SwiftUI

enum AppSpacing {
    static let md: CGFloat = 16
}

enum AppTint {
    static let primary = Color(red: 0.04, green: 0.51, blue: 0.95)
    static let cyan = Color(red: 0.06, green: 0.72, blue: 0.91)
    static let indigo = Color(red: 0.28, green: 0.39, blue: 0.96)
}

enum AppGradient {
    static let ocean = LinearGradient(
        colors: [AppTint.indigo, AppTint.primary, AppTint.cyan],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

struct HomeHeroLogoView: View {
    var body: some View {
        VStack(spacing: AppSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: 32, style: .continuous)
                    .fill(AppGradient.ocean)
                    .frame(width: 88, height: 88)

                Circle()
                    .fill(Color.white.opacity(0.14))
                    .frame(width: 60, height: 60)
                    .offset(x: 18, y: -18)

                Image(systemName: "drop.fill")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(.white)
            }
            .shadow(color: AppTint.primary.opacity(0.20), radius: 22, x: 0, y: 14)

            Text("泳池水质通")
                .font(.system(size: 30, weight: .bold, design: .rounded))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 38)
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
        .background(Color.clear)
    }
}

struct HomeIconOnlyView: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 32, style: .continuous)
                .fill(AppGradient.ocean)
                .frame(width: 88, height: 88)

            Circle()
                .fill(Color.white.opacity(0.14))
                .frame(width: 60, height: 60)
                .offset(x: 18, y: -18)

            Image(systemName: "drop.fill")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white)
        }
        .shadow(color: AppTint.primary.opacity(0.20), radius: 22, x: 0, y: 14)
        .padding(24)
        .background(Color.clear)
    }
}

@MainActor
func exportPNG<V: View>(view: V, size: CGSize, scale: CGFloat, outputURL: URL) throws {
    let renderer = ImageRenderer(content:
        view
            .frame(width: size.width, height: size.height, alignment: .top)
            .background(Color.clear)
    )
    renderer.scale = scale
    renderer.proposedSize = ProposedViewSize(size)

    guard let cgImage = renderer.cgImage else {
        throw NSError(domain: "ExportHomeLogo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to render cgImage."])
    }

    let rep = NSBitmapImageRep(cgImage: cgImage)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "ExportHomeLogo", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG."])
    }

    try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try data.write(to: outputURL)
}

@main
struct ExportHomeLogoMain {
    @MainActor
    static func main() throws {
        let args = CommandLine.arguments.dropFirst()
        let heroOutput = URL(fileURLWithPath: args.first ?? "./Exports/HomeHeroLogo.png")
        let iconOutput = URL(fileURLWithPath: args.dropFirst().first ?? "./Exports/HomeHeroIcon.png")

        try exportPNG(
            view: HomeHeroLogoView(),
            size: CGSize(width: 300, height: 190),
            scale: 3,
            outputURL: heroOutput
        )

        try exportPNG(
            view: HomeIconOnlyView(),
            size: CGSize(width: 140, height: 140),
            scale: 6,
            outputURL: iconOutput
        )

        print("Exported home hero logo PNG to \(heroOutput.path)")
        print("Exported home icon PNG to \(iconOutput.path)")
    }
}
