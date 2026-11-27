import SwiftUI

/// The whole screen: a 1920×1080 stage (an Apple TV's screen in points), scaled to fit anything
/// else, such as a preview canvas.
struct StageView: View {
    let display: Display

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / Theme.stageSize.width, geo.size.height / Theme.stageSize.height)
            Stage(display: display)
                .frame(width: Theme.stageSize.width, height: Theme.stageSize.height)
                .scaleEffect(scale)
                .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .background(Theme.night)
        .ignoresSafeArea()
    }
}

private struct Stage: View {
    let display: Display

    var body: some View {
        ZStack(alignment: .topLeading) {
            StageBackground()
            switch display.screen {
            case .idle(let notice):
                IdleView(notice: notice)
            case .unmatched:
                NowPlaying(content: .unmatched, flipped: display.flipped, faded: false, change: display.trackChange)
            case .track(let track):
                NowPlaying(content: .track(track), flipped: display.flipped, faded: display.faded, change: display.trackChange)
            }
        }
        .frame(width: Theme.stageSize.width, height: Theme.stageSize.height)
        .clipped()
    }
}

// MARK: - Background

/// `#stage`: a deep violet, lit from above.
private struct StageBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: Color(red: 0x18 / 255, green: 0x13 / 255, blue: 0x34 / 255), location: 0),
                    .init(color: Color(red: 0x1e / 255, green: 0x1b / 255, blue: 0x4b / 255), location: 0.40),
                    .init(color: Color(red: 0x24 / 255, green: 0x12 / 255, blue: 0x53 / 255), location: 0.78),
                    .init(color: Color(red: 0x2c / 255, green: 0x16 / 255, blue: 0x60 / 255), location: 1),
                ],
                startPoint: .top, endPoint: .bottom)
            Glow(color: Color(red: 140 / 255, green: 122 / 255, blue: 224 / 255).opacity(0.26),
                 center: CGPoint(x: 960, y: 324), radii: CGSize(width: 1100, height: 620), fade: 0.62)
        }
        .frame(width: Theme.stageSize.width, height: Theme.stageSize.height)
    }
}

/// CSS `radial-gradient(<w>px <h>px at x y, color, transparent <fade>)`.
///
/// Drawn from `GlowMask`, which is dithered: a plain RadialGradient this faint, over the dark
/// stage, rounds into rings that show on the TV.
private struct Glow: View {
    let color: Color
    let center: CGPoint
    let radii: CGSize
    let fade: CGFloat

    @Environment(\.displayScale) private var displayScale

    var body: some View {
        // The glow reaches transparent at `fade` of each radius. One image pixel per screen pixel,
        // so the dither isn't smoothed away by scaling.
        let width = Int((radii.width * fade * 2 * displayScale).rounded())
        let height = Int((radii.height * fade * 2 * displayScale).rounded())
        if let mask = GlowMask.image(width: width, height: height) {
            Image(decorative: mask, scale: displayScale)
                .renderingMode(.template)
                .foregroundStyle(color)
                .position(center)
                .allowsHitTesting(false)
        }
    }
}

// MARK: - Idle

/// "Put a record on." The Apple TV's screensaver takes over from here (OLED care).
private struct IdleView: View {
    let notice: String?

    var body: some View {
        VStack(spacing: 0) {
            Text("Morperhaus")
                .font(Theme.playfair(76))
                .foregroundStyle(Theme.faint)
            Text("CONCERT ARCHIVES")
                .font(Theme.sans(24))
                .trackingEm(0.3, size: 24)
                .foregroundStyle(Theme.faint)
                .padding(.top, 12)
            Text("Put a record on.")
                .font(Theme.playfair(32, .italic))
                .foregroundStyle(Theme.faint)
                .padding(.top, 48)
            if let notice {
                Text(notice)
                    .font(Theme.sans(22))
                    .foregroundStyle(Theme.notePink.opacity(0.85))
                    .padding(.top, 20)
            }
        }
        .multilineTextAlignment(.center)
        .frame(width: Theme.stageSize.width, height: Theme.stageSize.height)
    }
}

