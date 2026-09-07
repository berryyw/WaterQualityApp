import AppKit
import Foundation

struct IconSpec {
    let filename: String
    let size: CGFloat
}

let outputPath = CommandLine.arguments.dropFirst().first
    ?? "./Assets.xcassets/AppIcon.appiconset"
let outputURL = URL(fileURLWithPath: outputPath, isDirectory: true)

let specs: [IconSpec] = [
    .init(filename: "Icon-20@2x.png", size: 40),
    .init(filename: "Icon-20@3x.png", size: 60),
    .init(filename: "Icon-29@2x.png", size: 58),
    .init(filename: "Icon-29@3x.png", size: 87),
    .init(filename: "Icon-40@2x.png", size: 80),
    .init(filename: "Icon-40@3x.png", size: 120),
    .init(filename: "Icon-60@2x.png", size: 120),
    .init(filename: "Icon-60@3x.png", size: 180),
    .init(filename: "Icon-1024.png", size: 1024)
]

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(
        calibratedRed: red / 255,
        green: green / 255,
        blue: blue / 255,
        alpha: alpha
    )
}

func drawRoundedRect(in rect: NSRect, radius: CGFloat) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    path.fill()
}

func drawDrop(in rect: NSRect, color: NSColor) {
    let path = NSBezierPath()
    let top = NSPoint(x: rect.midX, y: rect.maxY)
    let left = NSPoint(x: rect.minX, y: rect.midY + rect.height * 0.08)
    let bottom = NSPoint(x: rect.midX, y: rect.minY)
    let right = NSPoint(x: rect.maxX, y: rect.midY + rect.height * 0.08)

    path.move(to: top)
    path.curve(
        to: left,
        controlPoint1: NSPoint(x: rect.midX - rect.width * 0.08, y: rect.maxY - rect.height * 0.12),
        controlPoint2: NSPoint(x: rect.minX + rect.width * 0.03, y: rect.midY + rect.height * 0.23)
    )
    path.curve(
        to: bottom,
        controlPoint1: NSPoint(x: rect.minX + rect.width * 0.01, y: rect.midY - rect.height * 0.08),
        controlPoint2: NSPoint(x: rect.midX - rect.width * 0.15, y: rect.minY + rect.height * 0.04)
    )
    path.curve(
        to: right,
        controlPoint1: NSPoint(x: rect.midX + rect.width * 0.15, y: rect.minY + rect.height * 0.04),
        controlPoint2: NSPoint(x: rect.maxX - rect.width * 0.01, y: rect.midY - rect.height * 0.08)
    )
    path.curve(
        to: top,
        controlPoint1: NSPoint(x: rect.maxX - rect.width * 0.03, y: rect.midY + rect.height * 0.23),
        controlPoint2: NSPoint(x: rect.midX + rect.width * 0.08, y: rect.maxY - rect.height * 0.12)
    )
    path.close()
    color.setFill()
    path.fill()
}

func drawCapsule(in rect: NSRect, color: NSColor) {
    let path = NSBezierPath(roundedRect: rect, xRadius: rect.height / 2, yRadius: rect.height / 2)
    color.setFill()
    path.fill()
}

func drawCircle(in rect: NSRect, color: NSColor) {
    color.setFill()
    NSBezierPath(ovalIn: rect).fill()
}

func drawWaveStroke(in rect: NSRect, color: NSColor, lineWidth: CGFloat) {
    let path = NSBezierPath()
    path.move(to: NSPoint(x: rect.minX, y: rect.midY))
    path.curve(
        to: NSPoint(x: rect.midX, y: rect.midY),
        controlPoint1: NSPoint(x: rect.minX + rect.width * 0.18, y: rect.maxY),
        controlPoint2: NSPoint(x: rect.minX + rect.width * 0.32, y: rect.minY)
    )
    path.curve(
        to: NSPoint(x: rect.maxX, y: rect.midY),
        controlPoint1: NSPoint(x: rect.midX + rect.width * 0.18, y: rect.maxY),
        controlPoint2: NSPoint(x: rect.maxX - rect.width * 0.18, y: rect.minY)
    )
    path.lineWidth = lineWidth
    path.lineCapStyle = .round
    path.lineJoinStyle = .round
    color.setStroke()
    path.stroke()
}

