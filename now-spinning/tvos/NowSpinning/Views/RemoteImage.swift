import SwiftUI
import UIKit

/// Images from the site and from Shazam, kept for the life of the app.
actor ImageCache {
    static let shared = ImageCache()
    private var images: [URL: UIImage] = [:]
    private var order: [URL] = []
    private let limit = 24

    func image(for url: URL) async -> UIImage? {
        if let hit = images[url] { return hit }
        guard let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let image = UIImage(data: data) else { return nil }
        images[url] = image
        order.append(url)
        if order.count > limit { images[order.removeFirst()] = nil }
        return image
    }
}

/// An image filling its frame, cropped around a focal point (`fx`, `fy`, 0–1), like the page's
/// `background-position`. Draws nothing until it loads; a failed load stays empty.
struct FocalImage: View {
    let url: URL
    var fx: Double = 0.5
    var fy: Double = 0.5
    @State private var image: UIImage?

    var body: some View {
        GeometryReader { geo in
            if let image {
                let size = image.size
                let scale = max(geo.size.width / max(size.width, 1), geo.size.height / max(size.height, 1))
                let w = size.width * scale, h = size.height * scale
                // Put the focal point at the centre, without showing past an edge.
                let x = min(0, max(geo.size.width - w, geo.size.width / 2 - fx * w))
                let y = min(0, max(geo.size.height - h, geo.size.height / 2 - fy * h))
                Image(uiImage: image)
                    .resizable()
                    .frame(width: w, height: h)
                    .offset(x: x, y: y)
            }
        }
        .clipped()
        .task(id: url) { image = await ImageCache.shared.image(for: url) }
    }
}
