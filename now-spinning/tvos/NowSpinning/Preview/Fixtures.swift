import Foundation

/// The state contract's examples, `test/fixtures/now-spinning-states.json`, bundled for previews.
/// The same file the Worker's tests write and the web page's `?fixture=` reads, so each preview
/// can be checked against its screenshot in `docs/specs/implemented/global-now-spinning/screens/`.
enum Fixtures {
    static let all: [String: NowSpinningState] = {
        guard let url = Bundle.main.url(forResource: "now-spinning-states", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        var out: [String: NowSpinningState] = [:]
        for (name, value) in object where !name.hasPrefix("_") {
            guard let json = try? JSONSerialization.data(withJSONObject: value),
                  let state = try? JSONDecoder().decode(NowSpinningState.self, from: json) else { continue }
            out[name] = state
        }
        return out
    }()

    /// A display showing one fixture, as it would after receiving it.
    @MainActor
    static func display(_ name: String, flipped: Bool = false) -> Display {
        let defaults = UserDefaults(suiteName: "preview.\(name)") ?? .standard
        defaults.set(flipped, forKey: Display.flipKey)
        let display = Display(defaults: defaults)
        display.apply(all[name] ?? .idle)
        return display
    }
}