func drawSwimmerBody(in rect: NSRect, strokeColor: NSColor, armColor: NSColor) {
    let body = NSBezierPath()
    body.move(to: NSPoint(x: rect.minX + rect.width * 0.14, y: rect.minY + rect.height * 0.52))
    body.curve(
        to: NSPoint(x: rect.minX + rect.width * 0.90, y: rect.minY + rect.height * 0.18),
        controlPoint1: NSPoint(x: rect.minX + rect.width * 0.42, y: rect.minY + rect.height * 0.56),
        controlPoint2: NSPoint(x: rect.minX + rect.width * 0.66, y: rect.minY + rect.height * 0.34)
    )
    body.lineWidth = rect.height * 0.18
    body.lineCapStyle = .round
    body.lineJoinStyle = .round
    strokeColor.setStroke()
    body.stroke()

    let arm = NSBezierPath()
    arm.move(to: NSPoint(x: rect.minX + rect.width * 0.28, y: rect.minY + rect.height * 0.48))
    arm.curve(
        to: NSPoint(x: rect.minX + rect.width * 0.88, y: rect.minY + rect.height * 0.76),
        controlPoint1: NSPoint(x: rect.minX + rect.width * 0.48, y: rect.minY + rect.height * 0.12),
        controlPoint2: NSPoint(x: rect.minX + rect.width * 0.74, y: rect.minY + rect.height * 0.34)
    )
    arm.lineWidth = rect.height * 0.15
    arm.lineCapStyle = .round
    arm.lineJoinStyle = .round
    armColor.setStroke()
    arm.stroke()

    let leg = NSBezierPath()
    leg.move(to: NSPoint(x: rect.minX + rect.width * 0.58, y: rect.minY + rect.height * 0.24))
    leg.curve(
        to: NSPoint(x: rect.minX + rect.width * 0.90, y: rect.minY + rect.height * 0.05),
        controlPoint1: NSPoint(x: rect.minX + rect.width * 0.72, y: rect.minY + rect.height * 0.18),
        controlPoint2: NSPoint(x: rect.minX + rect.width * 0.80, y: rect.minY + rect.height * 0.08)
    )
    leg.lineWidth = rect.height * 0.10
    leg.lineCapStyle = .round
    armColor.withAlphaComponent(0.85).setStroke()
    leg.stroke()
}