// MARK: - Now playing (a track, or "Listening…")

private struct NowPlaying: View {
    enum Content: Equatable {
        case unmatched
        case track(Track)
    }

    let content: Content
    let flipped: Bool
    let faded: Bool
    /// Changes when a different track arrives: replays the record's slide and the text's entrance.
    let change: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var photoIndex = 0

    private var track: Track? {
        if case .track(let t) = content { return t }
        return nil
    }
    /// Photos only for a screen this app knows; an unknown screen is the song only.
    private var photos: [Track.Photo] { track?.screen == nil ? [] : track?.photos ?? [] }
    private var hue: Double { track?.accentHue ?? 255 }

    var body: some View {
        ZStack(alignment: .topLeading) {
            PhotoBackdrop(photos: photos, index: photoIndex)
            Veil(flipped: flipped)
            // With no photos, the room takes its colour from the record.
            Glow(color: glowColor,
                 center: CGPoint(x: flipped ? 1920 - 422 : 422, y: 486),
                 radii: CGSize(width: 900, height: 700), fade: 0.70)
                .animation(.easeInOut(duration: 1.5), value: glowColor)

            Deck(content: content, flipped: flipped, change: change)
                .place(x: flipped ? 1920 - 120 - 620 : 120, y: 150, width: 620, height: 620)

            InfoColumn(content: content)
                .id(change)
                .opacity(faded ? 0.2 : 1)
                .animation(.easeInOut(duration: 1.2), value: faded)
                .place(x: flipped ? 110 : 930, y: 150, width: 880, height: 820)

            Strip(track: track, photos: photos, index: photoIndex, flipped: flipped, faded: faded)
                .place(x: flipped ? 110 : 120, y: 1080 - 70 - 140, width: 1690, height: 140, alignment: .bottomLeading)
        }
        .task(id: change) {
            // Background photos crossfade every 7 s.
            photoIndex = 0
            guard photos.count > 1 else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(7))
                guard !Task.isCancelled else { return }
                photoIndex = (photoIndex + 1) % photos.count
            }
        }
    }

    private var glowColor: Color {
        if track == nil { return Color(hue: 255, saturation: 0.6, lightness: 0.55, opacity: 0.22) }
        return Color(hue: hue, saturation: 0.7, lightness: 0.55, opacity: photos.isEmpty ? 0.32 : 0)
    }
}

/// The night's photos, blurred behind everything, crossfading.
private struct PhotoBackdrop: View {
    let photos: [Track.Photo]
    let index: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            ForEach(Array(photos.enumerated()), id: \.element.id) { i, photo in
                FocalImage(url: photo.url, fx: photo.fx, fy: photo.fy)
                    .frame(width: 2000, height: 1160)
                    .blur(radius: 22)
                    .saturation(1.2)
                    .colorMultiply(Color(white: 0.55))
                    .scaleEffect(1.08)
                    .opacity(i == index ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 2.2), value: index)
            }
        }
        .frame(width: 1920, height: 1080)
        .clipped()
        .allowsHitTesting(false)
    }
}

/// `.veil`: darkens the text side and the bottom, so the words read over any photo.
private struct Veil: View {
    let flipped: Bool

    var body: some View {
        let shade = Theme.night
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: shade.opacity(0.78), location: 0),
                    .init(color: shade.opacity(0.35), location: 0.55),
                    .init(color: shade.opacity(0.70), location: 1),
                ],
                startPoint: flipped ? .trailing : .leading, endPoint: flipped ? .leading : .trailing)
            LinearGradient(
                stops: [
                    .init(color: shade.opacity(0.85), location: 0),
                    .init(color: shade.opacity(0), location: 0.40),
                ],
                startPoint: .bottom, endPoint: .top)
        }
        .frame(width: 1920, height: 1080)
        .allowsHitTesting(false)
    }
}

// MARK: - Record and sleeve

private struct Deck: View {
    let content: NowPlaying.Content
    let flipped: Bool
    let change: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var open = true

