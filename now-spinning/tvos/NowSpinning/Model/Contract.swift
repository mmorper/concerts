import Foundation

/// The Now Spinning state contract, version 1.
///
/// The source of truth is `workers/now-spinning/src/types.ts`; one example of every state is in
/// `test/fixtures/now-spinning-states.json`. The Worker writes every word and formats every date,
/// so this app only lays out what it is sent.
///
/// Decoding is forgiving on purpose. The Worker is updated far more often than this app:
/// - an unknown `kind` renders as idle
/// - an unknown `screen` renders as `unknown` (the song only)
/// - unknown fields are ignored, and a missing list is an empty one
struct NowSpinningState: Decodable, Equatable, Sendable {
    enum Kind: String, Sendable { case idle, unmatched, track, gap }

    let v: Int
    let kindName: String
    let at: Date?
    let now: Date?
    let notice: String?
    let track: Track?

    var kind: Kind { Kind(rawValue: kindName) ?? .idle }

    /// How long this state had lasted when the Worker sent it, by the Worker's clock (`now − at`).
    /// Timers start from this, never from this device's clock, so a reconnect doesn't restart them.
    var elapsed: TimeInterval {
        guard let at, let now else { return 0 }
        return max(0, now.timeIntervalSince(at))
    }

    static let idle = NowSpinningState(v: 1, kindName: "idle", at: nil, now: nil, notice: nil, track: nil)

    init(v: Int, kindName: String, at: Date?, now: Date?, notice: String?, track: Track?) {
        self.v = v
        self.kindName = kindName
        self.at = at
        self.now = now
        self.notice = notice
        self.track = track
    }

    private enum CodingKeys: String, CodingKey { case v, kind, at, now, notice, track }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        v = (try? c.decode(Int.self, forKey: .v)) ?? 0
        kindName = (try? c.decode(String.self, forKey: .kind)) ?? "idle"
        at = Self.date((try? c.decode(String.self, forKey: .at)) ?? "")
        now = Self.date((try? c.decode(String.self, forKey: .now)) ?? "")
        notice = (try? c.decode(String.self, forKey: .notice)).flatMap { $0.isEmpty ? nil : $0 }
        track = try? c.decode(Track.self, forKey: .track)
    }

    /// The Worker's timestamps: `2026-11-21T20:00:00.000Z`.
    static func date(_ s: String) -> Date? {
        if let d = try? Date(s, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) { return d }
        return try? Date(s, strategy: Date.ISO8601FormatStyle())
    }
}

struct Track: Decodable, Equatable, Sendable {
    enum Screen: String, Sendable {
        case heard
        case seenCover = "seen-cover"
        case seen
        case coverOfThis = "cover-of-this"
        case covers
        case none
        case unknown
    }

    struct Album: Equatable, Sendable {
        let title: String
        let year: String?
        let coverURL: URL?
    }

    /// The big numeral. `times` → draw the "×".
    struct Count: Decodable, Equatable, Sendable {
        let n: Int
        let times: Bool
    }

    struct Night: Decodable, Equatable, Sendable, Identifiable {
        let date: String
        let dateLabel: String
        let text: String
        let hasPhotos: Bool
        var id: String { date + "|" + text }
    }

    struct Photo: Equatable, Sendable, Identifiable {
        let url: URL
        let caption: String
        /// The focal point, 0–1 across and down: the crop Mike chose.
        let fx: Double
        let fy: Double
        var id: URL { url }
    }

    let title: String
    let artist: String
    let album: Album?
    let screenName: String
    let count: Count?
    let headline: String
    let lines: [String]
    let nights: [Night]
    let moreNights: Int
    let photos: [Photo]
    let accentHue: Double

    /// nil when this app doesn't know the screen: it renders as `unknown`, the song only.
    var screen: Screen? { Screen(rawValue: screenName) }

    private enum CodingKeys: String, CodingKey {
        case title, artist, album, screen, count, headline, lines, nights, moreNights, photos, accentHue
    }
    private enum AlbumKeys: String, CodingKey { case title, year, coverUrl }
    private enum PhotoKeys: String, CodingKey { case url, caption, fx, fy }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decode(String.self, forKey: .title)
        artist = try c.decode(String.self, forKey: .artist)
        screenName = (try? c.decode(String.self, forKey: .screen)) ?? "unknown"
        count = try? c.decode(Count.self, forKey: .count)
        headline = (try? c.decode(String.self, forKey: .headline)) ?? ""
        lines = (try? c.decode([String].self, forKey: .lines)) ?? []
        nights = (try? c.decode([Night].self, forKey: .nights)) ?? []
        moreNights = (try? c.decode(Int.self, forKey: .moreNights)) ?? 0
        accentHue = (try? c.decode(Double.self, forKey: .accentHue)) ?? 260

        if let a = try? c.nestedContainer(keyedBy: AlbumKeys.self, forKey: .album),
           let albumTitle = try? a.decode(String.self, forKey: .title) {
            album = Album(
                title: albumTitle,
                year: try? a.decode(String.self, forKey: .year),
                coverURL: Self.https(try? a.decode(String.self, forKey: .coverUrl))
            )
        } else {
            album = nil
        }

        var list: [Photo] = []
        if var items = try? c.nestedUnkeyedContainer(forKey: .photos) {
            while !items.isAtEnd {
                guard let p = try? items.nestedContainer(keyedBy: PhotoKeys.self) else { break }
                if let url = Self.https(try? p.decode(String.self, forKey: .url)) {
                    list.append(Photo(
                        url: url,
                        caption: (try? p.decode(String.self, forKey: .caption)) ?? "",
                        fx: Self.unit(try? p.decode(Double.self, forKey: .fx)),
                        fy: Self.unit(try? p.decode(Double.self, forKey: .fy))
                    ))
                }
            }
        }
        photos = Array(list.prefix(5))
    }

    /// Only https images go on screen.
    private static func https(_ s: String?) -> URL? {
        guard let s, let url = URL(string: s), url.scheme == "https" else { return nil }
        return url
    }

    private static func unit(_ x: Double?) -> Double {
        guard let x, x.isFinite else { return 0.5 }
        return min(1, max(0, x))
    }
}