func renderIcon(size: CGFloat) -> NSBitmapImageRep {
    let pixelSize = Int(size)
    let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelSize,
        pixelsHigh: pixelSize,
        bitsPerSample: 8,
        samplesPerPixel: 3,
        hasAlpha: false,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 24
    )!

    guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
        return bitmap
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphicsContext

    guard let context = NSGraphicsContext.current?.cgContext else {
        NSGraphicsContext.restoreGraphicsState()
        return bitmap
    }

    context.interpolationQuality = .high

    let fullRect = NSRect(x: 0, y: 0, width: size, height: size)
    let cornerRadius = size * 0.225

    let background = NSGradient(
        colors: [
            color(24, 66, 188),
            color(17, 122, 244),
            color(101, 220, 255)
        ]
    )
    background?.draw(in: fullRect, angle: 302)

    color(255, 255, 255, 0.12).setFill()
    NSBezierPath(ovalIn: NSRect(
        x: size * 0.06,
        y: size * 0.60,
        width: size * 0.56,
        height: size * 0.56
    )).fill()

    color(255, 255, 255, 0.08).setFill()
    NSBezierPath(ovalIn: NSRect(
        x: size * 0.52,
        y: size * 0.08,
        width: size * 0.36,
        height: size * 0.36
    )).fill()

    color(255, 255, 255, 0.10).setFill()
    drawRoundedRect(
        in: NSRect(
            x: size * 0.11,
            y: size * 0.11,
            width: size * 0.78,
            height: size * 0.78
        ),
        radius: size * 0.18
    )

    let dropRect = NSRect(
        x: size * 0.40,
        y: size * 0.62,
        width: size * 0.20,
        height: size * 0.22
    )
    drawCircle(
        in: NSRect(
            x: size * 0.365,
            y: size * 0.595,
            width: size * 0.27,
            height: size * 0.27
        ),
        color: color(255, 255, 255, 0.12)
    )
    drawDrop(in: dropRect, color: color(233, 249, 255, 0.98))
    drawDrop(
        in: NSRect(
            x: size * 0.445,
            y: size * 0.67,
            width: size * 0.072,
            height: size * 0.082
        ),
        color: color(255, 255, 255, 0.34)
    )

    drawCapsule(
        in: NSRect(
            x: size * 0.13,
            y: size * 0.17,
            width: size * 0.74,
            height: size * 0.21
        ),
        color: color(10, 108, 220, 0.96)
    )
    drawWaveStroke(
        in: NSRect(
            x: size * 0.16,
            y: size * 0.34,
            width: size * 0.68,
            height: size * 0.075
        ),
        color: color(207, 245, 255, 0.98),
        lineWidth: size * 0.024
    )
    drawWaveStroke(
        in: NSRect(
            x: size * 0.21,
            y: size * 0.255,
            width: size * 0.58,
            height: size * 0.06
        ),
        color: color(255, 255, 255, 0.58),
        lineWidth: size * 0.015
    )

    drawCircle(
        in: NSRect(
            x: size * 0.325,
            y: size * 0.40,
            width: size * 0.115,
            height: size * 0.115
        ),
        color: color(255, 229, 204)
    )

    let cap = NSBezierPath()
    cap.move(to: NSPoint(x: size * 0.345, y: size * 0.475))
    cap.curve(
        to: NSPoint(x: size * 0.455, y: size * 0.458),
        controlPoint1: NSPoint(x: size * 0.365, y: size * 0.525),
        controlPoint2: NSPoint(x: size * 0.44, y: size * 0.52)
    )
    cap.line(to: NSPoint(x: size * 0.445, y: size * 0.438))
    cap.curve(
        to: NSPoint(x: size * 0.358, y: size * 0.438),
        controlPoint1: NSPoint(x: size * 0.425, y: size * 0.432),
        controlPoint2: NSPoint(x: size * 0.38, y: size * 0.432)
    )
    cap.close()
    color(214, 247, 255).setFill()
    cap.fill()

    drawSwimmerBody(
        in: NSRect(
            x: size * 0.39,
            y: size * 0.28,
            width: size * 0.36,
            height: size * 0.28
        ),
        strokeColor: color(255, 255, 255, 0.98),
        armColor: color(233, 249, 255, 1)
    )

    drawCircle(
        in: NSRect(
            x: size * 0.67,
            y: size * 0.50,
            width: size * 0.028,
            height: size * 0.028
        ),
        color: color(255, 255, 255, 0.92)
    )
    drawCircle(
        in: NSRect(
            x: size * 0.72,
            y: size * 0.535,
            width: size * 0.022,
            height: size * 0.022
        ),
        color: color(219, 247, 255, 0.86)
    )
    drawCircle(
        in: NSRect(
            x: size * 0.27,
            y: size * 0.56,
            width: size * 0.024,
            height: size * 0.024
        ),
        color: color(255, 255, 255, 0.36)
    )

    drawCircle(
        in: NSRect(
            x: size * 0.74,
            y: size * 0.57,
            width: size * 0.016,
            height: size * 0.016
        ),
        color: color(215, 246, 255, 0.80)
    )

    color(255, 255, 255, 0.18).setStroke()
    let border = NSBezierPath(
        roundedRect: NSInsetRect(fullRect, size * 0.012, size * 0.012),
        xRadius: cornerRadius * 0.94,
        yRadius: cornerRadius * 0.94
    )
    border.lineWidth = max(1, size * 0.010)
    border.stroke()

    NSGraphicsContext.restoreGraphicsState()
    return bitmap
}

func writePNG(bitmap: NSBitmapImageRep, to url: URL) throws {
    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "BrandAssetError", code: 1)
    }

    try png.write(to: url)
}

try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

for spec in specs {
    let bitmap = renderIcon(size: spec.size)
    try writePNG(bitmap: bitmap, to: outputURL.appendingPathComponent(spec.filename))
    print("Generated \(spec.filename)")
}