    var body: some View {
        let hue: Double = { if case .track(let t) = content { return t.accentHue }; return 255 }()
        let label: Color = {
            if case .track = content { return Color(hue: hue + 180, saturation: 0.7, lightness: 0.55) }
            return Color(hue: 255, saturation: 0.3, lightness: 0.55)
        }()
        // The record peeks out on the side away from the screen's edge, so it mirrors with the layout.
        let openX: CGFloat = flipped ? -160 : 200
        ZStack(alignment: .topLeading) {
            Vinyl(label: label, spinning: !reduceMotion)
                .frame(width: 580, height: 580)
                .offset(x: open ? openX : 20, y: 20)
            Sleeve(content: content)
                .frame(width: 620, height: 620)
        }
        .task(id: change) {
            // A new track: the record slides back into the sleeve, then out again.
            guard !reduceMotion else { open = true; return }
            open = false
            try? await Task.sleep(for: .milliseconds(350))
            withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.9)) { open = true }
        }
    }
}

/// A black record at 33⅓ rpm (1.8 s a turn) with a coloured label.
private struct Vinyl: View {
    let label: Color
    let spinning: Bool

    var body: some View {
        TimelineView(.animation(paused: !spinning)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let angle = spinning ? (t.truncatingRemainder(dividingBy: 1.8) / 1.8) * 360 : 0
            ZStack {
                Circle().fill(Color(red: 0x11 / 255, green: 0x11 / 255, blue: 0x11 / 255))
                Grooves()
                Circle()
                    .fill(Color(red: 0x0d / 255, green: 0x0d / 255, blue: 0x0f / 255))
                    .frame(width: 580 * 0.37, height: 580 * 0.37)
                Circle()
                    .fill(label)
                    .frame(width: 580 * 0.34, height: 580 * 0.34)
                // the sheen that makes the turning visible
                Circle().fill(AngularGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .clear, location: 0.12),
                        .init(color: .white.opacity(0.09), location: 0.16),
                        .init(color: .clear, location: 0.22),
                        .init(color: .clear, location: 0.62),
                        .init(color: .white.opacity(0.06), location: 0.66),
                        .init(color: .clear, location: 0.72),
                        .init(color: .clear, location: 1),
                    ],
                    center: .center, angle: .degrees(30 - 90)))
                Circle()
                    .fill(Theme.night)
                    .frame(width: 14, height: 14)
            }
            .rotationEffect(.degrees(angle))
        }
        .shadow(color: .black.opacity(0.6), radius: 40, y: 30)
    }
}

private struct Grooves: View {
    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            var r: CGFloat = size.width / 2 - 2
            let light = Color(red: 0x1c / 255, green: 0x1c / 255, blue: 0x20 / 255)
            while r > size.width * 0.19 {
                let ring = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
                ctx.stroke(ring, with: .color(light), lineWidth: 0.8)
                r -= 3.4
            }
        }
    }
}

/// The album art where it loads, over a drawn sleeve in the record's colour.
private struct Sleeve: View {
    let content: NowPlaying.Content

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            switch content {
            case .unmatched:
                LinearGradient(colors: [Color(hue: 255, saturation: 0.3, lightness: 0.34),
                                        Color(hue: 275, saturation: 0.4, lightness: 0.15)],
                               startPoint: UnitPoint(x: 0.07, y: 0), endPoint: UnitPoint(x: 0.93, y: 1))
                Rings()
            case .track(let t):
                LinearGradient(colors: [Color(hue: t.accentHue, saturation: 0.55, lightness: 0.42),
                                        Color(hue: t.accentHue + 40, saturation: 0.6, lightness: 0.18)],
                               startPoint: UnitPoint(x: 0.07, y: 0), endPoint: UnitPoint(x: 0.93, y: 1))
                Rings()
                VStack(alignment: .leading, spacing: 0) {
                    Text(t.album?.title ?? t.title)
                        .font(Theme.playfair(64, .bold))
                        .lineSpacing(-2)
                        .foregroundStyle(Theme.ink)
                    Text(t.artist.uppercased())
                        .font(Theme.sans(24))
                        .trackingEm(0.18, size: 24)
                        .foregroundStyle(Theme.ink.opacity(0.8))
                        .padding(.top, 14)
                }
                .padding(54)
                if let cover = t.album?.coverURL {
                    FocalImage(url: cover)
                }
            }
        }
        .colorMultiply(Color(white: Theme.sleeveBrightness))
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(0.06), lineWidth: 1))
        .shadow(color: .black.opacity(0.65), radius: 45, y: 40)
    }
}

