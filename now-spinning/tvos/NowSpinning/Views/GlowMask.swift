import CoreGraphics
import Foundation

/// The shape of the stage's soft glows, as an image with a dither in it.
///
/// A faint glow over the dark stage changes by less than one 8-bit level every few pixels. Drawn as
/// a gradient, every pixel is rounded to the nearest level, and the roundings line up into rings
/// that show on the TV (#701). Here each pixel's coverage gets a little noise before it is
/// rounded, so neighbouring pixels round up or down at random: the rings break up and the average
/// stays exact.
///
/// The glow's colour is applied when it is drawn, so one image serves every colour, and a new
/// record's colour still fades in.
@MainActor
enum GlowMask {
    /// The noise, in coverage levels (of 255). The glows are 22–32% opaque, over a background about
    /// 110 levels darker, so this comes to about one level of the colour on screen.
    static let noise = 10.0

    private static var cache: [Size: CGImage] = [:]
    private struct Size: Hashable {
        let width: Int
        let height: Int
    }

    /// White, with alpha falling in a straight line from 1 at the centre to 0 at the edge of the
    /// ellipse that fills the image: CSS `radial-gradient(color, transparent)`.
    static func image(width: Int, height: Int) -> CGImage? {
        let size = Size(width: width, height: height)
        if let image = cache[size] { return image }

        // Grey and alpha per pixel, premultiplied: white at coverage c is (c, c).
        var pixels = [UInt8](repeating: 0, count: width * height * 2)
        pixels.withUnsafeMutableBufferPointer { out in
            let cx = Double(width) / 2, cy = Double(height) / 2
            for y in 0..<height {
                let dy = (Double(y) + 0.5 - cy) / cy
                for x in 0..<width {
                    let dx = (Double(x) + 0.5 - cx) / cx
                    let level = 255 * max(0, 1 - (dx * dx + dy * dy).squareRoot())
                    // Triangular noise, narrowed near 0 and 255 so it never has to be clipped,
                    // which would shift the average.
                    let reach = min(noise, level, 255 - level)
                    let jitter = (unit(x, y, 1) + unit(x, y, 2) - 1) * reach
                    let value = UInt8((level + jitter).rounded())
                    let i = (y * width + x) * 2
                    out[i] = value
                    out[i + 1] = value
                }
            }
        }

        guard let provider = CGDataProvider(data: Data(pixels) as CFData),
              let image = CGImage(
                width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 16,
                bytesPerRow: width * 2, space: CGColorSpaceCreateDeviceGray(),
                bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        else { return nil }
        cache[size] = image
        return image
    }

    /// A well-mixed value in [0, 1) for each pixel: an integer hash, so the same every time.
    private static func unit(_ x: Int, _ y: Int, _ salt: UInt32) -> Double {
        var h = (UInt32(truncatingIfNeeded: x) &* 0x8da6_b343)
            ^ (UInt32(truncatingIfNeeded: y) &* 0xd816_3841)
            ^ (salt &* 0xcb1a_b31f)
        h ^= h >> 16
        h &*= 0x7feb_352d
        h ^= h >> 15
        h &*= 0x846c_a68b
        h ^= h >> 16
        return Double(h) / 4_294_967_296
    }
}
