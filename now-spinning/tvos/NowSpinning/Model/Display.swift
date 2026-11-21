import Foundation
import Observation

/// What is on screen, and the rules that decide it. The same rules as the web page
/// (`public/now-spinning.html`), so the two can be compared side by side.
@MainActor
@Observable
final class Display {
    enum Screen: Equatable {
        case idle(notice: String?)
        case unmatched
        case track(Track)
    }

    /// Between tracks the words step back after this long.
    static let gapFade: TimeInterval = 90
    static let flipKey = "nowSpinning.flip"

    private(set) var screen: Screen = .idle(notice: nil)
    /// A gap has lasted 90 seconds: the text fades, the sleeve and record stay.
    private(set) var faded = false
    /// Sleeve on the right, text on the left. Each new record flips it (OLED care).
    private(set) var flipped: Bool
    /// Changes each time a different track is drawn, so the views can replay their entrance.
    private(set) var trackChange = 0
    /// The last state the Worker sent, for logging.
    private(set) var lastState: NowSpinningState = .idle

    /// Set by an idle state; the next track mirrors the layout. A relaunch mid-record doesn't.
    @ObservationIgnored private var pendingFlip = false
    @ObservationIgnored private var gapTask: Task<Void, Never>?
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.flipped = defaults.bool(forKey: Self.flipKey)
    }

    /// Anything but idle keeps the Apple TV awake. On idle its screensaver takes over (OLED care).
    var keepsScreenAwake: Bool {
        if case .idle = screen { return false }
        return true
    }

    func apply(_ state: NowSpinningState) {
        lastState = state
        gapTask?.cancel()
        gapTask = nil

        switch state.kind {
        case .idle:
            pendingFlip = true
            faded = false
            screen = .idle(notice: state.notice)

        case .unmatched:
            faded = false
            screen = .unmatched

        case .track, .gap:
            guard let track = state.track else {
                // A gap with nothing identified yet keeps whatever is on screen.
                if state.kind == .track { screen = .unmatched }
                return
            }
            if screen != .track(track) {
                if pendingFlip, !isShowingTrack {
                    flipped.toggle()
                    defaults.set(flipped, forKey: Self.flipKey)
                }
                pendingFlip = false
                screen = .track(track)
                trackChange &+= 1
            }
            faded = false
            if state.kind == .gap {
                let wait = Self.gapFade - state.elapsed
                if wait <= 0 {
                    faded = true
                } else {
                    gapTask = Task { [weak self] in
                        try? await Task.sleep(for: .seconds(wait))
                        guard !Task.isCancelled else { return }
                        self?.faded = true
                    }
                }
            }
        }
    }

    private var isShowingTrack: Bool {
        if case .track = screen { return true }
        return false
    }
}