private struct Rings: View {
    var body: some View {
        Canvas { ctx, size in
            let c = CGPoint(x: size.width + 140 - 260, y: -140 + 260)
            var r: CGFloat = 2
            while r < 260 {
                let ring = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
                ctx.stroke(ring, with: .color(.white.opacity(0.10)), lineWidth: 2)
                r += 26
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - The words

private struct InfoColumn: View {
    let content: NowPlaying.Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Kicker()
            switch content {
            case .unmatched:
                Text("Listening…")
                    .font(Theme.playfair(96, .bold))
                    .foregroundStyle(Theme.ink)
                    .padding(.top, 26)
                Live { QuietLines(headline: nil, lines: ["Nothing I recognise yet."], hopefulLast: false, nights: nil) }
            case .track(let t):
                Text(t.title)
                    .font(Theme.playfair(96, .bold))
                    .lineLimit(2)
                    .foregroundStyle(Theme.ink)
                    .padding(.top, 26)
                Text(t.artist)
                    .font(Theme.sans(40, .semibold))
                    .foregroundStyle(Theme.ink)
                    .padding(.top, 22)
                if let album = t.album {
                    Text(album.year.map { "\(album.title) · \($0)" } ?? album.title)
                        .font(Theme.playfair(28, .italic))
                        .foregroundStyle(Theme.dim)
                        .padding(.top, 8)
                }
                if let screen = t.screen {
                    Live { Archive(track: t, screen: screen) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .opacity(shown || reduceMotion ? 1 : 0)
        .offset(y: shown || reduceMotion ? 0 : 18)
        .onAppear { withAnimation(.easeOut(duration: 0.9)) { shown = true } }
    }
}

private struct Kicker: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(Theme.pink)
                .frame(width: 12, height: 12)
                .background(
                    Circle()
                        .fill(Theme.pink.opacity(pulse ? 0 : 0.7))
                        .frame(width: pulse ? 40 : 12, height: pulse ? 40 : 12)
                )
            Text("NOW SPINNING")
                .font(Theme.sans(22, .bold))
                .trackingEm(0.28, size: 22)
                .foregroundStyle(Theme.accent)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 2).repeatForever(autoreverses: false)) { pulse = true }
        }
    }
}

/// `.live`: the rule, then the archive's part of the screen.
private struct Live<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Rectangle().fill(.white.opacity(0.14)).frame(height: 1)
            HStack(alignment: .top, spacing: 44) { content() }
                .padding(.top, 40)
        }
        .padding(.top, 54)
    }
}

/// Every word here came from the Worker.
private struct Archive: View {
    let track: Track
    let screen: Track.Screen

    var body: some View {
        if screen == .unknown {
            QuietLines(headline: nil, lines: [track.headline], hopefulLast: false, nights: nil)
        } else if let count = track.count {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text(verbatim: String(count.n))
                    .font(Theme.playfair(150, .bold))
                    .foregroundStyle(.white)
                if count.times {
                    Text("×")
                        .font(Theme.playfair(60, .bold))
                        .foregroundStyle(Theme.accent)
                }
            }
            .frame(minWidth: 150, alignment: .leading)
            .padding(.top, -28)
            VStack(alignment: .leading, spacing: 0) {
                Text(track.headline)
                    .font(Theme.sans(34, .semibold))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(Array(track.lines.enumerated()), id: \.offset) { _, line in
                    Text(line)
                        .font(Theme.sans(24))
                        .foregroundStyle(Theme.dim)
                        .padding(.top, 8)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Nights(nights: track.nights, more: track.moreNights)
            }
        } else {
            // No numeral: the quiet layout. On "none" the last line is the hopeful one, set apart.
            QuietLines(headline: track.headline, lines: track.lines,
                       hopefulLast: screen == .none && track.lines.count > 1,
                       nights: (track.nights, track.moreNights))
        }
    }
}

