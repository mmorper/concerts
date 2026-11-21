import SwiftUI

/// The web page's design, in SwiftUI. Values are the page's CSS (`public/now-spinning.html`), on
/// the same 1920×1080 stage, which is also an Apple TV's screen in points.
enum Theme {
    static let stageSize = CGSize(width: 1920, height: 1080)

    static let ink = Color(red: 245 / 255, green: 243 / 255, blue: 255 / 255)
    static let dim = Color(red: 237 / 255, green: 233 / 255, blue: 254 / 255).opacity(0.68)
    static let faint = Color(red: 237 / 255, green: 233 / 255, blue: 254 / 255).opacity(0.42)
    static let accent = Color(red: 196 / 255, green: 181 / 255, blue: 253 / 255)
    static let pink = Color(red: 244 / 255, green: 114 / 255, blue: 182 / 255)
    static let notePink = Color(red: 249 / 255, green: 168 / 255, blue: 212 / 255)
    static let night = Color(red: 11 / 255, green: 9 / 255, blue: 24 / 255)

    /// Album art and the drawn sleeve render at 82% (OLED care: the sleeve is the largest bright
    /// thing that stays put for a whole album).
    static let sleeveBrightness = 0.82

    static func playfair(_ size: CGFloat, _ weight: PlayfairWeight = .medium) -> Font {
        .custom(weight.rawValue, fixedSize: size)
    }
    static func sans(_ size: CGFloat, _ weight: SansWeight = .regular) -> Font {
        .custom(weight.rawValue, fixedSize: size)
    }

    enum PlayfairWeight: String {
        case medium = "PlayfairDisplay-Medium"
        case bold = "PlayfairDisplay-Bold"
        case italic = "PlayfairDisplay-MediumItalic"
    }
    enum SansWeight: String {
        case regular = "SourceSans3-Regular"
        case semibold = "SourceSans3-SemiBold"
        case bold = "SourceSans3-Bold"
    }
}

extension Color {
    /// CSS `hsl()`: hue in degrees, saturation and lightness 0–1.
    init(hue degrees: Double, saturation s: Double, lightness l: Double, opacity: Double = 1) {
        let h = (degrees.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 360
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s
        let p = 2 * l - q
        func channel(_ t0: Double) -> Double {
            var t = t0
            if t < 0 { t += 1 }
            if t > 1 { t -= 1 }
            if t < 1 / 6 { return p + (q - p) * 6 * t }
            if t < 1 / 2 { return q }
            if t < 2 / 3 { return p + (q - p) * (2 / 3 - t) * 6 }
            return p
        }
        self.init(red: channel(h + 1 / 3), green: channel(h), blue: channel(h - 1 / 3), opacity: opacity)
    }
}

extension View {
    /// Absolute placement on the stage by top-left corner, as the page's CSS does it.
    func place(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, alignment: Alignment = .topLeading) -> some View {
        frame(width: width, height: height, alignment: alignment)
            .position(x: x + width / 2, y: y + height / 2)
    }

    /// CSS `letter-spacing` in em.
    func trackingEm(_ em: CGFloat, size: CGFloat) -> some View {
        tracking(em * size)
    }
}