private struct QuietLines: View {
    let headline: String?
    let lines: [String]
    let hopefulLast: Bool
    let nights: ([Track.Night], Int)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let headline {
                Text(headline)
                    .font(Theme.playfair(64, .bold))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            ForEach(Array(lines.enumerated()), id: \.offset) { i, line in
                let hopeful = hopefulLast && i == lines.count - 1
                Text(line)
                    .font(hopeful ? Theme.playfair(28, .italic) : Theme.sans(28))
                    .foregroundStyle(hopeful ? Theme.accent : Theme.dim)
                    .lineSpacing(10)
                    .frame(maxWidth: 820, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, headline == nil && i == 0 ? 0 : 18)
            }
            if let nights {
                Nights(nights: nights.0, more: nights.1)
            }
        }
    }
}

private struct Nights: View {
    let nights: [Track.Night]
    let more: Int

    var body: some View {
        if !nights.isEmpty || more > 0 {
            VStack(alignment: .leading, spacing: 9) {
                ForEach(nights.prefix(4)) { night in
                    HStack(spacing: 18) {
                        Text(night.dateLabel)
                            .font(Theme.sans(24, .semibold))
                            .foregroundStyle(Theme.ink)
                            .frame(width: 178, alignment: .leading)
                        Text(night.text)
                            .font(Theme.sans(24))
                            .foregroundStyle(Theme.dim)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
                if more > 0 {
                    Text(verbatim: "+ \(more) more")
                        .font(Theme.sans(24))
                        .foregroundStyle(Theme.dim)
                }
            }
            .padding(.top, 22)
        }
    }
}

// MARK: - The strip along the bottom

private struct Strip: View {
    let track: Track?
    let photos: [Track.Photo]
    let index: Int
    let flipped: Bool
    let faded: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .bottom, spacing: 22) {
            if flipped {
                Brand(alignment: .leading)
                Spacer(minLength: 0)
                caption.multilineTextAlignment(.trailing)
                thumbs
            } else {
                thumbs
                caption
                Spacer(minLength: 0)
                Brand(alignment: .trailing)
            }
        }
    }

    private var thumbs: some View {
        HStack(spacing: 14) {
            ForEach(Array(photos.enumerated()), id: \.element.id) { i, photo in
                FocalImage(url: photo.url, fx: photo.fx, fy: photo.fy)
                    .frame(width: 150, height: 100)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(i == index ? 0.8 : 0), lineWidth: 2))
                    .shadow(color: .black.opacity(0.5), radius: 15, y: 10)
                    .opacity(i == index ? 1 : 0.55)
                    .offset(y: i == index ? -6 : 0)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.6), value: index)
            }
        }
        .opacity(faded ? 0 : 1)
        .animation(.easeInOut(duration: 1.2), value: faded)
    }

    @ViewBuilder private var caption: some View {
        Group {
            if !photos.isEmpty {
                let parts = photos[min(index, photos.count - 1)].caption.components(separatedBy: " · ")
                VStack(alignment: flipped ? .trailing : .leading, spacing: 0) {
                    Text("From the night")
                    HStack(spacing: 0) {
                        Text(parts.first ?? "").font(Theme.sans(22, .semibold)).foregroundStyle(Theme.ink)
                        if parts.count > 1 { Text(" · " + parts.dropFirst().joined(separator: " · ")) }
                    }
                }
            } else if let track, track.screen != nil, !track.nights.isEmpty {
                Text("No photos from these nights yet")
            }
        }
        .font(Theme.sans(22))
        .foregroundStyle(Theme.dim)
        .lineSpacing(4)
        .opacity(faded ? 0 : 1)
        .animation(.easeInOut(duration: 1.2), value: faded)
    }
}

private struct Brand: View {
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 0) {
            Text("Morperhaus").font(Theme.playfair(24))
            Text("CONCERT ARCHIVES").font(Theme.sans(16)).trackingEm(0.22, size: 16)
        }
        .foregroundStyle(Theme.faint)
    }
}
